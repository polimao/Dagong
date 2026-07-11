import { app } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import {
  defaultMagicPocketTokenEconomySettings,
  isMagicPocketRuntimeInsecure,
  getMagicPocketRuntimeSettings,
  getModelProviderSettings,
  resolveModelProviderProxyUrl,
  resolveMagicPocketRuntimeSettings,
  type ModelProviderModelProfileV1,
  type ModelProviderProfileV1,
  type MagicPocketRuntimeSettingsV1,
  type MagicPocketSubagentsSettingsV1,
  type AppSettingsV1
} from '../shared/app-settings'
import {
  buildMagicPocketServeArgs,
  resolveMagicPocketExecutable,
  shouldRunMagicPocketServeAsElectronChild
} from './resolve-magicpocket-binary'
import { resolveCodexOAuthApiKey } from './codex-auth'
import {
  MagicPocketConfigSchema,
  type MagicPocketConfig,
  MagicPocketServeConfigSchema,
  ModelConfigSchema,
  ContextCompactionConfigSchema,
  QualityConfigSchema,
  RuntimeTuningConfigSchema,
  RolesConfigSchema
} from '../../magicpocket/src/config/magicpocket-config.js'
import { HooksConfigSchema } from '../../magicpocket/src/hooks/hook-config.js'
import {
  AttachmentsCapabilityConfig,
  ComputerUseCapabilityConfig,
  ImageGenCapabilityConfig,
  InstructionsCapabilityConfig,
  McpCapabilityConfig,
  McpServerConfig,
  MemoryCapabilityConfig,
  MusicGenCapabilityConfig,
  SkillsCapabilityConfig,
  SpeechGenCapabilityConfig,
  SubagentsCapabilityConfig,
  VideoGenCapabilityConfig,
  WebCapabilityConfig
} from '../../magicpocket/src/contracts/capabilities.js'
import {
  buildClawScheduleMcpArgs,
  GUI_SCHEDULE_MCP_SERVER_NAME,
  resolveClawScheduleMcpCommand,
  resolveMagicPocketMcpJsonPath,
  type ClawScheduleMcpLaunchConfig
} from './claw-schedule-mcp-config'
import { defaultMagicPocketDataDir } from './runtime/magicpocket-adapter'
import { isMagicPocketHealthResponseBody } from './magicpocket-health'
import { resolveClaudeBinary } from './agent-sdk-installer'
import { appendManagedLogLine } from './logger'
import {
  comparableSkillRootPath,
  guiSkillManagedComparablePaths,
  guiSkillWorkspaceRootsForRuntime,
  guiSkillRootsForRuntime,
  isCodexPluginCacheRoot,
  normalizeSkillRootPath
} from './services/skill-service'

let child: ChildProcess | null = null
let childPort: number | null = null
let childLogCapture: MagicPocketChildLogCapture | null = null
let lastResolvedBinary: string | null = null
let magicpocketStartPromise: Promise<void> | null = null
let childStderrTail = ''
/** Children killed on purpose (stop/quit/settings restart) — their exit is not a crash. */
const intentionalStops = new WeakSet<ChildProcess>()
/** Children that completed the ready handshake — only their exits count as runtime crashes. */
const readyChildren = new WeakSet<ChildProcess>()

export type MagicPocketUnexpectedExitInfo = {
  code: number | null
  signal: NodeJS.Signals | null
  stderrTail: string
}

let onUnexpectedMagicPocketExit: ((info: MagicPocketUnexpectedExitInfo) => void) | null = null

/**
 * Called when a READY magicpocket child exits without the GUI asking for it.
 * Startup failures are excluded: those are already reported to the
 * caller of startMagicPocketChild via the thrown error.
 */
export function setMagicPocketUnexpectedExitHandler(
  handler: ((info: MagicPocketUnexpectedExitInfo) => void) | null
): void {
  onUnexpectedMagicPocketExit = handler
}

const execFileAsync = promisify(execFile)
const KUN_READY_PREFIX = 'KUN_READY '
const KUN_STARTUP_TIMEOUT_FLOOR_MS = 15_000
const KUN_STARTUP_TIMEOUT_CEILING_MS = 600_000

/**
 * How long to wait for a freshly spawned magicpocket to report ready before giving
 * up and killing it. magicpocket emits its ready marker only after the HTTP server
 * is actually listening, which it does only after sqlite opens, the thread
 * store finishes its backfill, usage carryover replays every thread's
 * events, and the MCP fast-connect race runs. On a slow disk (Windows +
 * antivirus scans) with a large history this routinely exceeds 45s, leaving
 * the runtime stuck in a "did not report ready within 45000ms" → SIGTERM →
 * respawn loop (#188, #544).
 *
 * A generous ceiling is free on fast machines: the parallel /health probe
 * in waitForMagicPocketStartup settles the moment the server responds, and a process
 * that actually crashes rejects immediately via its exit event rather than
 * waiting out the timeout. Only a slow-but-progressing boot uses the extra
 * runway. Windows gets the larger default; everything is overridable via the
 * KUN_STARTUP_TIMEOUT_MS env var (milliseconds, clamped to 15s–10min) for
 * extreme cases without a rebuild.
 */
export function resolveMagicPocketStartupTimeoutMs(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): number {
  const raw = env.KUN_STARTUP_TIMEOUT_MS
  if (raw && raw.trim()) {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) {
      return Math.min(
        KUN_STARTUP_TIMEOUT_CEILING_MS,
        Math.max(KUN_STARTUP_TIMEOUT_FLOOR_MS, Math.floor(parsed))
      )
    }
  }
  return platform === 'win32' ? 90_000 : 60_000
}

const KUN_STARTUP_TIMEOUT_MS = resolveMagicPocketStartupTimeoutMs(process.platform, process.env)
const KUN_STARTUP_HEALTH_POLL_MS = 500
const KUN_STARTUP_HEALTH_REQUEST_TIMEOUT_MS = 1_000
const KUN_STOP_GRACE_MS = 5_000
const KUN_STOP_FORCE_MS = 1_000
const STDERR_TAIL_MAX_CHARS = 32_768
const GUI_SCHEDULE_MCP_TIMEOUT_MS = 5_000
const MAX_TCP_PORT = 65_535
const DEFAULT_KUN_MODEL_PROFILES: Record<string, Record<string, unknown>> = {
  'deepseek-v4-pro': {
    contextWindowTokens: 1_000_000,
    contextCompaction: {
      softThreshold: 980_000,
      hardThreshold: 990_000
    },
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: ['text']
  },
  'deepseek-v4-flash': {
    aliases: ['deepseek-chat', 'deepseek-reasoner'],
    contextWindowTokens: 1_000_000,
    contextCompaction: {
      softThreshold: 980_000,
      hardThreshold: 990_000
    },
    inputModalities: ['text'],
    outputModalities: ['text'],
    supportsToolCalling: true,
    messageParts: ['text']
  }
}

