import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerSaveBlocker,
  Tray,
  type ContextMenuParams,
  type MenuItemConstructorOptions
} from 'electron'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  JsonSettingsStore,
  devServerHintUrl
} from './settings-store'
import dagongLogoPng from '../asset/img/idagong.png?url'
import dagongMacLogoPng from '../asset/img/dagong_mac.png?url'
import dagongTrayPng from '../asset/img/dagong_tray.png?url'
import { createAppIcon, pickTrayIcon, prepareTrayIcon } from './app-icon'
import { buildTrayMenuTemplate, parseTrayThreads, type TrayThreadSummary } from './tray-session-menu'
import { configureLinuxWaylandImeSwitches } from './app-command-line'
import { configureAppIdentity } from './app-identity'
import { shouldStartHidden, syncLoginItemSettings } from './desktop-behavior'
import { resolveLogDirectory, resolvePreloadPath } from './main-paths'
import { runLegacyDagongDataMigration } from './legacy-data-migration'
import {
  applyDagongRuntimePatch,
  dagongSettingsEnvelope,
  getActiveAgentApiKey,
  getDagongRuntimeSettings,
  mergeDagongRuntimeSettings,
  mergeClawSettings,
  mergeWorkflowSettings,
  mergeAppBehaviorSettings,
  mergeModelProviderSettings,
  mergeDesignSettings,
  mergeScheduleSettings,
  mergeWriteSettings,
  mergeTerminalSettings,
  MIN_KUN_LOCAL_PORT,
  normalizeAppSettings,
  normalizeAppBehaviorSettings,
  normalizeCheckpointCleanupSettings,
  normalizeKeyboardShortcuts,
  resolveModelProviderProxyUrl,
  resolveDagongRuntimeSettings,
  resolveTerminalColorMode,
  type AppBehaviorConfigV1,
  type AppSettingsPatch,
  type AppSettingsV1,
  type WindowCloseAction
} from '../shared/app-settings'
import { parseRuntimeErrorBody, runtimeErrorToError, type RuntimeErrorCode } from '../shared/runtime-error'
import type { GuiUpdateState } from '../shared/gui-update'
import type { TrayActionPayload } from '../shared/dagong-gui-api'
import { isAllowedDevPreviewUrl } from '../shared/dev-preview-url'
import { isAuthorizedPrototypeFileUrl } from './services/prototype-embed-registry'
import { fetchUpstreamModelIds } from './upstream-models'
import {
  dagongRuntimeAdapter,
  getRuntimeBaseUrlForSettings,
  runtimeAuthHeaders,
  runtimeRequestViaHost
} from './runtime/dagong-adapter'
import { waitForRuntimeTurnsIdle } from './runtime/managed-runtime-idle'
import {
  resolveDagongDataDir,
  setDagongUnexpectedExitHandler,
  syncGuiManagedDagongConfig,
  waitForDagongStartupSettled,
  type DagongUnexpectedExitInfo
} from './dagong-process'
import { resolveCodexOAuthApiKey } from './codex-auth'
import { expandHomePath } from './settings-store'
import { RestartBudget, type DagongRuntimeStatus } from './dagong-runtime-supervisor'
import { configureLogger, logError, logWarn, pruneOnStartup } from './logger'
import { cleanupUnusedGitCheckpointsIfDue } from './services/git-checkpoint-service'
import { createClawRuntime, type ClawRuntime } from './claw-runtime'
import { createScheduleRuntime, type ScheduleRuntime } from './schedule-runtime'
import { createWorkflowRuntime, type WorkflowRuntime } from './workflow-runtime'
import { runClawScheduleMcpServerFromArgv } from './claw-schedule-mcp-server'
import {
  resolveDagongMcpJsonPath,
  syncClawScheduleMcpConfig,
  type ClawScheduleMcpLaunchConfig
} from './claw-schedule-mcp-config'
import {
  runtimeProcessConfigChanged,
  runtimeSettingsApplyMode,
  stableSettingsStringify
} from './runtime-settings-apply-mode'
import { registerAppIpcHandlers } from './ipc/register-app-ipc-handlers'
import {
  configureManagedWeixinBridgeUrlResolver,
  pollFeishuInstall,
  pollWeixinInstall,
  startFeishuInstallQrcode,
  startWeixinInstallQrcode
} from './claw-platform-install'
import { registerRuntimeSseIpc } from './runtime-sse-ipc'
import { registerTerminalPtyIpc } from './terminal/terminal-pty-ipc'
import {
  configureWeixinBridgeRuntimeContextProvider,
  ensureWeixinBridgeRpcUrl,
  getWeixinBridgeAccountUserId,
  sendWeixinBridgeMessage,
  stopWeixinBridgeRuntime
} from './weixin-bridge-runtime'
import { webhookUrl } from './claw-runtime-helpers'
import { createTelegramRuntime, type TelegramRuntime, verifyTelegramBotToken } from './telegram-runtime'
import { isDagongHealthResponseBody } from './dagong-health'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 品牌升级为 Dagong 后仍保留旧 AppUserModelId:它必须和 electron-builder
// 的 appId 一致才能让 Windows 通知 / 任务栏分组在升级前后连续,而
// appId 因为 NSIS 升级 GUID 与 macOS 更新签名校验的原因永远不改。
const APP_USER_MODEL_ID = 'com.xingyuzhong.deepseekgui'
const startupTraceEnabled =
  process.env.KUN_STARTUP_TRACE === '1' || process.env.DEEPSEEK_GUI_STARTUP_TRACE === '1'
const startupTraceStart = Date.now()

function traceStartup(label: string, detail?: unknown): void {
  if (!startupTraceEnabled) return
  const elapsed = String(Date.now() - startupTraceStart).padStart(6, ' ')
  if (detail === undefined) {
    console.info(`[startup +${elapsed}ms] ${label}`)
  } else {
    console.info(`[startup +${elapsed}ms] ${label}`, detail)
  }
}

function shouldStartWeixinBridgeRuntime(settings: AppSettingsV1): boolean {
  return settings.claw.enabled &&
    settings.claw.im.enabled &&
    settings.claw.channels.some((channel) => channel.enabled && channel.provider === 'weixin')
}