type MagicPocketLogStream = 'stdout' | 'stderr' | 'lifecycle'
type MagicPocketChildLogCapture = {
  captureStdout: (chunk: Buffer | string) => void
  captureStderr: (chunk: Buffer | string) => void
  logLifecycle: (message: string) => void
  close: () => Promise<void>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function appendTail(current: string, nextChunk: string, maxChars = STDERR_TAIL_MAX_CHARS): string {
  const combined = `${current}${nextChunk}`
  return combined.length > maxChars ? combined.slice(-maxChars) : combined
}

function formatMagicPocketLogLine(
  stream: MagicPocketLogStream,
  pid: number | undefined,
  message: string
): string {
  const stamp = new Date().toISOString()
  const pidLabel = typeof pid === 'number' ? `magicpocket pid=${pid}` : 'magicpocket'
  return `[${stamp}] [${stream.toUpperCase()}] [${pidLabel}] ${message}\n`
}

function normalizeCapturedChunk(chunk: Buffer | string): string {
  return String(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function createMagicPocketChildLogCapture(pid: number | undefined): MagicPocketChildLogCapture {
  let stdoutRemainder = ''
  let stderrRemainder = ''
  let closed = false
  let pending = Promise.resolve()

  const writeLine = (stream: MagicPocketLogStream, message: string): void => {
    pending = pending
      .then(() => appendManagedLogLine('magicpocket', formatMagicPocketLogLine(stream, pid, message)))
      .catch(() => undefined)
  }

  const captureChunk = (
    stream: 'stdout' | 'stderr',
    chunk: Buffer | string
  ): void => {
    if (closed) return
    const text = normalizeCapturedChunk(chunk)
    const buffered = `${stream === 'stdout' ? stdoutRemainder : stderrRemainder}${text}`
    const parts = buffered.split('\n')
    const remainder = parts.pop() ?? ''
    if (stream === 'stdout') {
      stdoutRemainder = remainder
    } else {
      stderrRemainder = remainder
    }
    for (const part of parts) {
      writeLine(stream, part)
    }
  }

  return {
    captureStdout(chunk) {
      captureChunk('stdout', chunk)
    },
    captureStderr(chunk) {
      captureChunk('stderr', chunk)
    },
    logLifecycle(message) {
      if (closed) return
      writeLine('lifecycle', message)
    },
    async close() {
      if (closed) {
        await pending
        return
      }
      closed = true
      if (stdoutRemainder) {
        writeLine('stdout', stdoutRemainder)
        stdoutRemainder = ''
      }
      if (stderrRemainder) {
        writeLine('stderr', stderrRemainder)
        stderrRemainder = ''
      }
      await pending
    }
  }
}

function appRoot(): string {
  return app.isPackaged
    ? app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
    : app.getAppPath()
}

function resolveNodeScriptCommand(command: string): string {
  if (command !== process.execPath) return command
  if (process.platform !== 'darwin') return command
  return resolveClawScheduleMcpCommand({
    appPath: app.getAppPath(),
    execPath: command,
    isPackaged: app.isPackaged
  })
}

export function resolveMagicPocketDataDir(runtime: { dataDir: string }): string {
  const trimmed = runtime.dataDir?.trim()
  if (trimmed) return expandHomePath(trimmed)
  return defaultMagicPocketDataDir()
}

function expandHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) {
    return join(homedir(), path.slice(2).replace(/\\/g, '/'))
  }
  return path
}

export function isMagicPocketChildRunning(): boolean {
  return child !== null && child.exitCode === null && child.signalCode === null
}

function isCurrentMagicPocketChildPid(pid: number): boolean {
  return Boolean(child?.pid === pid && isMagicPocketChildRunning())
}

/**
 * Resolve once any in-flight magicpocket launch has settled — whether it became
 * ready or failed. The settings/MCP-apply paths use this to avoid
 * SIGTERM-ing a child that is still inside its (deliberately generous)
 * startup window: interrupting a slow-but-healthy boot only restarts the
 * clock and is what turns one slow start into the #544 restart storm.
 *
 * Deadlock-safe by construction: `magicpocketStartPromise` is only set once a launch
 * has already passed the settings-apply gate, so an apply that awaits it can
 * never be the thing that launch is itself waiting on.
 */
export function waitForMagicPocketStartupSettled(): Promise<void> {
  return magicpocketStartPromise ? magicpocketStartPromise.catch(() => undefined) : Promise.resolve()
}

export function startMagicPocketChild(settings: AppSettingsV1): Promise<void> {
  if (magicpocketStartPromise) return magicpocketStartPromise
  const runtime = resolveMagicPocketRuntimeSettings(settings)
  if (isMagicPocketChildRunning()) return Promise.resolve()
  if (!runtime.autoStart) return Promise.resolve()
  let promise: Promise<void>
  promise = startMagicPocketChildOnce(settings, runtime).finally(() => {
    if (magicpocketStartPromise === promise) magicpocketStartPromise = null
  })
  magicpocketStartPromise = promise
  return promise
}

async function startMagicPocketChildOnce(
  settings: AppSettingsV1,
  runtime: MagicPocketRuntimeSettingsV1
): Promise<void> {
  if (childLogCapture) {
    await childLogCapture.close()
    childLogCapture = null
  }
  const root = appRoot()
  const resolution = resolveMagicPocketExecutable(root, runtime.binaryPath)
  if (resolution.command === process.execPath && !existsSync(resolution.args[0])) {
    throw new Error(
      `MagicPocket runtime build is missing at ${resolution.args[0]}. Run \`npm run build:magicpocket\` before starting the GUI.`
    )
  }
  const dataDir = resolveMagicPocketDataDir(runtime)
  await syncGuiManagedMagicPocketConfig(dataDir, runtime, {
    scheduleMcp: {
      settings,
      launch: {
        appPath: app.getAppPath(),
        execPath: process.execPath,
        isPackaged: app.isPackaged
      }
    }
  })
  lastResolvedBinary = resolution.command === process.execPath
    ? resolution.args.join(' ')
    : resolution.command
  const args = buildMagicPocketServeArgs({
    resolution,
    host: '127.0.0.1',
    port: runtime.port,
    dataDir,
    baseUrl: runtime.baseUrl,
    modelProxyUrl: resolveModelProviderProxyUrl(settings),
    endpointFormat: runtime.endpointFormat,
    model: runtime.model,
    approvalPolicy: runtime.approvalPolicy,
    sandboxMode: runtime.sandboxMode,
    tokenEconomyMode: runtime.tokenEconomyMode,
    insecure: isMagicPocketRuntimeInsecure(runtime)
  })
  // On macOS, libnut links AppKit and calls `[NSApplication sharedApplication]`
  // on its first screen-grab/mouse/keyboard call. That promotes a pure-Node
  // (ELECTRON_RUN_AS_NODE) child to a regular Cocoa app and a second MagicPocket icon
  // appears in the Dock. In dev, when computer-use is enabled, we instead
  // spawn magicpocket as a real Electron instance so it can call `app.dock.hide()`
  // itself (see magicpocket/src/cli/serve-entry.ts). Packaged .app executables are not
  // generic Electron script runners: passing serve-entry.js to the main app
  // launches the GUI process instead of magicpocket serve, so packaged builds must use
  // the Node helper path even when computer-use is enabled.
  const runAsElectron = shouldRunMagicPocketServeAsElectronChild({
    platform: process.platform,
    isPackaged: app.isPackaged,
    computerUseEnabled: runtime.computerUse?.enabled === true
  })
  const command = runAsElectron ? resolution.command : resolveNodeScriptCommand(resolution.command)
  // When the active provider is Codex, runtime.apiKey holds JSON-encoded OAuth
  // credentials; unwrap to the bare access token so the default client sends a
  // valid Bearer (the Codex headers are written to serve.headers in config).
  const defaultClientApiKey = resolveCodexOAuthApiKey(runtime.apiKey).apiKey
  // When the runtime's own (default) provider is the Claude subscription, tell
  // the runtime so its dispatch routes default-provider turns (thread.providerId
  // absent or equal to it) to the embedded SDK instead of the HTTP default.
  const activeProviderKind = (getModelProviderSettings(settings).providers as ModelProviderProfileV1[]).find(
    (provider) => provider.id?.trim() === getMagicPocketRuntimeSettings(settings).providerId.trim()
  )?.kind
  // Point the runtime at the on-demand Claude Code binary (the ~222MB binary is
  // not bundled; it's downloaded into userData). Absent in dev when it's still
  // resolvable from magicpocket/node_modules — the SDK auto-resolves it there.
  const claudeBinary = resolveClaudeBinary(app.getPath('userData'), [join(appRoot(), 'magicpocket')])
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    KUN_RUNTIME_TOKEN: runtime.runtimeToken,
    DEEPSEEK_API_KEY: defaultClientApiKey || process.env.DEEPSEEK_API_KEY || '',
    ...(activeProviderKind === 'agent-sdk' ? { KUN_RUNTIME_PROVIDER_KIND: 'agent-sdk' } : {}),
    ...(claudeBinary ? { KUN_CLAUDE_BINARY: claudeBinary } : {})
  }
  if (!runAsElectron) childEnv.ELECTRON_RUN_AS_NODE = '1'
  else delete childEnv.ELECTRON_RUN_AS_NODE
  child = spawn(command, args, {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  })
  const startedChild = child
  childPort = runtime.port
  const startedLogCapture = createMagicPocketChildLogCapture(startedChild.pid)
  childLogCapture = startedLogCapture
  childStderrTail = ''
  startedLogCapture.logLifecycle(`spawned on port ${runtime.port} using data dir ${dataDir}`)
  startedChild.stdout?.on('data', startedLogCapture.captureStdout)
  startedChild.stderr?.on('data', (chunk: Buffer | string) => {
    childStderrTail = appendTail(childStderrTail, normalizeCapturedChunk(chunk))
    startedLogCapture.captureStderr(chunk)
  })
  child.on('exit', (code, signal) => {
    startedLogCapture.logLifecycle(
      signal
        ? `exited with signal ${signal}`
        : `exited with code ${code ?? 'unknown'}`
    )
    void startedLogCapture.close()
    if (child === startedChild) {
      child = null
      childPort = null
    }
    if (readyChildren.has(startedChild) && !intentionalStops.has(startedChild)) {
      onUnexpectedMagicPocketExit?.({
        code: code ?? null,
        signal: signal ?? null,
        stderrTail: childStderrTail
      })
    }
  })
  child.on('error', (error) => {
    startedLogCapture.logLifecycle(
      `process error: ${error instanceof Error ? error.message : String(error)}`
    )
  })
  try {
    await waitForMagicPocketStartup(startedChild, runtime.port)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    startedLogCapture.logLifecycle(`startup failed before ready: ${message}`)
    if (child === startedChild) {
      await stopMagicPocketChildAndWait()
    }
    throw error
  }
  readyChildren.add(startedChild)
  startedLogCapture.logLifecycle(`ready marker received on port ${runtime.port}`)
}

export async function syncGuiManagedMagicPocketConfig(
  dataDir: string,
  runtime: Pick<
    MagicPocketRuntimeSettingsV1,
    | 'apiKey'
    | 'mcpSearch'
    | 'tokenEconomy'
    | 'toolOutputLimits'
    | 'storage'
    | 'contextCompaction'
    | 'runtimeTuning'
    | 'imageGeneration'
    | 'textToSpeech'
    | 'musicGeneration'
    | 'videoGeneration'
    | 'computerUse'
    | 'modelProfiles'
    | 'memoryEnabled'
    | 'instructions'
    | 'quality'
    | 'subagents'
    | 'smallModel'
    | 'smallModelProviderId'
    | 'titleModel'
    | 'titleProviderId'
    | 'summaryModel'
    | 'summaryProviderId'
    | 'codeReviewModel'
    | 'codeReviewProviderId'
  >,
  options?: {
    scheduleMcp?: {
      settings: AppSettingsV1
      launch: ClawScheduleMcpLaunchConfig
    }
    mcpConfigPath?: string
  }
): Promise<MagicPocketConfig> {
  const configPath = join(dataDir, 'config.json')
  const existing = sanitizeMagicPocketConfigSections(await readJsonObjectIfExists(configPath))
  const importedMcpServers = await readGuiManagedMcpServers(
    options?.mcpConfigPath ?? resolveMagicPocketMcpJsonPath()
  )
  const hasImportedEnabledMcpServer = Object.values(importedMcpServers).some(
    (server) => objectValue(server).enabled !== false
  )

  const serve = objectValue(existing?.serve)
  const existingTokenEconomy = objectValue(serve.tokenEconomy)
  const existingContextCompaction = objectValue(existing?.contextCompaction)
  const existingModels = objectValue(existing?.models)
  const existingRuntimeTuning = objectValue(existing?.runtime)
  const existingQuality = objectValue(existing?.quality)
  const capabilities = objectValue(existing?.capabilities)
  const mcp = objectValue(capabilities.mcp)
  const search = objectValue(mcp.search)
  const attachments = objectValue(capabilities.attachments)
  const memory = objectValue(capabilities.memory)
  const instructions = objectValue(capabilities.instructions)
  const web = objectValue(capabilities.web)
  const skills = objectValue(capabilities.skills)
  const imageGen = objectValue(capabilities.imageGen)
  const speechGen = objectValue(capabilities.speechGen)
  const musicGen = objectValue(capabilities.musicGen)
  const videoGen = objectValue(capabilities.videoGen)
  const computerUse = objectValue(capabilities.computerUse)
  const storage = storageConfigForRuntime(runtime.storage)
  const mcpSearch = runtime.mcpSearch
  const skillCapability = await skillCapabilityConfigForRuntime(skills, options?.scheduleMcp?.settings)
  const workflowHookEntries = buildWorkflowHookEntries(options?.scheduleMcp?.settings.workflow)
  // Mirror every configured GUI provider (apiKey + baseUrl + endpointFormat)
  // into the magicpocket config so the runtime's MultiProviderModelClient can route
  // per-request `providerId` overrides (workflow / scheduled task / IM
  // bridge) without restart. Empty when no GUI settings are reachable, in
  // which case the runtime stays single-provider.
  const providers = options?.scheduleMcp?.settings
    ? providersConfigForRuntime(options.scheduleMcp.settings)
    : undefined
  // When the active provider is Codex, emit its required headers as the default
  // client's serve.headers (the bare access token goes to DEEPSEEK_API_KEY).
  // Always set the key explicitly (undefined clears it) so switching away from
  // Codex doesn't leave stale headers carried over by the `...serve` spread.
  const defaultClientHeaders = resolveCodexOAuthApiKey(runtime.apiKey).headers
  const next = {
    serve: {
      ...serve,
      storage,
      tokenEconomy: tokenEconomyConfigForRuntime(runtime.tokenEconomy, existingTokenEconomy),
      toolOutputLimits: toolOutputLimitsConfigForRuntime(runtime.toolOutputLimits),
      headers: defaultClientHeaders,
      ...(providers && Object.keys(providers).length ? { providers } : {})
    },
    models: modelConfigForRuntime(existingModels, runtime.modelProfiles),
    contextCompaction: contextCompactionConfigForRuntime(runtime.contextCompaction, existingContextCompaction),
    runtime: runtimeTuningConfigForRuntime(runtime.runtimeTuning, existingRuntimeTuning),
    quality: qualityConfigForRuntime(runtime.quality, existingQuality),
    ...(() => {
      const roles = rolesConfigForRuntime(runtime)
      return Object.keys(roles).length ? { roles } : {}
    })(),
    capabilities: {
      ...capabilities,
      attachments: {
        ...attachments,
        enabled: attachments.enabled === false ? false : true
      },
      web: {
        ...web,
        enabled: web.enabled === false ? false : true,
        fetchEnabled: web.fetchEnabled === false ? false : true
      },
      skills: skillCapability,
      imageGen: imageGenConfigForRuntime(runtime.imageGeneration, imageGen),
      speechGen: speechGenConfigForRuntime(runtime.textToSpeech, speechGen),
      musicGen: musicGenConfigForRuntime(runtime.musicGeneration, musicGen),
      videoGen: videoGenConfigForRuntime(runtime.videoGeneration, videoGen),
      computerUse: computerUseConfigForRuntime(runtime.computerUse, computerUse),
      memory: {
        ...memory,
        enabled: runtime.memoryEnabled
      },
      instructions: {
        ...instructions,
        enabled: runtime.instructions?.enabled ?? true
      },
      subagents: subagentProfilesForRuntime(runtime.subagents ?? { enabled: true, profiles: [] }),
      mcp: {
        ...mcp,
        ...(options?.scheduleMcp || mcpSearch.enabled || hasImportedEnabledMcpServer
          ? { enabled: mcp.enabled === false ? false : true }
          : {}),
        servers: {
          ...objectValue(mcp.servers),
          ...importedMcpServers,
          ...(options?.scheduleMcp
          ? {
              [GUI_SCHEDULE_MCP_SERVER_NAME]: buildGuiScheduleMagicPocketMcpServer(
                options.scheduleMcp.settings,
                options.scheduleMcp.launch
              )
            }
          : {})
        },
        search: {
          ...search,
          enabled: mcpSearch.enabled,
          mode: mcpSearch.mode,
          autoThresholdToolCount: mcpSearch.autoThresholdToolCount,
          topKDefault: mcpSearch.topKDefault,
          topKMax: mcpSearch.topKMax,
          minScore: mcpSearch.minScore
        }
      }
    },
    ...(workflowHookEntries.length ? { hooks: workflowHookEntries } : {})
  }
  const parsedNext = MagicPocketConfigSchema.safeParse(next)
  if (!parsedNext.success) {
    throw new Error(
      `Refusing to write invalid GUI-managed MagicPocket config at ${configPath}: ${JSON.stringify(parsedNext.error.issues, null, 2)}`
    )
  }
  const nextText = `${JSON.stringify(next, null, 2)}\n`
  if (existing && nextText === `${JSON.stringify(existing, null, 2)}\n`) return parsedNext.data
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, nextText, 'utf8')
  return parsedNext.data
}