function syncWeixinBridgeRuntime(settings: AppSettingsV1): void {
  if (!shouldStartWeixinBridgeRuntime(settings)) return
  void ensureWeixinBridgeRpcUrl().catch((error) => {
    logWarn('weixin-bridge', 'Failed to start managed WeChat bridge.', {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

const runningClawScheduleMcpServer =
  process.argv.includes('--gui-schedule-mcp-server') || process.argv.includes('--claw-schedule-mcp-server')

function getClawScheduleMcpLaunchConfig(): ClawScheduleMcpLaunchConfig {
  return {
    appPath: app.getAppPath(),
    execPath: process.execPath,
    isPackaged: app.isPackaged
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runtimeFailure(code: string, message: string, status = 0, details?: unknown) {
  return {
    ok: false as const,
    status,
    body: JSON.stringify({ code, message, ...(details !== undefined ? { details } : {}) })
  }
}

function resolveConfiguredApiKey(settings: AppSettingsV1): string {
  const fromSettings = getActiveAgentApiKey(settings)
  const fromEnv = process.env.DEEPSEEK_API_KEY?.trim() ?? ''
  return fromSettings || fromEnv
}

function runtimeJsonError(code: string, message: string): Error {
  return runtimeErrorToError({ code: code as RuntimeErrorCode, message })
}

traceStartup('main module evaluated')

if (runningClawScheduleMcpServer && process.platform === 'darwin') {
  app.dock.hide()
}

// 在最早的阶段把 app 名称、AppUserModelId 都设好。
// Windows 任务栏 / 系统托盘 / 通知中心看到的应用名都来自这里;
// 设得太晚的话 BrowserWindow title、托盘、IPC 启动时拿到的还是旧的。
// 抽到 app-identity.ts 是为了让测试可以直接 import,不被 main 的
// whenReady 副作用污染。
configureAppIdentity()

// 紧跟在身份设置之后、requestSingleInstanceLock() 之前做旧数据迁移:
// 单实例锁文件就放在 userData 里,必须先把目录定下来。rename 失败
// (典型场景:老版本还在运行)时退回旧目录,功能不受影响,下次再迁。
const legacyMigration = runLegacyDagongDataMigration({
  userDataPath: app.getPath('userData'),
  homeDir: homedir(),
  log: (message, detail) => console.warn(`[dagong-gui] ${message}`, detail ?? '')
})
if (legacyMigration.userData.usedLegacyFallback) {
  app.setPath('userData', legacyMigration.userData.userDataPath)
}
traceStartup('legacy data migration checked', {
  userDataPath: legacyMigration.userData.userDataPath,
  migratedUserData: legacyMigration.userData.migrated,
  usedLegacyFallback: legacyMigration.userData.usedLegacyFallback,
  settingsRewritten: legacyMigration.settingsRewritten
})

configureLinuxWaylandImeSwitches()

if (!runningClawScheduleMcpServer && process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID)
}

let mainWindow: BrowserWindow | null = null
let store: JsonSettingsStore
let logDir = ''
let clawRuntime: ClawRuntime | null = null
let scheduleRuntime: ScheduleRuntime | null = null
let telegramRuntime: TelegramRuntime | null = null
let workflowRuntime: WorkflowRuntime | null = null
let managedRuntimesStoppedForQuit = false
let managedRuntimesStopPromise: Promise<void> | null = null
let appBehavior: AppBehaviorConfigV1 = normalizeAppBehaviorSettings()
let tray: Tray | null = null
let trayMenu: Menu | null = null
let trayMenuOpenPromise: Promise<void> | null = null
let isQuitting = false
let closeWindowPromptOpen = false
let checkpointCleanupTimer: ReturnType<typeof setInterval> | null = null

type GuiUpdaterModule = typeof import('./gui-updater')

let guiUpdaterModulePromise: Promise<GuiUpdaterModule> | null = null
let guiUpdaterInitialized = false

function emitClawChannelActivity(payload: { channelId: string; threadId: string }): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('claw:channel-activity', payload)
}

function stopCheckpointCleanupTimer(): void {
  if (checkpointCleanupTimer) {
    clearInterval(checkpointCleanupTimer)
    checkpointCleanupTimer = null
  }
}

async function runCheckpointCleanupIfDue(settings: AppSettingsV1): Promise<void> {
  if (!settings.checkpointCleanup.enabled) return
  const runtime = resolveDagongRuntimeSettings(settings)
  const dataDir = resolveDagongDataDir(runtime)
  const intervalDays = settings.checkpointCleanup.intervalDays
  const checkpointsRoot = settings.checkpointCleanup.directory?.trim()
    ? expandHomePath(settings.checkpointCleanup.directory.trim())
    : undefined
  try {
    const cleanup = await cleanupUnusedGitCheckpointsIfDue({
      dataDir,
      intervalDays,
      ...(checkpointsRoot ? { checkpointsRoot } : {})
    })
    if (!cleanup.due) return
    const { result } = cleanup
    console.info(
      `[dagong-gui] git checkpoint cleanup scanned=${result.scanned} deleted=${result.deleted} kept=${result.kept} failed=${result.failed}`
    )
    if (result.failed > 0) {
      logWarn('git-checkpoint-cleanup', 'failed to delete some unused checkpoints', {
        failed: result.failed,
        failedIds: result.failedIds
      })
    }
  } catch (error) {
    logWarn('git-checkpoint-cleanup', 'failed to clean unused checkpoints', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

function syncCheckpointCleanupTimer(settings: AppSettingsV1): void {
  stopCheckpointCleanupTimer()
  if (!settings.checkpointCleanup.enabled) return
  const intervalMs = settings.checkpointCleanup.intervalDays * 24 * 60 * 60 * 1_000
  const run = (): void => {
    void runCheckpointCleanupIfDue(settings)
  }
  run()
  checkpointCleanupTimer = setInterval(run, intervalMs)
  checkpointCleanupTimer.unref?.()
}

async function stopManagedRuntimesForQuit(): Promise<void> {
  if (managedRuntimesStoppedForQuit) return
  await stopManagedRuntimes()
  managedRuntimesStoppedForQuit = true
}

async function stopManagedRuntimes(): Promise<void> {
  if (!managedRuntimesStopPromise) {
    managedRuntimesStopPromise = (async () => {
      scheduleRuntime?.stop()
      workflowRuntime?.stop()
      clawRuntime?.stop()
      telegramRuntime?.stop()
      stopWeixinBridgeRuntime()
      await dagongRuntimeAdapter.stopAndWait()
    })().finally(() => {
      managedRuntimesStopPromise = null
    })
  }
  return managedRuntimesStopPromise
}

async function loadGuiUpdaterModule(): Promise<GuiUpdaterModule> {
  if (!guiUpdaterModulePromise) {
    guiUpdaterModulePromise = import('./gui-updater')
      .then((module) => {
        if (!guiUpdaterInitialized) {
          module.initializeGuiUpdater(
            () => mainWindow,
            async () => (await store.load()).guiUpdate.channel,
            stopManagedRuntimesForQuit,
            async () => (await store.load()).locale
          )
          guiUpdaterInitialized = true
        }
        return module
      })
      .catch((error) => {
        guiUpdaterModulePromise = null
        throw error
      })
  }
  return guiUpdaterModulePromise
}

async function readGuiUpdateState(): Promise<GuiUpdateState> {
  if (!guiUpdaterModulePromise) return { status: 'idle' }
  try {
    const module = await loadGuiUpdaterModule()
    return module.getGuiUpdateState()
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      code: 'unknown'
    }
  }
}


function installDevPreviewWebviewGuards(): void {
  app.on('web-contents-created', (_, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      const src = typeof params.src === 'string' ? params.src : ''
      // Prototype embeds are file:// pages the renderer authorized through
      // write:authorize-prototype right before attaching.
      if (!isAllowedDevPreviewUrl(src) && !isAuthorizedPrototypeFileUrl(src)) {
        event.preventDefault()
        return
      }

      delete webPreferences.preload
      delete (webPreferences as { preloadURL?: string }).preloadURL
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      webPreferences.webSecurity = true
      webPreferences.allowRunningInsecureContent = false
    })

    contents.on('will-navigate', (event, navigationUrl) => {
      if (contents.getType() !== 'webview') return
      if (!isAllowedDevPreviewUrl(navigationUrl)) event.preventDefault()
    })

    contents.setWindowOpenHandler(({ url }) => {
      if (contents.getType() !== 'webview') return { action: 'allow' }
      return isAllowedDevPreviewUrl(url) ? { action: 'allow' } : { action: 'deny' }
    })
  })
}


const appIconSource = process.platform === 'win32' ? dagongMacLogoPng : dagongLogoPng
const appIcon = createAppIcon(appIconSource)
const trayIcon = createAppIcon(dagongTrayPng)
traceStartup('app icon loaded', { source: appIconSource.startsWith('data:') ? 'data-url' : 'path' })
const gotSingleInstanceLock = runningClawScheduleMcpServer || app.requestSingleInstanceLock()
traceStartup('single instance lock checked', {
  gotSingleInstanceLock,
  skippedForClawScheduleMcpServer: runningClawScheduleMcpServer
})

function windowCloseLabels(locale: AppSettingsV1['locale']): {
  title: string
  message: string
  detail: string
  minimizeToTray: string
  quit: string
  cancel: string
  remember: string
} {
  if (locale === 'zh') {
    return {
      title: '关闭窗口',
      message: '关闭窗口时要怎么处理？',
      detail: '选择最小化到托盘时，Dagong 会继续在后台运行；选择退出应用会结束后台服务。',
      minimizeToTray: '最小化到托盘',
      quit: '退出应用',
      cancel: '取消',
      remember: '记住我的选择，不再询问'
    }
  }
  return {
    title: 'Close window',
    message: 'What should Dagong do when this window closes?',
    detail: 'Minimize to tray keeps Dagong running in the background. Quit app stops the background service.',
    minimizeToTray: 'Minimize to tray',
    quit: 'Quit app',
    cancel: 'Cancel',
    remember: 'Remember my choice and do not ask again'
  }
}

function revealMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function dispatchTrayAction(action: TrayActionPayload): void {
  revealMainWindow()
  const window = mainWindow
  if (!window || window.isDestroyed()) return
  const send = (): void => {
    if (!window.isDestroyed()) window.webContents.send('tray:action', action)
  }
  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

function showRendererContextMenu(window: BrowserWindow, params: ContextMenuParams): void {
  const template: MenuItemConstructorOptions[] = []
  const hasSelection = params.selectionText.trim().length > 0
  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy || hasSelection },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )
  } else if (hasSelection) {
    template.push(
      { role: 'copy', enabled: true },
      { type: 'separator' },
      { role: 'selectAll' }
    )
  }
  if (!app.isPackaged) {
    if (template.length > 0) template.push({ type: 'separator' })
    template.push({
      label: 'Inspect Element',
      click: () => window.webContents.inspectElement(params.x, params.y)
    })
  }
  if (template.length === 0) return
  Menu.buildFromTemplate(template).popup({ window, x: params.x, y: params.y })
}

function quitFromTray(): void {
  isQuitting = true
  app.quit()
}

function createTrayMenu(settings: AppSettingsV1, threads: TrayThreadSummary[]): Menu {
  return Menu.buildFromTemplate(buildTrayMenuTemplate({
    locale: settings.locale,
    threads,
    actions: {
      openThread: (threadId) => dispatchTrayAction({ type: 'open-thread', threadId }),
      newChat: () => dispatchTrayAction({ type: 'new-chat' }),
      openApp: revealMainWindow,
      quit: quitFromTray
    }
  }))
}

async function loadTrayThreads(settings: AppSettingsV1): Promise<TrayThreadSummary[]> {
  try {
    const response = await fetch(`${getRuntimeBaseUrlForSettings(settings)}/v1/threads?limit=20`, {
      headers: runtimeAuthHeaders(settings),
      signal: AbortSignal.timeout(1_000)
    })
    return response.ok ? parseTrayThreads(await response.text()) : []
  } catch (error) {
    logWarn('tray', 'Failed to load tray sessions.', {
      message: error instanceof Error ? error.message : String(error)
    })
    return []
  }
}

function showTrayMenu(): void {
  if (!tray || trayMenuOpenPromise) return
  const currentTray = tray
  trayMenuOpenPromise = (async () => {
    const settings = await store.load()
    const threads = await loadTrayThreads(settings)
    if (currentTray.isDestroyed()) return
    trayMenu = createTrayMenu(settings, threads)
    currentTray.popUpContextMenu(trayMenu)
  })().finally(() => {
    trayMenuOpenPromise = null
  })
}

function syncTray(settings: AppSettingsV1): void {
  appBehavior = settings.appBehavior
  if (appBehavior.closeAction === 'quit') {
    if (tray) {
      tray.destroy()
      tray = null
      trayMenu = null
    }
    return
  }

  if (!tray) {
    // Tray 优先用专门的托盘图(在 16x16/24x24 任务栏尺寸下更清晰的剪影);
    // 托盘图加载失败时回退到主应用图,这样不会看到 electron 默认占位。
    const traySource = prepareTrayIcon(pickTrayIcon(trayIcon, appIcon))
    tray = new Tray(traySource.isEmpty() ? nativeImage.createEmpty() : traySource)
    tray.on('click', showTrayMenu)
    tray.on('double-click', revealMainWindow)
    tray.on('right-click', showTrayMenu)
  }

  tray.setToolTip('Dagong')
  trayMenu = createTrayMenu(settings, [])
  tray.setContextMenu(null)
}

async function saveWindowCloseActionPreference(closeAction: WindowCloseAction): Promise<void> {
  const saved = await store.patch({ appBehavior: { closeAction } })
  syncLoginItemSettings(saved)
  syncTray(saved)
}

async function promptWindowCloseAction(window: BrowserWindow): Promise<void> {
  if (closeWindowPromptOpen || window.isDestroyed()) return
  closeWindowPromptOpen = true
  try {
    const settings = await store.load()
    const labels = windowCloseLabels(settings.locale)
    const result = await dialog.showMessageBox(window, {
      type: 'question',
      title: labels.title,
      message: labels.message,
      detail: labels.detail,
      buttons: [labels.minimizeToTray, labels.quit, labels.cancel],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      checkboxLabel: labels.remember,
      checkboxChecked: false
    })
    if (result.response === 0) {
      if (result.checkboxChecked) {
        await saveWindowCloseActionPreference('tray')
      }
      window.hide()
      return
    }
    if (result.response === 1) {
      if (result.checkboxChecked) {
        await saveWindowCloseActionPreference('quit')
      }
      isQuitting = true
      app.quit()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[dagong-gui] failed to handle close-window prompt:', error)
    logWarn('desktop-behavior', 'Failed to handle close-window prompt.', { message })
  } finally {
    closeWindowPromptOpen = false
  }
}

function handleMainWindowClose(window: BrowserWindow, event: Electron.Event): void {
  if (isQuitting) return
  if (appBehavior.closeAction === 'quit') return

  event.preventDefault()
  if (appBehavior.closeAction === 'tray') {
    window.hide()
    return
  }
  void promptWindowCloseAction(window)
}

function normalizeNotificationText(raw: string | undefined, fallback: string, maxLength: number): string {
  const value = typeof raw === 'string' && raw.trim() ? raw.trim() : fallback
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

type TurnCompleteNotificationPayload = {
  threadId?: string
  title?: string
  body?: string
}

async function showTurnCompleteNotification(
  payload: TurnCompleteNotificationPayload
): Promise<{ ok: true; shown: boolean; reason?: string } | { ok: false; message: string }> {
  const settings = await store.load()
  if (!settings.notifications.turnComplete) {
    return { ok: true, shown: false, reason: 'disabled' }
  }
  if (!Notification.isSupported()) {
    return { ok: true, shown: false, reason: 'unsupported' }
  }

  const title = normalizeNotificationText(payload.title, 'Dagong', 80)
  const body = normalizeNotificationText(payload.body, 'Conversation complete.', 180)

  try {
    const notification = new Notification({
      title,
      body,
      icon: appIcon.isEmpty() ? undefined : appIcon
    })
    notification.on('click', () => {
      revealMainWindow()
    })
    notification.show()
    return { ok: true, shown: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logError('notification', 'Failed to show turn completion notification', {
      message,
      threadId: payload.threadId
    })
    return { ok: false, message }
  }
}

async function probeThreadApi(settings: AppSettingsV1): Promise<
  | { ok: true }
  | { ok: false; error: string; message: string }
> {
  const base = getRuntimeBaseUrlForSettings(settings)
  const headers = runtimeAuthHeaders(settings)
  headers.set('Accept', 'application/json')

  try {
    const res = await fetch(`${base}/v1/threads?limit=1`, {
      headers,
      signal: AbortSignal.timeout(2_000)
    })
    if (res.ok) return { ok: true }
    const info = parseRuntimeErrorBody(
      await res.text(),
      'The local runtime returned an unexpected error.'
    )
    if (res.status === 401 && /bearer token required/i.test(info.message)) {
      return {
        ok: false,
        error: 'runtime_auth_required',
        message: 'The local runtime requires a bearer token for thread APIs.'
      }
    }
    return {
      ok: false,
      error: info.code === 'unknown' ? 'runtime_request_failed' : info.code,
      message: info.message
    }
  } catch (e) {
    return {
      ok: false,
      error: 'fetch_failed',
      message: e instanceof Error ? e.message : String(e)
    }
  }
}

async function waitForDagongHealth(settings: AppSettingsV1, timeoutMs: number): Promise<boolean> {
  const base = getRuntimeBaseUrlForSettings(settings)
  const deadline = Date.now() + timeoutMs
  let lastError = ''

  while (Date.now() <= deadline) {
    const remaining = Math.max(1, deadline - Date.now())
    const result = await probeDagongHealthOnce(settings, base, remaining)
    if (result.healthy) return true
    if (result.error !== lastError) {
      lastError = result.error
      logWarn('health-probe', `${base}/health: ${result.error}`)
    }
    await sleep(150)
  }

  logWarn('health-probe', `gave up after ${timeoutMs}ms, last error: ${lastError}`)
  return false
}

type DagongHealthProbeResult = { healthy: boolean; error: string }
const dagongHealthProbeInFlight = new Map<string, Promise<DagongHealthProbeResult>>()

function probeDagongHealthOnce(
  settings: AppSettingsV1,
  base: string,
  remainingMs: number
): Promise<DagongHealthProbeResult> {
  const existing = dagongHealthProbeInFlight.get(base)
  if (existing) return existing

  let task: Promise<DagongHealthProbeResult>
  task = (async () => {
    try {
      const res = await fetch(`${base}/health`, {
        headers: runtimeAuthHeaders(settings),
        signal: AbortSignal.timeout(Math.max(250, Math.min(1_000, remainingMs)))
      })
      const healthy = res.ok && isDagongHealthResponseBody(await res.text())
      return { healthy, error: healthy ? '' : `unexpected status ${res.status}` }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })().finally(() => {
    if (dagongHealthProbeInFlight.get(base) === task) dagongHealthProbeInFlight.delete(base)
  })
  dagongHealthProbeInFlight.set(base, task)
  return task
}

async function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

let runtimeEnsurePromise: Promise<AppSettingsV1> | null = null
let runtimeEnsureFingerprint: string | null = null
let runtimeRestartPromise: Promise<void> | null = null
let runtimeSettingsApplyPromise: Promise<void> | null = null
let lastAppliedSettings: AppSettingsV1 | null = null

const RUNTIME_WATCHDOG_INTERVAL_MS = 30_000
const RUNTIME_WATCHDOG_FAILURE_THRESHOLD = 3
/**
 * How long a managed child that failed the initial health probe gets to prove
 * it is merely busy (e.g. a long synchronous step) rather than hung, before the
 * ensure path force-restarts it in place. Generous on purpose: killing a
 * slow-but-alive runtime would cost the user their in-flight turn (#621).
 */
const RUNTIME_HUNG_CONFIRM_MS = 10_000
const runtimeRestartBudget = new RestartBudget({ windowMs: 60_000, maxRestarts: 3 })
let lastRuntimeStatus: DagongRuntimeStatus | null = null
let supervisedRestartInFlight = false
let runtimeWatchdogTimer: NodeJS.Timeout | null = null
let runtimeWatchdogFailures = 0
let runtimeWatchdogTickInFlight = false

function publishRuntimeStatus(status: Omit<DagongRuntimeStatus, 'at'>): void {
  const full: DagongRuntimeStatus = { ...status, at: new Date().toISOString() }
  lastRuntimeStatus = full
  logWarn('runtime-status', `${full.state} (${full.source})${full.message ? `: ${full.message}` : ''}`)
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('runtime:status', full)
  }
}

/** Record a healthy runtime: reset the crash budget and watchdog, announce recovery. */
function noteRuntimeHealthy(source: string): void {
  runtimeRestartBudget.reset()
  runtimeWatchdogFailures = 0
  startRuntimeWatchdog()
  if (lastRuntimeStatus && lastRuntimeStatus.state !== 'running') {
    publishRuntimeStatus({ state: 'running', source })
  }
}

function handleUnexpectedDagongExit(info: DagongUnexpectedExitInfo): void {
  void superviseDagongCrash(info).catch((error: unknown) => {
    logError('dagong-supervisor', 'supervised restart crashed', {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

async function superviseDagongCrash(info: DagongUnexpectedExitInfo): Promise<void> {
  if (managedRuntimesStoppedForQuit || isQuitting) return
  const exitLabel = info.signal ? `signal ${info.signal}` : `code ${info.code ?? 'unknown'}`
  publishRuntimeStatus({
    state: 'crashed',
    source: 'supervisor',
    message: `Dagong exited unexpectedly (${exitLabel}).`,
    stderrTail: info.stderrTail
  })
  if (supervisedRestartInFlight) return
  supervisedRestartInFlight = true
  try {
    const settings = await store.load()
    const runtime = getDagongRuntimeSettings(settings)
    if (!resolveConfiguredApiKey(settings) || !runtime.autoStart) {
      publishRuntimeStatus({
        state: 'stopped',
        source: 'supervisor',
        message: 'Dagong exited and automatic restart is unavailable (missing API key or auto-start disabled).'
      })
      return
    }
    let lastError = ''
    for (;;) {
      if (managedRuntimesStoppedForQuit || isQuitting) return
      const verdict = runtimeRestartBudget.note()
      if (!verdict.allowed) {
        publishRuntimeStatus({
          state: 'failed',
          source: 'supervisor',
          message: lastError
            ? `Dagong keeps crashing; automatic restarts are paused. Last error: ${lastError}`
            : 'Dagong keeps crashing; automatic restarts are paused. Check the runtime logs, then retry.',
          stderrTail: info.stderrTail
        })
        return
      }
      publishRuntimeStatus({
        state: 'restarting',
        source: 'supervisor',
        attempt: verdict.attempt,
        maxAttempts: 3,
        message: `Restarting Dagong automatically (attempt ${verdict.attempt}/3).`
      })
      await new Promise((resolve) => setTimeout(resolve, verdict.delayMs))
      try {
        await ensureRuntime(await store.load())
        noteRuntimeHealthy('supervisor')
        return
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        logWarn('dagong-supervisor', `automatic restart attempt ${verdict.attempt} failed: ${lastError}`)
      }
    }
  } finally {
    supervisedRestartInFlight = false
  }
}

function startRuntimeWatchdog(): void {
  if (runtimeWatchdogTimer) return
  const timer = setInterval(() => {
    void runtimeWatchdogTick().catch((error: unknown) => {
      logWarn('dagong-watchdog', 'watchdog tick failed', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }, RUNTIME_WATCHDOG_INTERVAL_MS)
  timer.unref()
  runtimeWatchdogTimer = timer
}

function stopRuntimeWatchdog(): void {
  if (runtimeWatchdogTimer) {
    clearInterval(runtimeWatchdogTimer)
    runtimeWatchdogTimer = null
  }
}

/**
 * Post-startup liveness check for the GUI-managed dagong child: the boot
 * probe only covers launch, so a runtime that hangs later (blocked
 * event loop, sqlite lock) would otherwise stay dead until the user
 * restarts the app.
 */
async function runtimeWatchdogTick(): Promise<void> {
  if (runtimeWatchdogTickInFlight) return
  if (managedRuntimesStoppedForQuit || isQuitting) return
  if (
    supervisedRestartInFlight ||
    runtimeRestartPromise ||
    runtimeSettingsApplyPromise ||
    runtimeEnsurePromise
  ) {
    return
  }
  if (!dagongRuntimeAdapter.isChildRunning()) return
  runtimeWatchdogTickInFlight = true
  try {
    const settings = await store.load()
    const healthy = await waitForDagongHealth(settings, 5_000)
    if (healthy) {
      runtimeWatchdogFailures = 0
      return
    }
    runtimeWatchdogFailures += 1
    logWarn(
      'dagong-watchdog',
      `health probe failed (${runtimeWatchdogFailures}/${RUNTIME_WATCHDOG_FAILURE_THRESHOLD})`
    )
    if (runtimeWatchdogFailures < RUNTIME_WATCHDOG_FAILURE_THRESHOLD) return
    runtimeWatchdogFailures = 0
    publishRuntimeStatus({
      state: 'restarting',
      source: 'watchdog',
      message: 'Dagong stopped responding to health checks; restarting it.'
    })
    try {
      await restartRuntime(settings)
      noteRuntimeHealthy('watchdog')
    } catch (error) {
      publishRuntimeStatus({
        state: 'failed',
        source: 'watchdog',
        message: `Dagong is unresponsive and the automatic restart failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      })
    }
  } finally {
    runtimeWatchdogTickInFlight = false
  }
}

function queueRuntimeSettingsApply(prev: AppSettingsV1, next: AppSettingsV1): void {
  // Always update the prev/next anchor so a later task diffs against
  // the settings that were actually applied last, not against the
  // original `prev` captured when this call was queued.
  const anchor = lastAppliedSettings ?? prev
  lastAppliedSettings = next
  const applyMode = runtimeSettingsApplyMode(anchor, next)
  if (applyMode === 'none') return

  const previousTask = runtimeSettingsApplyPromise ?? Promise.resolve()
  const task = previousTask
    .catch(() => undefined)
    .then(async () => {
      const current = lastAppliedSettings ?? next
      const currentMode = runtimeSettingsApplyMode(anchor, current)
      if (currentMode === 'restart') {
        await restartManagedRuntimeForSettingsChange(anchor, current)
      } else if (currentMode === 'hot') {
        const result = await applyManagedRuntimeSettingsHot(current, 'settings-apply')
        if (result === 'restart_required') {
          await restartManagedRuntimeForSettingsChange(anchor, current, true)
        }
      }
    })
    .catch((error: unknown) => {
      logWarn('settings-apply', 'Failed to apply Dagong runtime settings in background', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
    .finally(() => {
      if (runtimeSettingsApplyPromise === task) {
        runtimeSettingsApplyPromise = null
      }
    })

  runtimeSettingsApplyPromise = task
}

function queueRuntimeMcpConfigApply(settings: AppSettingsV1): void {
  lastAppliedSettings = settings

  const previousTask = runtimeSettingsApplyPromise ?? Promise.resolve()
  const task = previousTask
    .catch(() => undefined)
    .then(async () => {
      const current = lastAppliedSettings ?? settings
      const result = await applyManagedRuntimeSettingsHot(current, 'mcp-config')
      if (result === 'restart_required') {
        await restartManagedRuntimeForMcpConfigChange(current)
      }
    })
    .catch((error: unknown) => {
      logWarn('mcp-config', 'Failed to apply Dagong MCP config change in background', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
    .finally(() => {
      if (runtimeSettingsApplyPromise === task) {
        runtimeSettingsApplyPromise = null
      }
    })

  runtimeSettingsApplyPromise = task
}

async function waitForQueuedRuntimeSettingsApply(): Promise<void> {
  if (!runtimeSettingsApplyPromise) return
  await runtimeSettingsApplyPromise
}

/**
 * Build a stable fingerprint of the settings that affect the
 * Dagong runtime so that `ensureRuntime` can debounce on real
 * state instead of on a single in-flight promise. Without this,
 * a fresh call that arrives while a failing ensure is still pending
 * would re-throw the old error.
 */
function runtimeFingerprint(settings: AppSettingsV1): string {
  return stableSettingsStringify(resolveDagongRuntimeSettings(settings))
}

async function ensureRuntime(settings: AppSettingsV1): Promise<AppSettingsV1> {
  const restart = runtimeRestartPromise
  if (restart) {
    try {
      await restart
      return store.load()
    } catch {
      /* fall through to a normal ensure so callers see the latest state */
    }
  }
  const fingerprint = runtimeFingerprint(settings)
  const pending = runtimeEnsurePromise
  const pendingFingerprint = runtimeEnsureFingerprint
  if (pending) {
    // Wait for the in-flight ensure, then re-evaluate against the
    // fingerprint so callers don't inherit a stale result.
    try {
      const ensuredSettings = await pending
      if (pendingFingerprint === fingerprint) return ensuredSettings
    } catch {
      /* fall through to retry with the current settings */
    }
  }
  const task = ensureRuntimeOnce(settings)
  let trackedTask: Promise<AppSettingsV1>
  trackedTask = task.finally(() => {
    if (runtimeEnsurePromise === trackedTask) {
      runtimeEnsurePromise = null
      runtimeEnsureFingerprint = null
    }
  })
  runtimeEnsurePromise = trackedTask
  runtimeEnsureFingerprint = fingerprint
  try {
    return await trackedTask
  } finally {
    /* cleanup runs via the .finally above */
  }
}

async function ensureRuntimeOnce(settings: AppSettingsV1): Promise<AppSettingsV1> {
  await waitForQueuedRuntimeSettingsApply()
  return ensureDagongRuntime(settings)
}

async function resolveManagedDagongLaunchSettings(
  settings: AppSettingsV1,
  source: string
): Promise<AppSettingsV1> {
  const tokenResult = await ensureManagedDagongRuntimeToken(settings, source)
  const launchSettings = tokenResult.settings
  const runtime = getDagongRuntimeSettings(launchSettings)
  const resolved = await dagongRuntimeAdapter.resolveAvailablePort(runtime.port)
  if (!resolved.changed) return launchSettings

  const next = await store.patch({ agents: { dagong: { port: resolved.port } } })
  lastAppliedSettings = next
  logWarn(source, `Dagong port ${runtime.port} is unavailable; using ${resolved.port} for the managed runtime`, {
    previousPort: runtime.port,
    port: resolved.port,
    message: resolved.message
  })
  return next
}

function generateDagongRuntimeToken(): string {
  return randomBytes(32).toString('base64url')
}

async function ensureManagedDagongRuntimeToken(
  settings: AppSettingsV1,
  source: string
): Promise<{ settings: AppSettingsV1; generated: boolean }> {
  const runtime = getDagongRuntimeSettings(settings)
  if (runtime.runtimeToken.trim()) {
    return { settings, generated: false }
  }

  const next = await store.patch({
    agents: { dagong: { runtimeToken: generateDagongRuntimeToken() } }
  })
  lastAppliedSettings = next
  logWarn(source, 'Generated a runtime token for the managed Dagong runtime because none was configured.')
  return { settings: next, generated: true }
}

async function ensureDagongRuntime(settings: AppSettingsV1): Promise<AppSettingsV1> {
  const tokenResult = await ensureManagedDagongRuntimeToken(settings, 'runtime-start')
  const currentSettings = tokenResult.settings
  if (tokenResult.generated && dagongRuntimeAdapter.isChildRunning()) {
    logWarn('runtime-start', 'Restarting managed Dagong to apply the generated runtime token.')
    await dagongRuntimeAdapter.stopAndWait()
  }

  const runtime = getDagongRuntimeSettings(currentSettings)
  const hasApiKey = Boolean(resolveConfiguredApiKey(currentSettings))

  const healthy = await waitForDagongHealth(currentSettings, 2_000)
  if (healthy) {
    const threadApi = await probeThreadApi(currentSettings)
    if (threadApi.ok) {
      noteRuntimeHealthy('ensure')
      return currentSettings
    }
    throw runtimeJsonError(threadApi.error, threadApi.message)
  }

  if (!hasApiKey) {
    throw runtimeJsonError(
      'missing_api_key',
      'DeepSeek API Key is required before the GUI can start Dagong.'
    )
  }
  if (!runtime.autoStart) {
    throw runtimeJsonError(
      'runtime_offline',
      'Dagong is offline. Enable automatic startup in Settings, or start `dagong serve` manually.'
    )
  }

  // A managed child that is alive but failed the probe is hung (blocked event
  // loop) or merely busy — not absent. The launch path below cannot recover it
  // on its own: resolveAvailablePort skips our own child when reclaiming the
  // port (isCurrentDagongChildPid) and startDagongChild early-returns while
  // isChildRunning() stays true, so it would pick a fresh port, never spawn,
  // and fail every request until the ~90s watchdog finally force-restarts
  // (polimao/Dagong#621). Stop the hung child here so the relaunch spawns a fresh
  // process on the SAME port instead.
  if (dagongRuntimeAdapter.isChildRunning()) {
    // Never tear down a child still inside its (deliberately generous) startup
    // window — interrupting a slow-but-healthy boot is the #544 restart storm.
    await waitForDagongStartupSettled()
    if (dagongRuntimeAdapter.isChildRunning()) {
      // Give a merely-busy runtime a real chance to answer before judging it
      // hung, so one long synchronous step does not cost the user their turn.
      const recovered = await waitForDagongHealth(currentSettings, RUNTIME_HUNG_CONFIRM_MS)
      if (recovered) {
        const threadApi = await probeThreadApi(currentSettings)
        if (threadApi.ok) {
          noteRuntimeHealthy('ensure')
          return currentSettings
        }
        throw runtimeJsonError(threadApi.error, threadApi.message)
      }
      logWarn(
        'runtime-start',
        `managed Dagong child stopped responding on port ${runtime.port}; restarting it in place`
      )
      await dagongRuntimeAdapter.stopAndWait()
    }
  }

  const launchSettings = await resolveManagedDagongLaunchSettings(currentSettings, 'runtime-start')
  const adapter = dagongRuntimeAdapter
  try {
    await adapter.ensureRunning(launchSettings)
  } catch (e) {
    console.error('[dagong-gui] failed to start dagong:', e)
    throw e
  }
  const started = await waitForDagongHealth(launchSettings, 20_000)
  if (!started) {
    throw runtimeJsonError(
      'runtime_unhealthy',
      'Dagong did not become healthy after launch.'
    )
  }

  const threadApi = await probeThreadApi(launchSettings)
  if (!threadApi.ok) {
    throw runtimeJsonError(threadApi.error, threadApi.message)
  }
  noteRuntimeHealthy('ensure')
  return launchSettings
}

async function restartRuntime(settings: AppSettingsV1): Promise<void> {
  if (runtimeRestartPromise) return runtimeRestartPromise
  const task = restartRuntimeOnce(settings)
    .finally(() => {
      if (runtimeRestartPromise === task) {
        runtimeRestartPromise = null
      }
    })
  runtimeRestartPromise = task
  runtimeEnsurePromise = null
  runtimeEnsureFingerprint = null
  return task
}

async function restartRuntimeOnce(settings: AppSettingsV1): Promise<void> {
  await waitForQueuedRuntimeSettingsApply()
  // Don't tear down a child that is still completing its startup; wait for it
  // to settle so a restart trigger that races a boot doesn't reset the clock
  // (#544). Resolves immediately when nothing is launching.
  await waitForDagongStartupSettled()
  const runtime = getDagongRuntimeSettings(settings)

  if (!resolveConfiguredApiKey(settings)) {
    throw runtimeJsonError(
      'missing_api_key',
      'DeepSeek API Key is required before the GUI can start Dagong.'
    )
  }
  if (!runtime.autoStart) {
    throw runtimeJsonError(
      'runtime_offline',
      'Dagong is offline. Enable automatic startup in Settings, or start `dagong serve` manually.'
    )
  }

  const adapter = dagongRuntimeAdapter
  await adapter.stopAndWait()
  const launchSettings = await resolveManagedDagongLaunchSettings(settings, 'runtime-restart')

  try {
    await adapter.ensureRunning(launchSettings)
  } catch (e) {
    console.error('[dagong-gui] failed to restart dagong:', e)
    throw e
  }

  const healthy = await waitForDagongHealth(launchSettings, 20_000)
  if (!healthy) {
    throw runtimeJsonError(
      'runtime_unhealthy',
      'Dagong did not become healthy after restart.'
    )
  }

  const threadApi = await probeThreadApi(launchSettings)
  if (!threadApi.ok) {
    throw runtimeJsonError(threadApi.error, threadApi.message)
  }
  noteRuntimeHealthy('restart')
}

function createWindow(options: { suppressInitialShow?: boolean } = {}): void {
  traceStartup('createWindow:start')
  const preloadPath = resolvePreloadPath(__dirname)
  const usesDesktopTitleBar = process.platform === 'win32' || process.platform === 'linux'
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : usesDesktopTitleBar ? 'hidden' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 31, y: 22 } : undefined,
    autoHideMenuBar: usesDesktopTitleBar,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      // Pass the home dir to the sandboxed preload (it can't require node:os).
      additionalArguments: [`--dagong-home-dir=${homedir()}`]
    }
  })
  if (usesDesktopTitleBar) {
    mainWindow.setMenu(null)
    mainWindow.setMenuBarVisibility(false)
  }
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[dagong-gui] failed to load preload ${preloadPath}:`, error)
    logError('preload', 'Failed to load preload script', { preloadPath, message })
  })
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault()
    const window = mainWindow
    if (!window || window.isDestroyed()) return
    showRendererContextMenu(window, params)
  })
  const showWindow = (): void => {
    if (options.suppressInitialShow) return
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return
    mainWindow.show()
  }
  mainWindow.on('close', (event) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    handleMainWindowClose(mainWindow, event)
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  const devUrl = devServerHintUrl()
  traceStartup('createWindow:load', { devUrl: devUrl ?? 'file' })
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow.once('ready-to-show', () => {
    traceStartup('window:ready-to-show')
    showWindow()
  })
  mainWindow.webContents.once('did-finish-load', () => {
    traceStartup('window:did-finish-load')
    if (lastRuntimeStatus && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('runtime:status', lastRuntimeStatus)
    }
    showWindow()
  })
  setTimeout(() => {
    traceStartup('window:fallback-show-timeout')
    showWindow()
  }, 1500)
}

/**
 * Reject runtime-affecting values that would persist a config dagong can
 * never boot with. Runs before the settings patch is written to disk.
 */
function validateRuntimeSettingsForApply(next: AppSettingsV1): string | null {
  const runtime = resolveDagongRuntimeSettings(next)
  if (!Number.isInteger(runtime.port) || runtime.port < MIN_KUN_LOCAL_PORT || runtime.port > 65_535) {
    return `Dagong port must be an integer between ${MIN_KUN_LOCAL_PORT} and 65535 (got ${String(runtime.port)})`
  }
  const baseUrl = (runtime.baseUrl ?? '').trim()
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return `model base URL must use http(s): ${baseUrl}`
      }
    } catch {
      return `model base URL is not a valid URL: ${baseUrl}`
    }
  }
  return null
}

function preserveRuntimeTokenForFullSettingsSnapshot(
  prev: AppSettingsV1,
  partial: AppSettingsPatch
): AppSettingsPatch {
  const incomingDagong = partial.agents?.dagong
  if (!incomingDagong || !isFullSettingsSnapshotPatch(partial)) return partial
  if (typeof incomingDagong.runtimeToken !== 'string' || incomingDagong.runtimeToken.trim()) return partial

  const currentToken = getDagongRuntimeSettings(prev).runtimeToken.trim()
  if (!currentToken) return partial

  return {
    ...partial,
    agents: {
      ...partial.agents,
      dagong: {
        ...incomingDagong,
        runtimeToken: currentToken
      }
    }
  }
}

function isFullSettingsSnapshotPatch(partial: AppSettingsPatch): boolean {
  return partial.version !== undefined &&
    partial.provider !== undefined &&
    partial.agents?.dagong !== undefined &&
    partial.log !== undefined &&
    partial.checkpointCleanup !== undefined &&
    partial.notifications !== undefined &&
    partial.appBehavior !== undefined &&
    partial.keyboardShortcuts !== undefined &&
    partial.write !== undefined &&
    partial.claw !== undefined &&
    partial.schedule !== undefined &&
    partial.workflow !== undefined &&
    partial.terminal !== undefined &&
    partial.guiUpdate !== undefined
}

type ManagedRuntimeHotApplyResult = 'applied' | 'skipped' | 'restart_required'

async function applyManagedRuntimeSettingsHot(
  settings: AppSettingsV1,
  source: string
): Promise<ManagedRuntimeHotApplyResult> {
  await waitForDagongStartupSettled()
  const adapter = dagongRuntimeAdapter
  if (!adapter.isChildRunning()) return 'skipped'

  const runtime = resolveDagongRuntimeSettings(settings)
  const dataDir = resolveDagongDataDir(runtime)
  const config = await syncGuiManagedDagongConfig(dataDir, runtime, {
    scheduleMcp: {
      settings,
      launch: getClawScheduleMcpLaunchConfig()
    }
  })
  const serve = config.serve ?? {}
  const defaultClientApiKey = resolveCodexOAuthApiKey(runtime.apiKey).apiKey
  const body = {
    ...config,
    serve: {
      ...serve,
      apiKey: defaultClientApiKey || runtime.apiKey,
      baseUrl: runtime.baseUrl,
      modelProxyUrl: resolveModelProviderProxyUrl(settings),
      endpointFormat: runtime.endpointFormat,
      model: runtime.model,
      approvalPolicy: runtime.approvalPolicy,
      sandboxMode: runtime.sandboxMode,
      tokenEconomyMode: runtime.tokenEconomyMode,
      tokenEconomy: runtime.tokenEconomy,
      toolOutputLimits: runtime.toolOutputLimits,
      providers: serve.providers ?? {}
    }
  }

  const headers = runtimeAuthHeaders(settings)
  headers.set('content-type', 'application/json')
  try {
    const response = await fetch(
      `${getRuntimeBaseUrlForSettings(settings)}/v1/runtime/config/apply`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }
    )
    const text = await response.text()
    if (response.status === 404 || response.status === 405) {
      logWarn(source, 'Dagong runtime does not support hot config apply; falling back to restart.')
      return 'restart_required'
    }
    let parsed: unknown = null
    if (text.trim()) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }
    }
    if (response.ok && parsed && typeof parsed === 'object' && (parsed as { ok?: unknown }).ok === true) {
      noteRuntimeHealthy(source)
      return 'applied'
    }
    const code = parsed && typeof parsed === 'object' ? (parsed as { code?: unknown }).code : undefined
    const message = parsed && typeof parsed === 'object'
      ? String((parsed as { message?: unknown }).message ?? text)
      : text
    if (code === 'restart_required') {
      logWarn(source, `Dagong hot config apply requested restart: ${message}`)
      return 'restart_required'
    }
    throw new Error(message || `Dagong hot config apply failed with HTTP ${response.status}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logWarn(source, `Dagong hot config apply failed; falling back to restart: ${message}`)
    return 'restart_required'
  }
}

async function restartManagedRuntimeForSettingsChange(
  prev: AppSettingsV1,
  next: AppSettingsV1,
  force = false
): Promise<void> {
  if (!force && !runtimeProcessConfigChanged(prev, next)) return

  // Let any in-flight boot launch finish (or fail) before we read liveness
  // and stop the child. Killing a dagong that is still inside its startup window
  // throws away the boot's progress and restarts the clock — the #544 restart
  // storm. Once it settles, the child is either healthy (graceful restart
  // below) or already gone (`wasRunning` is false and we return).
  await waitForDagongStartupSettled()

  const runtime = resolveDagongRuntimeSettings(next)
  const adapter = dagongRuntimeAdapter
  const wasRunning = adapter.isChildRunning()

  if (!wasRunning) return

  // Decide BEFORE stopping the child. Stranding a healthy runtime is exactly
  // issue #329: a partial/transient save (e.g. the active providerId moved to
  // a profile whose key lives elsewhere) can momentarily resolve to "no API
  // key" even though the user clearly has one configured. If the runtime we
  // are about to restart was healthy and the previous settings had a usable
  // key, don't kill it on the strength of a key check the new settings fail —
  // leave it running on its current config; the next save with a resolvable
  // key restarts cleanly.
  const nextHasApiKey = Boolean(resolveConfiguredApiKey(next))
  if (!nextHasApiKey && Boolean(resolveConfiguredApiKey(prev))) {
    logWarn(
      'settings-apply',
      'Skipping Dagong restart: the new settings resolve to no API key but the running runtime had one — leaving the healthy runtime in place.'
    )
    return
  }

  await waitForManagedRuntimeReadyBeforeStop(prev, 'settings-apply')
  await adapter.stopAndWait()
  if (!nextHasApiKey || !runtime.autoStart) {
    publishRuntimeStatus({
      state: 'stopped',
      source: 'settings-apply',
      message: 'Dagong was stopped: the new settings have no API key or auto-start is disabled.'
    })
    return
  }

  publishRuntimeStatus({ state: 'restarting', source: 'settings-apply' })
  try {
    const launchSettings = await resolveManagedDagongLaunchSettings(next, 'settings-apply')
    await adapter.ensureRunning(launchSettings)
    const healthy = await waitForDagongHealth(launchSettings, 20_000)
    if (!healthy) {
      throw new Error('Dagong did not become healthy after the settings change')
    }
    noteRuntimeHealthy('settings-apply')
    publishRuntimeStatus({ state: 'running', source: 'settings-apply' })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logWarn('settings-apply', `Dagong restart failed after settings change: ${message}`)
    await rollbackRuntimeSettingsAfterFailedApply(prev, message)
  }
}

/**
 * A settings change took the runtime down and the new config cannot
 * boot. Restore the previous runtime/provider settings on disk (so the
 * next app launch is not bricked either) and bring dagong back up on the
 * last-known-good configuration.
 */
async function rollbackRuntimeSettingsAfterFailedApply(
  prev: AppSettingsV1,
  failureMessage: string
): Promise<void> {
  const adapter = dagongRuntimeAdapter
  let base: AppSettingsV1 = prev
  try {
    base = await store.patch({
      agents: { dagong: getDagongRuntimeSettings(prev) },
      provider: prev.provider
    })
    lastAppliedSettings = base
  } catch (error) {
    logWarn('settings-apply', 'failed to restore previous runtime settings on disk', {
      message: error instanceof Error ? error.message : String(error)
    })
  }
  if (!resolveConfiguredApiKey(base) || !getDagongRuntimeSettings(base).autoStart) {
    publishRuntimeStatus({
      state: 'stopped',
      source: 'settings-apply',
      rolledBack: true,
      message: `The new settings failed to apply (${failureMessage}); previous settings were restored but auto-start is unavailable.`
    })
    return
  }
  try {
    const launchSettings = await resolveManagedDagongLaunchSettings(base, 'settings-apply-rollback')
    await adapter.ensureRunning(launchSettings)
    const healthy = await waitForDagongHealth(launchSettings, 20_000)
    if (!healthy) {
      throw new Error('previous configuration did not become healthy')
    }
    noteRuntimeHealthy('settings-apply-rollback')
    publishRuntimeStatus({
      state: 'running',
      source: 'settings-apply',
      rolledBack: true,
      message: `The new settings failed to apply (${failureMessage}); Dagong is running on the previous settings again.`
    })
  } catch (error) {
    publishRuntimeStatus({
      state: 'failed',
      source: 'settings-apply',
      rolledBack: true,
      message: `The new settings failed to apply (${failureMessage}) and restoring the previous settings also failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    })
  }
}

async function restartManagedRuntimeForMcpConfigChange(settings: AppSettingsV1): Promise<void> {
  // See restartManagedRuntimeForSettingsChange: never interrupt an in-flight
  // boot launch (#544 restart storm).
  await waitForDagongStartupSettled()

  const runtime = resolveDagongRuntimeSettings(settings)
  const adapter = dagongRuntimeAdapter
  const wasRunning = adapter.isChildRunning()

  if (!wasRunning) return
  await waitForManagedRuntimeReadyBeforeStop(settings, 'mcp-config')
  await adapter.stopAndWait()
  if (!resolveConfiguredApiKey(settings) || !runtime.autoStart) return

  publishRuntimeStatus({ state: 'restarting', source: 'mcp-config' })
  try {
    const launchSettings = await resolveManagedDagongLaunchSettings(settings, 'mcp-config')
    await adapter.ensureRunning(launchSettings)
    const healthy = await waitForDagongHealth(launchSettings, 20_000)
    if (!healthy) {
      throw new Error('Dagong did not become healthy after the MCP config change')
    }
    noteRuntimeHealthy('mcp-config')
    publishRuntimeStatus({ state: 'running', source: 'mcp-config' })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logWarn('mcp-config', `Dagong restart failed after MCP config change: ${message}`)
    publishRuntimeStatus({
      state: 'failed',
      source: 'mcp-config',
      message: `Dagong failed to restart after the MCP config change: ${message}. Check the MCP config file, then retry.`
    })
  }
}

async function waitForManagedRuntimeReadyBeforeStop(
  settings: AppSettingsV1,
  source: string
): Promise<void> {
  const healthy = await waitForDagongHealth(settings, 20_000)
  if (!healthy) {
    logWarn(source, 'Dagong did not become healthy before a managed restart; stopping it anyway')
    return
  }
  const idle = await waitForRuntimeTurnsIdle({ settings })
  if (idle === 'timeout') {
    logWarn(source, 'Dagong still has running turns after waiting; stopping it anyway')
  } else if (idle === 'unavailable') {
    logWarn(source, 'Could not verify Dagong turn idleness before a managed restart; stopping it anyway')
  }
}

async function runtimeRequest(
  settings: AppSettingsV1,
  pathAndQuery: string,
  init: { method?: string; body?: string; headers?: Record<string, string> }
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    return await runtimeRequestViaHost(settings, pathAndQuery, init, ensureRuntime)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logError('runtime-request', `HTTP request to ${pathAndQuery} failed`, { message })
    const parsed = parseRuntimeErrorBody(message, message)
    if (parsed.code !== 'unknown' || parsed.message !== message) {
      return runtimeFailure(parsed.code, parsed.message, 0, parsed.details)
    }
    return runtimeFailure('fetch_failed', message)
  }
}

if (runningClawScheduleMcpServer) {
  void runClawScheduleMcpServerFromArgv(process.argv).catch((error) => {
    console.error('[claw-schedule-mcp] server failed:', error)
    process.exit(1)
  })
} else {
app.whenReady().then(async () => {
  traceStartup('app.whenReady:start')
  if (!gotSingleInstanceLock) return

  traceStartup('install webview guards:start')
  installDevPreviewWebviewGuards()
  traceStartup('install webview guards:done')

  if (process.platform === 'darwin') {
    const macDockIcon = createAppIcon(dagongMacLogoPng)
    app.dock.setIcon(macDockIcon.isEmpty() ? appIcon : macDockIcon)
  }

  store = new JsonSettingsStore(app.getPath('userData'))
  traceStartup('settings load:start')
  const initial = await store.load()
  traceStartup('settings load:done')
  setDagongUnexpectedExitHandler(handleUnexpectedDagongExit)
  appBehavior = initial.appBehavior
  syncLoginItemSettings(initial)
  syncTray(initial)
  await syncClawScheduleMcpConfig(initial, getClawScheduleMcpLaunchConfig()).catch((error) => {
    console.error('[claw-schedule-mcp] failed to sync config on startup:', error)
  })

  logDir = resolveLogDirectory(app)
  configureLogger({
    dir: logDir,
    enabled: initial.log.enabled,
    retentionDays: initial.log.retentionDays
  })
  traceStartup('logger configured')
  syncCheckpointCleanupTimer(initial)
  scheduleRuntime = createScheduleRuntime({ store, runtimeRequest, logError, powerSaveBlocker })
  scheduleRuntime.sync(initial)
  workflowRuntime = createWorkflowRuntime({ store, runtimeRequest, logError, powerSaveBlocker })
  workflowRuntime.sync(initial)
  // Telegram runtime is created first so ClawRuntime can reference it via deps.
  // The onInbound callback closes over the module-level clawRuntime, which is
  // assigned on the next line — by the time an update arrives the reference is set.
  telegramRuntime = createTelegramRuntime({
    store,
    logError,
    onInbound: (payload) => clawRuntime?.handleTelegramUpdate(payload)
  })
  clawRuntime = createClawRuntime({
    store,
    runtimeRequest,
    logError,
    notifyChannelActivity: emitClawChannelActivity,
    sendWeixinBridgeMessage,
    resolveWeixinAccountUserId: getWeixinBridgeAccountUserId,
    telegramRuntime,
    createScheduledTaskFromText: (text, options) =>
      scheduleRuntime?.createScheduledTaskFromText(text, options) ?? Promise.resolve({ kind: 'noop' })
  })
  clawRuntime.sync(initial)
  // ClawRuntime.sync delegates Telegram reconciliation to telegramRuntime.sync,
  // so the long-poll loops start as part of the call above. The explicit sync
  // here is a no-op when settings are unchanged, kept for clarity.
  telegramRuntime.sync(initial)
  configureWeixinBridgeRuntimeContextProvider(async () => {
    const settings = await store.load()
    const channel = settings.claw.channels.find((item) => item.enabled && item.provider === 'weixin')
    return {
      webhookUrl: webhookUrl(settings),
      webhookSecret: settings.claw.im.secret,
      channelId: channel?.id ?? ''
    }
  })
  configureManagedWeixinBridgeUrlResolver(ensureWeixinBridgeRpcUrl)
  syncWeixinBridgeRuntime(initial)

  traceStartup('ipc registration:start')
  const applySettingsPatch = async (partial: AppSettingsPatch): Promise<AppSettingsV1> => {
    const prev = await store.load()
    const effectivePartial = preserveRuntimeTokenForFullSettingsSnapshot(prev, partial)
    const { agents: agentsPatch, provider: providerPatch, ...restPatch } = effectivePartial
    const next = normalizeAppSettings({
      ...applyDagongRuntimePatch(prev, agentsPatch?.dagong),
      ...restPatch,
      provider: mergeModelProviderSettings(prev.provider, providerPatch),
      log: { ...prev.log, ...(effectivePartial.log ?? {}) },
      checkpointCleanup: normalizeCheckpointCleanupSettings({
        ...prev.checkpointCleanup,
        ...(effectivePartial.checkpointCleanup ?? {})
      }),
      notifications: { ...prev.notifications, ...(effectivePartial.notifications ?? {}) },
      appBehavior: mergeAppBehaviorSettings(prev.appBehavior, effectivePartial.appBehavior),
      keyboardShortcuts: normalizeKeyboardShortcuts({
        bindings: {
          ...prev.keyboardShortcuts.bindings,
          ...(effectivePartial.keyboardShortcuts?.bindings ?? {})
        }
      }),
      write: mergeWriteSettings(prev.write, effectivePartial.write),
      claw: mergeClawSettings(prev.claw, effectivePartial.claw),
      schedule: mergeScheduleSettings(prev.schedule, effectivePartial.schedule),
      workflow: mergeWorkflowSettings(prev.workflow, effectivePartial.workflow),
      design: mergeDesignSettings(prev.design, effectivePartial.design),
      terminal: mergeTerminalSettings(prev.terminal, effectivePartial.terminal),
      guiUpdate: { ...prev.guiUpdate, ...(effectivePartial.guiUpdate ?? {}) }
    })
    if (prev.log.enabled !== next.log.enabled || prev.log.retentionDays !== next.log.retentionDays) {
      configureLogger({ enabled: next.log.enabled, retentionDays: next.log.retentionDays })
    }
    const runtimeValidationError = validateRuntimeSettingsForApply(next)
    if (runtimeValidationError) {
      throw new Error(`Invalid runtime settings: ${runtimeValidationError}`)
    }
    const saved = await store.patch(effectivePartial)
    await syncClawScheduleMcpConfig(saved, getClawScheduleMcpLaunchConfig()).catch((error) => {
      console.error('[claw-schedule-mcp] failed to sync config after settings change:', error)
    })
    if (prev.guiUpdate.channel !== saved.guiUpdate.channel && guiUpdaterModulePromise) {
      void guiUpdaterModulePromise.then((module) => module.setGuiUpdateChannel(saved.guiUpdate.channel))
    }
    queueRuntimeSettingsApply(prev, saved)
    try {
      scheduleRuntime?.sync(saved)
      workflowRuntime?.sync(saved)
      clawRuntime?.sync(saved)
    } catch (error) {
      logError('settings-apply', 'failed to sync schedule/claw runtimes after settings change', {
        message: error instanceof Error ? error.message : String(error)
      })
    }
    syncWeixinBridgeRuntime(saved)
    syncLoginItemSettings(saved)
    syncTray(saved)
    syncCheckpointCleanupTimer(saved)
    return saved
  }

  const fetchModels = async () => {
    const settings = await store.load()
    const key = resolveConfiguredApiKey(settings)
    return fetchUpstreamModelIds(settings, key)
  }

  const saveSettingsPatch = async (partial: AppSettingsPatch): Promise<AppSettingsV1> => {
    return store.patch(preserveRuntimeTokenForFullSettingsSnapshot(await store.load(), partial))
  }

  registerAppIpcHandlers({
    store,
    getMainWindow: () => mainWindow,
    applySettingsPatch,
    saveSettingsPatch,
    runtimeRequest: async (path, method, body) => {
      const settings = await store.load()
      return runtimeRequest(settings, path, { method, body })
    },
    restartRuntime: async () => {
      const settings = await store.load()
      await restartRuntime(settings)
    },
    fetchUpstreamModels: fetchModels,
    getClawRuntime: () => clawRuntime,
    getScheduleRuntime: () => scheduleRuntime,
    getWorkflowRuntime: () => workflowRuntime,
    startFeishuInstallQrcode,
    pollFeishuInstall,
    startWeixinInstallQrcode,
    pollWeixinInstall,
    resolveDagongConfigPath: resolveDagongMcpJsonPath,
    onDagongMcpConfigWritten: async () => {
      const settings = await store.load()
      queueRuntimeMcpConfigApply(settings)
    },
    showTurnCompleteNotification,
    getAppVersion: () => app.getVersion(),
    readGuiUpdateState,
    loadGuiUpdaterModule,
    resolveLogDirectory: () => resolveLogDirectory(app),
    logError
  })

  void loadGuiUpdaterModule().catch((error) => {
    console.warn('[dagong-gui updater] failed to initialize on startup:', error)
  })

  registerRuntimeSseIpc({ ipcMain, store, ensureRuntime, logError })

  registerTerminalPtyIpc({
    ipcMain,
    getMainWindow: () => mainWindow,
    logError,
    getTerminalColorMode: async () => resolveTerminalColorMode(await store.load())
  })
  traceStartup('ipc registration:done')

  createWindow({ suppressInitialShow: shouldStartHidden(initial) })
  traceStartup('createWindow:returned')
  void loadGuiUpdaterModule()
    .then((module) => module.showPostUpdateReleaseNotes())
    .catch((error) => {
      console.warn('[dagong-gui updater] failed to show post-update release notes:', error)
    })

  void pruneOnStartup().catch((err) => {
    console.warn('[dagong-gui] prune logs:', err)
  })

  if (resolveConfiguredApiKey(initial)) {
    setTimeout(() => {
      void dagongRuntimeAdapter.resolveExecutable(initial).catch((err) => {
        console.warn('[dagong-gui] prewarm Dagong binary:', err)
      })
    }, 1500)
  }

  app.on('second-instance', () => {
    revealMainWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else revealMainWindow()
  })
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[dagong-gui] startup failed:', error)
  dialog.showErrorBox('Dagong failed to start', message)
  app.quit()
})
}

app.on('window-all-closed', () => {
  void stopManagedRuntimes().catch((error) => {
    console.warn('[dagong-gui] failed to stop Dagong runtime:', error)
  })
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  isQuitting = true
  stopRuntimeWatchdog()
  stopCheckpointCleanupTimer()
  if (managedRuntimesStoppedForQuit) return
  event.preventDefault()
  void stopManagedRuntimesForQuit()
    .catch((error) => {
      console.warn('[dagong-gui] failed to stop Dagong runtime:', error)
      managedRuntimesStoppedForQuit = true
    })
    .finally(() => {
      app.quit()
    })
})