function buildGuiScheduleMagicPocketMcpServer(
  settings: AppSettingsV1,
  launch: ClawScheduleMcpLaunchConfig
): Record<string, unknown> {
  return {
    enabled: true,
    transport: 'stdio',
    command: resolveClawScheduleMcpCommand(launch),
    args: buildClawScheduleMcpArgs(settings, launch),
    env: {
      ELECTRON_RUN_AS_NODE: '1'
    },
    trustScope: 'user',
    timeoutMs: GUI_SCHEDULE_MCP_TIMEOUT_MS
  }
}

async function skillCapabilityConfigForRuntime(
  existing: Record<string, unknown>,
  settings?: AppSettingsV1
): Promise<Record<string, unknown>> {
  // Carry over only the roots a user added by hand to the MagicPocket config file.
  // Drop previously-persisted GUI-managed roots so disabling a directory in
  // settings actually removes it — otherwise a toggled-off root would stick
  // around forever via `existing.roots`.
  // GUI-managed roots are dropped from the carried-over set and rebuilt fresh
  // below. Besides the common/extra candidates, auto-discovered Codex plugin
  // caches count as managed too — otherwise old version directories from a
  // plugin upgrade stay in `roots` forever (#392).
  const managed = guiSkillManagedComparablePaths(settings)
  const manualExisting = stringArrayValue(existing.roots)
    .map(normalizeSkillRootPath)
    .filter((path) =>
      path.length > 0 &&
      !managed.has(comparableSkillRootPath(path)) &&
      !isCodexPluginCacheRoot(path))
  const manualGlobalExisting = stringArrayValue(existing.globalRoots)
    .map(normalizeSkillRootPath)
    .filter((path) =>
      path.length > 0 &&
      !managed.has(comparableSkillRootPath(path)) &&
      !isCodexPluginCacheRoot(path))
  const guiRoots = await guiSkillRootsForRuntime(settings)
  const roots = uniqueStrings([
    ...manualExisting,
    ...guiRoots.filter((root) => root.scope === 'project').map((root) => root.path)
  ])
  const globalRoots = uniqueStrings([
    ...manualGlobalExisting,
    ...guiRoots.filter((root) => root.scope === 'global').map((root) => root.path)
  ])
  return {
    ...existing,
    // Auto-enable once we discover skill roots. There is no user-facing skills
    // enable toggle, so a persisted `enabled: false` is only ever the schema
    // default leaking onto disk — it must not permanently suppress discovered
    // skills. An explicit `true` still forces on even with no roots.
    enabled: roots.length > 0 || globalRoots.length > 0 || existing.enabled === true,
    roots,
    workspaceRoots: guiSkillWorkspaceRootsForRuntime(settings),
    // #149: Pass global skill roots from settings (e.g. ~/.magicpocket/skills)
    globalRoots,
    // Skills the user disabled in the GUI. Forwarded so the runtime drops them
    // from discovery — without this they stay loadable via load_skill and keep
    // appearing in the catalog despite the GUI toggle (#392).
    disabledIds: settings?.disabledSkillIds ?? stringArrayValue(existing.disabledIds),
    legacySkillMd: existing.legacySkillMd === false ? false : true
  }
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

async function readGuiManagedMcpServers(path: string): Promise<Record<string, Record<string, unknown>>> {
  const parsed = await readJsonObjectIfExists(path)
  if (!parsed) return {}

  const rawServers = mcpServersFromGuiConfig(parsed)
  const normalizedEntries = Object.entries(rawServers)
    .map(([serverId, server]) => {
      const normalized = normalizeGuiManagedMcpServer(server)
      return normalized ? [serverId, normalized] as const : null
    })
    .filter((entry): entry is readonly [string, Record<string, unknown>] => entry !== null)

  return Object.fromEntries(normalizedEntries)
}

function mcpServersFromGuiConfig(config: Record<string, unknown>): Record<string, unknown> {
  const directServers = objectValue(config.servers)
  if (Object.keys(directServers).length > 0) return directServers

  const capabilities = objectValue(config.capabilities)
  const mcp = objectValue(capabilities.mcp)
  return objectValue(mcp.servers)
}

function normalizeGuiManagedMcpServer(server: unknown): Record<string, unknown> | null {
  const raw = objectValue(server)
  const command = scalarStringValue(raw.command)
  const cwd = scalarStringValue(raw.cwd)?.trim()
  const url = scalarStringValue(raw.url)
  const args = stringArrayValue(raw.args)
  const headers = stringRecordValue(raw.headers)
  const env = stringRecordValue(raw.env)
  const oauth = objectValue(raw.oauth)
  const transport = normalizeMcpTransport(raw.transport, command, url)
  if (!transport) return null

  const workspaceRoots = stringArrayValue(raw.workspaceRoots)
  const trustedWorkspaceRoots = stringArrayValue(raw.trustedWorkspaceRoots)
  const trustScope = normalizeMcpTrustScope(raw.trustScope, trustedWorkspaceRoots)
  if (trustScope === 'workspace' && trustedWorkspaceRoots.length === 0) return null

  const timeoutMs = positiveIntegerValue(raw.timeoutMs)
  const parsed = McpServerConfig.safeParse({
    enabled: raw.enabled === false || raw.disabled === true ? false : true,
    transport,
    ...(command ? { command } : {}),
    ...(transport === 'stdio' && cwd ? { cwd } : {}),
    ...(args.length > 0 ? { args } : {}),
    ...(url ? { url } : {}),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(workspaceRoots.length > 0 ? { workspaceRoots } : {}),
    ...(Object.keys(oauth).length > 0 ? { oauth } : {}),
    trustScope,
    ...(trustedWorkspaceRoots.length > 0 ? { trustedWorkspaceRoots } : {}),
    ...(timeoutMs ? { timeoutMs } : {})
  })

  return parsed.success ? objectValue(parsed.data) : null
}

function normalizeMcpTransport(
  value: unknown,
  command: string | undefined,
  url: string | undefined
): 'stdio' | 'streamable-http' | 'sse' | null {
  if (value === 'stdio' || value === 'streamable-http' || value === 'sse') return value
  if (command) return 'stdio'
  if (url) return 'streamable-http'
  return null
}

function normalizeMcpTrustScope(
  value: unknown,
  trustedWorkspaceRoots: string[]
): 'user' | 'workspace' {
  if (value === 'user' || value === 'workspace') return value
  return trustedWorkspaceRoots.length > 0 ? 'workspace' : 'user'
}

function scalarStringValue(value: unknown): string | undefined {
  return typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : undefined
}

function stringRecordValue(value: unknown): Record<string, string> {
  const record = objectValue(value)
  const next: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    const normalized = scalarStringValue(item)
    if (normalized !== undefined) next[key] = normalized
  }
  return next
}

function positiveIntegerValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function modelConfigForRuntime(
  existing: Record<string, unknown>,
  guiModelProfiles: Record<string, ModelProviderModelProfileV1> = {}
): Record<string, unknown> {
  const existingProfiles = objectValue(existing.profiles)
  const guiProfiles = modelConfigProfilesFromProviderProfiles(guiModelProfiles)
  const profileDefaults = {
    ...DEFAULT_KUN_MODEL_PROFILES,
    ...guiProfiles
  }
  const profiles: Record<string, unknown> = {}
  for (const modelId of new Set([
    ...Object.keys(profileDefaults),
    ...Object.keys(existingProfiles)
  ])) {
    const defaultProfile = objectValue(profileDefaults[modelId])
    const existingProfile = objectValue(existingProfiles[modelId])
    const guiProfile = objectValue(guiProfiles[modelId])
    const baseProfile = Object.prototype.hasOwnProperty.call(guiProfiles, modelId)
      ? { ...defaultProfile, ...guiProfile }
      : { ...defaultProfile, ...existingProfile }
    profiles[modelId] = {
      ...baseProfile,
      contextCompaction: {
        ...objectValue(defaultProfile.contextCompaction),
        ...objectValue(existingProfile.contextCompaction),
        ...objectValue(guiProfile.contextCompaction)
      }
    }
  }
  return {
    ...existing,
    profiles
  }
}

function modelConfigProfilesFromProviderProfiles(
  profiles: Record<string, ModelProviderModelProfileV1>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [modelId, profile] of Object.entries(profiles)) {
    const trimmed = modelId.trim()
    if (!trimmed) continue
    out[trimmed] = {
      ...(profile.aliases?.length ? { aliases: profile.aliases } : {}),
      ...(profile.contextWindowTokens ? { contextWindowTokens: profile.contextWindowTokens } : {}),
      ...(profile.maxOutputTokens ? { maxOutputTokens: profile.maxOutputTokens } : {}),
      inputModalities: profile.inputModalities,
      outputModalities: profile.outputModalities,
      supportsToolCalling: profile.supportsToolCalling,
      messageParts: profile.messageParts,
      ...(profile.reasoning ? { reasoning: profile.reasoning } : {}),
      ...(profile.endpointFormat ? { endpointFormat: profile.endpointFormat } : {})
    }
  }
  return out
}

/**
 * Mirror every configured GUI provider (apiKey + baseUrl + endpointFormat
 * + per-provider proxy) into the magicpocket config's `serve.providers` map so the
 * runtime's MultiProviderModelClient can route a workflow / scheduled-task
 * / IM-bridge turn to a non-runtime provider per request. Skips entries
 * whose baseUrl is empty — those couldn't be reached anyway.
 *
 * The magicpocket runtime's own bound provider is included too; the wrapper's
 * default client handles it identically, so duplicate entries are
 * idempotent.
 */
function providersConfigForRuntime(settings: AppSettingsV1): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  const runtimeProviderId = getMagicPocketRuntimeSettings(settings).providerId.trim()
  const proxyUrl = resolveModelProviderProxyUrl(settings)
  for (const provider of getModelProviderSettings(settings).providers as ModelProviderProfileV1[]) {
    const id = provider.id?.trim()
    const baseUrl = provider.baseUrl?.trim()
    const isAgentSdk = provider.kind === 'agent-sdk'
    if (!id) continue
    // agent-sdk providers carry no usable HTTP endpoint; everyone else needs one.
    if (!baseUrl && !isAgentSdk) continue
    // The runtime's own provider is already wired via the default client
    // (DEEPSEEK_API_KEY + serve.headers); we normally skip it here — EXCEPT
    // agent-sdk: its turns must be routable to the embedded SDK via
    // `serve.providers`, otherwise they fall back to the HTTP default client and
    // 401 on api.anthropic.com (invalid x-api-key).
    if (id === runtimeProviderId && !isAgentSdk) continue
    const rawApiKey = provider.apiKey?.trim() ?? ''
    // Codex stores JSON OAuth creds in apiKey; unwrap to the bare token + the
    // headers the backend requires. Plain keys (and agent-sdk tokens) pass through.
    const resolved = resolveCodexOAuthApiKey(rawApiKey)
    out[id] = {
      apiKey: resolved.apiKey,
      ...(baseUrl ? { baseUrl } : {}),
      ...(provider.kind ? { kind: provider.kind } : {}),
      ...(provider.endpointFormat ? { endpointFormat: provider.endpointFormat } : {}),
      ...(proxyUrl ? { modelProxyUrl: proxyUrl } : {}),
      ...(resolved.headers ? { headers: resolved.headers } : {})
    }
  }
  return out
}

function tokenEconomyConfigForRuntime(
  tokenEconomy: Pick<MagicPocketRuntimeSettingsV1, 'tokenEconomy'>['tokenEconomy'] | undefined,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const defaults = defaultMagicPocketTokenEconomySettings()
  const normalized = {
    ...defaults,
    ...(tokenEconomy ?? {}),
    historyHygiene: {
      ...defaults.historyHygiene,
      ...(tokenEconomy?.historyHygiene ?? {})
    }
  }
  const existingHistoryHygiene = objectValue(existing.historyHygiene)
  return {
    ...existing,
    enabled: normalized.enabled,
    compressToolDescriptions: normalized.compressToolDescriptions,
    compressToolResults: normalized.compressToolResults,
    conciseResponses: normalized.conciseResponses,
    historyHygiene: {
      ...existingHistoryHygiene,
      maxToolResultLines: normalized.historyHygiene.maxToolResultLines,
      maxToolResultBytes: normalized.historyHygiene.maxToolResultBytes,
      maxToolResultTokens: normalized.historyHygiene.maxToolResultTokens,
      maxToolArgumentStringBytes: normalized.historyHygiene.maxToolArgumentStringBytes,
      maxToolArgumentStringTokens: normalized.historyHygiene.maxToolArgumentStringTokens,
      maxArrayItems: normalized.historyHygiene.maxArrayItems
    }
  }
}

function toolOutputLimitsConfigForRuntime(
  toolOutputLimits: Pick<MagicPocketRuntimeSettingsV1, 'toolOutputLimits'>['toolOutputLimits'] | undefined
): Record<string, unknown> {
  return {
    maxLines: toolOutputLimits?.maxLines,
    maxBytes: toolOutputLimits?.maxBytes
  }
}

function storageConfigForRuntime(
  storage: Pick<MagicPocketRuntimeSettingsV1, 'storage'>['storage']
): Record<string, unknown> {
  const sqlitePath = storage.sqlitePath.trim()
  return {
    backend: storage.backend,
    ...(sqlitePath ? { sqlitePath } : {})
  }
}

function contextCompactionConfigForRuntime(
  contextCompaction: Pick<MagicPocketRuntimeSettingsV1, 'contextCompaction'>['contextCompaction'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existing,
    defaultSoftThreshold: contextCompaction.defaultSoftThreshold,
    defaultHardThreshold: contextCompaction.defaultHardThreshold,
    summaryMode: contextCompaction.summaryMode,
    summaryTimeoutMs: contextCompaction.summaryTimeoutMs,
    summaryMaxTokens: contextCompaction.summaryMaxTokens,
    summaryInputMaxBytes: contextCompaction.summaryInputMaxBytes,
    ...(contextCompaction.summaryModel ? { summaryModel: contextCompaction.summaryModel } : {}),
    ...(contextCompaction.summaryProviderId ? { summaryProviderId: contextCompaction.summaryProviderId } : {})
  }
}

/**
 * Build the magicpocket `roles` config (internal-LLM model routing) from GUI settings.
 * Only non-empty fields are emitted so the strict RolesConfigSchema accepts the
 * result and a cleared field removes itself from config.json.
 */
function rolesConfigForRuntime(
  runtime: Pick<
    MagicPocketRuntimeSettingsV1,
    | 'smallModel'
    | 'smallModelProviderId'
    | 'titleModel'
    | 'titleProviderId'
    | 'summaryModel'
    | 'summaryProviderId'
    | 'codeReviewModel'
    | 'codeReviewProviderId'
    | 'titleReasoningEffort'
    | 'summaryReasoningEffort'
    | 'codeReviewReasoningEffort'
  >
): Record<string, string> {
  const out: Record<string, string> = {}
  const put = (key: string, value: string | undefined): void => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed) out[key] = trimmed
  }
  put('smallModel', runtime.smallModel)
  put('smallModelProviderId', runtime.smallModelProviderId)
  put('titleModel', runtime.titleModel)
  put('titleProviderId', runtime.titleProviderId)
  put('summaryModel', runtime.summaryModel)
  put('summaryProviderId', runtime.summaryProviderId)
  put('codeReviewModel', runtime.codeReviewModel)
  put('codeReviewProviderId', runtime.codeReviewProviderId)
  // Per-role reasoning depth. 'off' is the default and is intentionally omitted
  // by the normalizer, so only an opted-in level (low/medium/high/max) is emitted.
  put('titleReasoningEffort', runtime.titleReasoningEffort)
  put('summaryReasoningEffort', runtime.summaryReasoningEffort)
  put('codeReviewReasoningEffort', runtime.codeReviewReasoningEffort)
  return out
}

function computerUseConfigForRuntime(
  computerUse: Pick<MagicPocketRuntimeSettingsV1, 'computerUse'>['computerUse'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  // GUI owns enabled/mode/limits. `existing` was already passed through the
  // strict ComputerUseCapabilityConfig sanitizer, so unknown hand-edited keys
  // were dropped before reaching here; the spread only carries known fields.
  return {
    ...existing,
    enabled: computerUse.enabled,
    mode: computerUse.mode,
    maxImageDimension: computerUse.maxImageDimension,
    maxActionsPerTurn: computerUse.maxActionsPerTurn
  }
}

function imageGenConfigForRuntime(
  imageGeneration: Pick<MagicPocketRuntimeSettingsV1, 'imageGeneration'>['imageGeneration'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  // GUI settings own these fields: cleared values must be removed from the
  // config (the zod schema rejects empty strings), while unknown hand-edited
  // keys like maxReferenceImages are preserved via the spread.
  const next: Record<string, unknown> = {
    ...existing,
    enabled: imageGeneration.enabled,
    timeoutMs: imageGeneration.timeoutMs
  }
  const resolvedApiKey = resolveCodexOAuthApiKey(imageGeneration.apiKey)
  const fields = {
    protocol: imageGeneration.protocol,
    baseUrl: imageGeneration.baseUrl,
    apiKey: resolvedApiKey.apiKey,
    model: imageGeneration.model,
    defaultSize: imageGeneration.defaultSize,
    quality: imageGeneration.quality
  }
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
  }
  if (resolvedApiKey.headers) next.headers = resolvedApiKey.headers
  else delete next.headers
  return next
}

function speechGenConfigForRuntime(
  textToSpeech: Pick<MagicPocketRuntimeSettingsV1, 'textToSpeech'>['textToSpeech'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existing,
    enabled: textToSpeech.enabled,
    timeoutMs: textToSpeech.timeoutMs,
    format: textToSpeech.format
  }
  const fields = {
    protocol: textToSpeech.protocol,
    baseUrl: textToSpeech.baseUrl,
    apiKey: textToSpeech.apiKey,
    model: textToSpeech.model,
    voice: textToSpeech.voice
  }
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
  }
  return next
}

function musicGenConfigForRuntime(
  musicGeneration: Pick<MagicPocketRuntimeSettingsV1, 'musicGeneration'>['musicGeneration'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existing,
    enabled: musicGeneration.enabled,
    timeoutMs: musicGeneration.timeoutMs,
    format: musicGeneration.format
  }
  const fields = {
    protocol: musicGeneration.protocol,
    baseUrl: musicGeneration.baseUrl,
    apiKey: musicGeneration.apiKey,
    model: musicGeneration.model
  }
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
  }
  return next
}

function videoGenConfigForRuntime(
  videoGeneration: Pick<MagicPocketRuntimeSettingsV1, 'videoGeneration'>['videoGeneration'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existing,
    enabled: videoGeneration.enabled,
    defaultDuration: videoGeneration.defaultDuration,
    timeoutMs: videoGeneration.timeoutMs,
    pollIntervalMs: videoGeneration.pollIntervalMs
  }
  const fields = {
    protocol: videoGeneration.protocol,
    baseUrl: videoGeneration.baseUrl,
    apiKey: videoGeneration.apiKey,
    model: videoGeneration.model,
    defaultResolution: videoGeneration.defaultResolution
  }
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim()
    if (trimmed) next[key] = trimmed
    else delete next[key]
  }
  return next
}

function runtimeTuningConfigForRuntime(
  runtimeTuning: Pick<MagicPocketRuntimeSettingsV1, 'runtimeTuning'>['runtimeTuning'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const existingToolStorm = objectValue(existing.toolStorm)
  const existingToolArgumentRepair = objectValue(existing.toolArgumentRepair)
  return {
    ...existing,
    streamIdleTimeoutMs: runtimeTuning.streamIdleTimeoutMs,
    toolStorm: {
      ...existingToolStorm,
      enabled: runtimeTuning.toolStorm.enabled,
      windowSize: runtimeTuning.toolStorm.windowSize,
      threshold: runtimeTuning.toolStorm.threshold
    },
    toolArgumentRepair: {
      ...existingToolArgumentRepair,
      maxStringBytes: runtimeTuning.toolArgumentRepair.maxStringBytes
    }
  }
}

function qualityConfigForRuntime(
  quality: Pick<MagicPocketRuntimeSettingsV1, 'quality'>['quality'],
  existing: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existing,
    enabled: quality.enabled,
    strictness: quality.strictness,
    ignoreRules: [...quality.ignoreRules],
    ignoreFiles: [...quality.ignoreFiles],
    maxFindings: quality.maxFindings
  }
}

const VALID_PROFILE_REASONING = new Set(['auto', 'low', 'medium', 'high', 'max'])

/**
 * Remove optional fields the runtime schema rejects when blank: empty/whitespace
 * strings (every optional string there is `.min(1)`) and empty arrays. Leaving
 * them in throws on SubagentsCapabilityConfig.parse and stops the runtime from
 * starting; dropping them lets the field fall back to its server default.
 */
function stripBlankProfileFields(profile: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'string' && value.trim() === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    next[key] = value
  }
  return next
}

export function subagentProfilesForRuntime(subagents: MagicPocketSubagentsSettingsV1): SubagentsCapabilityConfig {
  const profiles: Record<string, unknown> = {}
  for (const profile of subagents.profiles) {
    if (!profile.enabled) continue
    const { id: _id, enabled: _enabled, name, reasoningEffort, ...rest } = profile
    // Coerce the per-profile reasoning enum so a hand-edited invalid value can't
    // throw SubagentsCapabilityConfig.parse below ('off'/invalid → omitted).
    const effort = typeof reasoningEffort === 'string' && VALID_PROFILE_REASONING.has(reasoningEffort)
      ? { reasoningEffort }
      : {}
    // Built-in profiles carry an empty `name` (the GUI localizes their display
    // labels rather than storing them), and the user can blank any optional
    // field in the editor. The runtime schema marks every optional string as
    // `.min(1)`, so forwarding an empty string throws and the runtime never
    // connects. Drop blank strings / empty arrays so they fall back to defaults.
    profiles[profile.id] = stripBlankProfileFields({ name, ...rest, ...effort })
  }
  const candidate = {
    // Subagents are a first-class feature with no GUI "enable" toggle; default ON
    // (only an explicit `false` disables) so delegate_task + the built-in profiles
    // (design-reviewer / over-engineering-reviewer) are always offered to the model.
    // maxParallel/maxChildRuns MUST be >=1 or DelegationRuntime can never run a child.
    enabled: subagents.enabled !== false,
    maxParallel: subagents.maxParallel && subagents.maxParallel > 0 ? subagents.maxParallel : 3,
    maxChildRuns: subagents.maxChildRuns && subagents.maxChildRuns > 0 ? subagents.maxChildRuns : 12,
    ...(subagents.defaultToolPolicy ? { defaultToolPolicy: subagents.defaultToolPolicy } : {}),
    ...(subagents.defaultProfile ? { defaultProfile: subagents.defaultProfile } : {}),
    profiles
  }
  // A single malformed profile must never brick the whole runtime connection.
  // If the GUI somehow persisted a value the schema rejects, drop the custom
  // profiles and fall back to a minimal valid block — the runtime still merges
  // in the built-in reviewers, so subagents keep working.
  const parsed = SubagentsCapabilityConfig.safeParse(candidate)
  if (parsed.success) return parsed.data
  void appendManagedLogLine(
    'magicpocket',
    formatMagicPocketLogLine(
      'lifecycle',
      undefined,
      `[settings] dropped invalid subagent profiles: ${JSON.stringify(parsed.error.issues)}`
    )
  )
  return SubagentsCapabilityConfig.parse({
    enabled: candidate.enabled,
    maxParallel: candidate.maxParallel,
    maxChildRuns: candidate.maxChildRuns,
    ...(subagents.defaultToolPolicy ? { defaultToolPolicy: subagents.defaultToolPolicy } : {})
  })
}

async function readJsonObjectIfExists(path: string): Promise<Record<string, unknown> | null> {
  try {
    const text = await readFile(path, 'utf8')
    const parsed = JSON.parse(text) as unknown
    return objectValue(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (error instanceof SyntaxError) {
      // 不静默吞掉 JSON 解析错误：mcp.json 损坏时记录日志，避免所有连接器静默消失却无任何提示
      console.warn(`[magicpocket] failed to parse JSON config at ${path}: ${error.message}`)
      return null
    }
    throw error
  }
}

type SafeParseSchema = {
  safeParse: (value: unknown) =>
    | { success: true; data: unknown }
    | { success: false }
}

function parseMagicPocketConfigSection(
  schema: SafeParseSchema,
  value: unknown
): Record<string, unknown> {
  const parsed = schema.safeParse(objectValue(value))
  return parsed.success ? objectValue(parsed.data) : {}
}

function sanitizeMagicPocketCapabilitiesConfig(value: unknown): Record<string, unknown> {
  const raw = objectValue(value)
  const next: Record<string, unknown> = {}
  if ('mcp' in raw) next.mcp = parseMagicPocketConfigSection(McpCapabilityConfig, raw.mcp)
  if ('web' in raw) next.web = parseMagicPocketConfigSection(WebCapabilityConfig, raw.web)
  if ('instructions' in raw) {
    next.instructions = parseMagicPocketConfigSection(InstructionsCapabilityConfig, raw.instructions)
  }
  if ('skills' in raw) next.skills = parseMagicPocketConfigSection(SkillsCapabilityConfig, raw.skills)
  if ('subagents' in raw) {
    next.subagents = parseMagicPocketConfigSection(SubagentsCapabilityConfig, raw.subagents)
  }
  if ('attachments' in raw) {
    next.attachments = parseMagicPocketConfigSection(AttachmentsCapabilityConfig, raw.attachments)
  }
  if ('memory' in raw) next.memory = parseMagicPocketConfigSection(MemoryCapabilityConfig, raw.memory)
  if ('imageGen' in raw) next.imageGen = parseMagicPocketConfigSection(ImageGenCapabilityConfig, raw.imageGen)
  if ('speechGen' in raw) next.speechGen = parseMagicPocketConfigSection(SpeechGenCapabilityConfig, raw.speechGen)
  if ('musicGen' in raw) next.musicGen = parseMagicPocketConfigSection(MusicGenCapabilityConfig, raw.musicGen)
  if ('videoGen' in raw) next.videoGen = parseMagicPocketConfigSection(VideoGenCapabilityConfig, raw.videoGen)
  if ('computerUse' in raw) {
    next.computerUse = parseMagicPocketConfigSection(ComputerUseCapabilityConfig, raw.computerUse)
  }
  return next
}

/** Validate the GUI-managed `hooks` array (workflow + command entries). Array, not an object. */
function parseMagicPocketHooksSection(value: unknown): unknown[] {
  const parsed = HooksConfigSchema.safeParse(Array.isArray(value) ? value : [])
  return parsed.success ? parsed.data : []
}

/** Build magicpocket `hooks` entries from the GUI's workflow hook triggers (workflow-backed hooks). */
function buildWorkflowHookEntries(workflow: AppSettingsV1['workflow'] | undefined): unknown[] {
  if (!workflow) return []
  const baseUrl = `http://127.0.0.1:${workflow.webhookPort}`
  const secret = workflow.webhookSecret.trim()
  return (workflow.hookTriggers ?? [])
    .filter((trigger) => trigger.enabled && trigger.workflowId)
    .map((trigger) => ({
      phase: trigger.phase,
      ...(trigger.toolNames.length ? { toolNames: trigger.toolNames } : {}),
      workflow: trigger.workflowId,
      mode: trigger.mode,
      baseUrl,
      ...(secret ? { secret } : {}),
      ...(trigger.timeoutMs > 0 ? { timeoutMs: trigger.timeoutMs } : {})
    }))
}

function sanitizeMagicPocketConfigSections(
  existing: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!existing) return null
  const hooks = parseMagicPocketHooksSection(existing.hooks)
  return {
    serve: parseMagicPocketConfigSection(MagicPocketServeConfigSchema, existing.serve),
    models: parseMagicPocketConfigSection(ModelConfigSchema, existing.models),
    contextCompaction: parseMagicPocketConfigSection(
      ContextCompactionConfigSchema,
      existing.contextCompaction
    ),
    runtime: parseMagicPocketConfigSection(RuntimeTuningConfigSchema, existing.runtime),
    quality: parseMagicPocketConfigSection(QualityConfigSchema, existing.quality),
    capabilities: sanitizeMagicPocketCapabilitiesConfig(existing.capabilities),
    ...('roles' in existing
      ? { roles: parseMagicPocketConfigSection(RolesConfigSchema, existing.roles) }
      : {}),
    ...(hooks.length ? { hooks } : {})
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export async function stopMagicPocketChildAndWait(): Promise<void> {
  if (!child) {
    if (childLogCapture) {
      const capture = childLogCapture
      childLogCapture = null
      await capture.close()
    }
    return
  }
  const stoppingChild = child
  intentionalStops.add(stoppingChild)
  const pid = child.pid
  const capture = childLogCapture
  if (stoppingChild.exitCode === null && stoppingChild.signalCode === null) {
    try {
      stoppingChild.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
  const exited = await waitForChildExit(stoppingChild, KUN_STOP_GRACE_MS)
  if (!exited) {
    try {
      if (pid) process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    await waitForChildExit(stoppingChild, KUN_STOP_FORCE_MS)
  }
  if (child === stoppingChild) {
    child = null
    childPort = null
  }
  if (capture) {
    childLogCapture = null
    await capture.close()
  }
}

function waitForChildExit(process: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (process.exitCode !== null || process.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => settle(false), timeoutMs)
    const settle = (exited: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      process.removeListener('exit', onExit)
      process.removeListener('error', onError)
      resolve(exited)
    }
    const onExit = (): void => settle(true)
    const onError = (): void => settle(true)
    process.once('exit', onExit)
    process.once('error', onError)
  })
}

export async function reclaimMagicPocketPort(
  port: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (port <= 0) return { ok: true }
  if (await canBindTcpPort(port, '127.0.0.1')) return { ok: true }
  if (await killStaleMagicPocketOnPort(port) && await canBindTcpPort(port, '127.0.0.1')) {
    return { ok: true }
  }
  return { ok: false, message: `port ${port} is in use` }
}

export async function resolveAvailableMagicPocketPort(
  preferredPort: number
): Promise<{ port: number; changed: boolean; message?: string }> {
  if (preferredPort > 0) {
    // A temporarily unresponsive managed child still owns its configured
    // endpoint. Moving settings to another port here strands the live child
    // and makes every concurrent request launch/probe a port with no server.
    if (isMagicPocketChildRunning() && childPort === preferredPort) {
      return { port: preferredPort, changed: false }
    }
    if (await canBindTcpPort(preferredPort, '127.0.0.1')) {
      return { port: preferredPort, changed: false }
    }
    // Prefer reclaiming the configured port from a stale magicpocket left by a
    // crashed previous app run over silently moving to a new port.
    if (
      await killStaleMagicPocketOnPort(preferredPort) &&
      await canBindTcpPort(preferredPort, '127.0.0.1')
    ) {
      return { port: preferredPort, changed: false }
    }
    for (let port = preferredPort + 1; port <= MAX_TCP_PORT; port += 1) {
      if (await canBindTcpPort(port, '127.0.0.1')) {
        return {
          port,
          changed: true,
          message: `port ${preferredPort} is in use`
        }
      }
    }
  }
  const port = await allocateTcpPort('127.0.0.1')
  return {
    port,
    changed: true,
    ...(preferredPort > 0 ? { message: `port ${preferredPort} is in use` } : {})
  }
}

/**
 * Kill a stale magicpocket serve process from a previous app run that is still
 * holding the configured port. Only processes whose command line looks
 * like our serve entry are touched; anything else keeps the port and we
 * fall back to allocating a different one.
 *
 * Safe by construction on every platform: any failure to positively
 * identify the holder as our own serve-entry leaves it untouched and the
 * caller allocates a different port instead.
 */
async function killStaleMagicPocketOnPort(port: number): Promise<boolean> {
  const pids = await listListeningPidsOnPort(port)
  let reclaimed = false
  for (const pid of pids) {
    if (isCurrentMagicPocketChildPid(pid)) continue
    let command = ''
    try {
      command = await processCommandLine(pid)
    } catch {
      continue
    }
    if (!command.includes('serve-entry')) continue
    void appendManagedLogLine(
      'magicpocket',
      formatMagicPocketLogLine('lifecycle', pid, `killing stale magicpocket process holding port ${port}`)
    )
    if (await terminateStalePid(pid)) reclaimed = true
  }
  return reclaimed
}

/**
 * PIDs listening on `port`, excluding our own process. Uses `lsof` on
 * macOS/Linux and `netstat -ano` on Windows.
 */
async function listListeningPidsOnPort(port: number): Promise<number[]> {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('netstat', ['-ano'], {
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 8 * 1024 * 1024
      })
      return parseListeningPidsFromNetstat(stdout, port)
    } catch {
      return []
    }
  }
  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'])
    return stdout
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)
  } catch {
    return []
  }
}

/**
 * Parse `netstat -ano` output into the PIDs holding a LISTENING TCP socket
 * on `port`. Columns are `Proto  Local  Foreign  State  PID`; UDP rows
 * (no State column) and non-matching ports are ignored. Matches both IPv4
 * (`127.0.0.1:<port>`) and IPv6 (`[::1]:<port>`) local addresses.
 */
export function parseListeningPidsFromNetstat(stdout: string, port: number): number[] {
  const pids = new Set<number>()
  for (const raw of stdout.split(/\r?\n/)) {
    const cols = raw.trim().split(/\s+/)
    if (cols.length < 5 || cols[0].toUpperCase() !== 'TCP') continue
    if (cols[3].toUpperCase() !== 'LISTENING') continue
    if (!cols[1].endsWith(`:${port}`)) continue
    const pid = Number(cols[cols.length - 1])
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) pids.add(pid)
  }
  return [...pids]
}

/** Read a process's full command line (best effort, platform-specific). */
async function processCommandLine(pid: number): Promise<string> {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`
      ],
      { windowsHide: true, timeout: 5_000 }
    )
    return stdout.trim()
  }
  const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'command='])
  return stdout.trim()
}

/** Terminate a positively-identified stale magicpocket process. */
async function terminateStalePid(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 5_000
      })
      return true
    } catch {
      // taskkill exits non-zero when the PID is already gone — treat the
      // port as reclaimed only if the process really is no longer alive.
      return await waitForPidExit(pid, 0)
    }
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return false
  }
  if (!(await waitForPidExit(pid, 2_000))) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* already gone */
    }
    await waitForPidExit(pid, 1_000)
  }
  return true
}

async function waitForPidExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    if (Date.now() >= deadline) return false
    await sleep(100)
  }
}

function canBindTcpPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const server = createServer()
    const settle = (available: boolean): void => {
      if (settled) return
      settled = true
      server.removeAllListeners('error')
      resolve(available)
    }
    server.unref()
    server.once('error', () => settle(false))
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => settle(true))
    })
  })
}

function allocateTcpPort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    const cleanup = (): void => {
      server.removeAllListeners('error')
      server.removeAllListeners('listening')
    }
    server.unref()
    server.once('error', (error) => {
      cleanup()
      reject(error)
    })
    server.listen({ port: 0, host, exclusive: true }, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        cleanup()
        if (error) reject(error)
        else if (port > 0) resolve(port)
        else reject(new Error('failed to allocate an available MagicPocket port'))
      })
    })
  })
}

async function waitForMagicPocketStartup(startedChild: ChildProcess, port?: number): Promise<void> {
  if (startedChild.exitCode !== null) {
    throw new Error(describeMagicPocketExit(startedChild.exitCode, null))
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let stdoutBuffer = ''
    let stderrTail = ''
    let healthProbeInFlight = false
    let healthConfirmed = false
    let readyMarkerSeen = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(describeMagicPocketStartupTimeout(stderrTail, readyMarkerSeen && Boolean(port))))
    }, KUN_STARTUP_TIMEOUT_MS)
    // The stdout ready marker can lag behind the actual server (pipe
    // buffering) or get lost in unusual spawn environments; the HTTP
    // health endpoint is the ground truth, so poll it in parallel.
    // A passing health probe alone is enough to settle (it proves the
    // server responds). The stdout marker alone is NOT enough — it only
    // proves the process started, not that the HTTP server can serve.
    const healthTimer = port
      ? setInterval(() => {
          if (settled || healthProbeInFlight) return
          healthProbeInFlight = true
          void probeMagicPocketHealth(port)
            .then((healthy) => {
              if (healthy) {
                healthConfirmed = true
                settleReady()
              }
            })
            .finally(() => {
              healthProbeInFlight = false
            })
        }, KUN_STARTUP_HEALTH_POLL_MS)
      : null
    const cleanup = (): void => {
      clearTimeout(timer)
      if (healthTimer) clearInterval(healthTimer)
      startedChild.removeListener('exit', onExit)
      startedChild.removeListener('error', onError)
      startedChild.stdout?.removeListener('data', onStdout)
      startedChild.stderr?.removeListener('data', onStderr)
    }
    const tryParseReady = (): boolean => {
      const markerIndex = stdoutBuffer.indexOf(KUN_READY_PREFIX)
      if (markerIndex < 0) return false
      const afterPrefix = stdoutBuffer.slice(markerIndex + KUN_READY_PREFIX.length)
      const newlineIndex = afterPrefix.indexOf('\n')
      if (newlineIndex < 0) return false
      const jsonLine = afterPrefix.slice(0, newlineIndex).trim()
      if (!jsonLine) return false
      try {
        const parsed = JSON.parse(jsonLine) as { service?: string; mode?: string; port?: number }
        return parsed.service === 'magicpocket' && parsed.mode === 'serve' && typeof parsed.port === 'number'
      } catch {
        return false
      }
    }
    const settleReady = (): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const onStdout = (chunk: Buffer | string): void => {
      stdoutBuffer = appendTail(stdoutBuffer, String(chunk), STDERR_TAIL_MAX_CHARS * 2)
      if (!tryParseReady()) return
      readyMarkerSeen = true
      if (healthConfirmed || !healthTimer) {
        settleReady()
      }
    }
    const onStderr = (chunk: Buffer | string): void => {
      stderrTail = appendTail(stderrTail, String(chunk))
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(describeMagicPocketExit(code, signal, stderrTail)))
    }
    const onError = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    startedChild.stdout?.on('data', onStdout)
    startedChild.stderr?.on('data', onStderr)
    startedChild.once('exit', onExit)
    startedChild.once('error', onError)
  })
}

function describeMagicPocketExit(
  code: number | null,
  signal: NodeJS.Signals | null,
  stderrTail = ''
): string {
  const suffix = stderrTail.trim() ? `\n${stderrTail.trim()}` : ''
  if (signal) return `MagicPocket exited during startup with signal ${signal}${suffix}`
  if (typeof code === 'number') return `MagicPocket exited during startup with code ${code}${suffix}`
  return `MagicPocket exited during startup${suffix}`
}

function describeMagicPocketStartupTimeout(stderrTail: string, sawReadyMarker = false): string {
  const suffix = stderrTail.trim() ? `\n${stderrTail.trim()}` : ''
  if (sawReadyMarker) {
    return `MagicPocket reported ready but did not pass health checks within ${KUN_STARTUP_TIMEOUT_MS}ms${suffix}`
  }
  return `MagicPocket did not report ready within ${KUN_STARTUP_TIMEOUT_MS}ms${suffix}`
}

async function probeMagicPocketHealth(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(KUN_STARTUP_HEALTH_REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return false
    return isMagicPocketHealthResponseBody(await response.text())
  } catch {
    return false
  }
}
