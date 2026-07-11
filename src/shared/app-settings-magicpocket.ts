import {
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_IMAGE_GENERATION_PROTOCOL,
  IMAGE_GENERATION_QUALITIES,
  DEFAULT_KUN_DATA_DIR,
  DEFAULT_KUN_MODEL,
  DEFAULT_KUN_PORT,
  DEFAULT_MUSIC_GENERATION_PROTOCOL,
  MIN_KUN_LOCAL_PORT,
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  DEFAULT_SANDBOX_MODE,
  DEFAULT_TOOL_OUTPUT_MAX_BYTES,
  DEFAULT_TOOL_OUTPUT_MAX_LINES,
  DEFAULT_SPEECH_TO_TEXT_PROTOCOL,
  DEFAULT_TEXT_TO_SPEECH_PROTOCOL,
  DEFAULT_VIDEO_GENERATION_PROTOCOL,
  MODEL_REASONING_EFFORTS,
  MODEL_REASONING_REQUEST_PROTOCOLS,
  normalizeModelEndpointFormat,
  type AppSettingsV1,
  type MagicPocketComputerUseSettingsV1,
  type MagicPocketContextCompactionSettingsV1,
  type MagicPocketDesignQualitySettingsV1,
  type MagicPocketDesignQualityStrictness,
  type MagicPocketHistoryHygieneSettingsV1,
  type MagicPocketImageGenerationSettingsV1,
  type MagicPocketInstructionSettingsV1,
  type ImageGenerationQuality,
  type MagicPocketMcpSearchSettingsV1,
  type MagicPocketMusicGenerationSettingsV1,
  type MagicPocketRuntimeTuningSettingsV1,
  type MagicPocketRuntimeSettingsPatchV1,
  type MagicPocketRuntimeSettingsV1,
  type MagicPocketSettingsEnvelopePatchV1,
  type MagicPocketSettingsEnvelopeV1,
  type MagicPocketSpeechToTextSettingsV1,
  type MagicPocketStorageSettingsV1,
  type MagicPocketToolOutputLimitsSettingsV1,
  type MagicPocketTextToSpeechSettingsV1,
  type MagicPocketTokenEconomySettingsV1,
  type MagicPocketVideoGenerationSettingsV1,
  type ImageGenerationProtocol,
  type MusicGenerationProtocol,
  type ModelProviderInputModality,
  type ModelProviderMessagePartSupport,
  type ModelProviderModelProfilePatchV1,
  type ModelProviderModelProfileV1,
  type ModelProviderReasoningCapabilityV1,
  type ModelReasoningEffort,
  type ModelProviderSettingsV1,
  type SpeechToTextProtocol,
  type TextToSpeechProtocol,
  type VideoGenerationProtocol,
  type ApprovalPolicy,
  type SandboxMode
} from './app-settings-types'
import {
  normalizeModelProviderSettings,
  resolveMagicPocketRuntimeSettings
} from './app-settings-provider'
import {
  LOCAL_WHISPER_DEFAULT_DOWNLOAD_SOURCE_ID,
  isLocalWhisperDownloadSourceId
} from './local-whisper'

const LEGACY_COREAGENT_DATA_DIR = '~/.deepseekgui/coreagent'
const LEGACY_KUN_DEFAULT_MODEL = 'deepseek-chat'
// 旧版真实落盘默认值, 用于把升级前配置迁移到当前 MagicPocket 默认端口。
const LEGACY_LOCAL_HTTP_DEFAULT_PORT = 7878
const PREVIOUS_KUN_DEFAULT_PORT = 8899

type LegacyLocalHttpRuntimeSettingsV1 = {
  binaryPath: string
  port: number
  autoStart: boolean
  apiKey: string
  baseUrl: string
  runtimeToken: string
  extraCorsOrigins: string[]
  approvalPolicy: ApprovalPolicy
  sandboxMode: SandboxMode
}

type LegacyReasoningEffort = 'low' | 'medium' | 'high' | 'max'
type LegacyReasoningEditMode = 'review' | 'auto' | 'yolo' | 'plan'

type LegacyReasoningRuntimeSettingsV1 = {
  binaryPath: string
  autoStart: boolean
  apiKey: string
  baseUrl: string
  model: string
  reasoningEffort: LegacyReasoningEffort
  editMode: LegacyReasoningEditMode
}

/**
 * MagicPocket runtime settings. Mirrors the `magicpocket serve` CLI
 * options. It is the only active agent settings object the GUI
 * stores after legacy settings have been migrated.
 */
function legacyLocalHttpRuntimeDefaults(port = LEGACY_LOCAL_HTTP_DEFAULT_PORT): LegacyLocalHttpRuntimeSettingsV1 {
  return {
    binaryPath: '',
    port,
    autoStart: true,
    apiKey: '',
    baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
    runtimeToken: '',
    extraCorsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    sandboxMode: DEFAULT_SANDBOX_MODE
  }
}

function legacyReasoningRuntimeDefaults(): LegacyReasoningRuntimeSettingsV1 {
  return {
    binaryPath: '',
    autoStart: true,
    apiKey: '',
    baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
    model: LEGACY_KUN_DEFAULT_MODEL,
    reasoningEffort: 'medium',
    editMode: 'auto'
  }
}

export function defaultMagicPocketRuntimeSettings(
  port = DEFAULT_KUN_PORT
): MagicPocketRuntimeSettingsV1 {
  return {
    binaryPath: '',
    port,
    autoStart: true,
    apiKey: '',
    baseUrl: '',
    providerId: '',
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    runtimeToken: '',
    dataDir: DEFAULT_KUN_DATA_DIR,
    model: DEFAULT_KUN_MODEL,
    approvalPolicy: DEFAULT_APPROVAL_POLICY,
    sandboxMode: DEFAULT_SANDBOX_MODE,
    tokenEconomyMode: false,
    tokenEconomy: defaultMagicPocketTokenEconomySettings(),
    toolOutputLimits: defaultMagicPocketToolOutputLimitsSettings(),
    insecure: false,
    mcpSearch: defaultMagicPocketMcpSearchSettings(),
    storage: defaultMagicPocketStorageSettings(),
    contextCompaction: defaultMagicPocketContextCompactionSettings(),
    runtimeTuning: defaultMagicPocketRuntimeTuningSettings(),
    imageGeneration: defaultMagicPocketImageGenerationSettings(),
    speechToText: defaultMagicPocketSpeechToTextSettings(),
    textToSpeech: defaultMagicPocketTextToSpeechSettings(),
    musicGeneration: defaultMagicPocketMusicGenerationSettings(),
    videoGeneration: defaultMagicPocketVideoGenerationSettings(),
    modelProfiles: {},
    memoryEnabled: false,
    instructions: defaultMagicPocketInstructionSettings(),
    computerUse: defaultMagicPocketComputerUseSettings(),
    quality: defaultMagicPocketQualitySettings()
  }
}

export function defaultMagicPocketInstructionSettings(): MagicPocketInstructionSettingsV1 {
  return {
    enabled: true
  }
}

export function defaultMagicPocketToolOutputLimitsSettings(): MagicPocketToolOutputLimitsSettingsV1 {
  return {
    maxLines: DEFAULT_TOOL_OUTPUT_MAX_LINES,
    maxBytes: DEFAULT_TOOL_OUTPUT_MAX_BYTES
  }
}

export function defaultMagicPocketQualitySettings(): MagicPocketDesignQualitySettingsV1 {
  return {
    enabled: true,
    strictness: 'standard',
    ignoreRules: [],
    ignoreFiles: [],
    maxFindings: 12
  }
}

export function defaultMagicPocketComputerUseSettings(): MagicPocketComputerUseSettingsV1 {
  return {
    enabled: false,
    mode: 'auto',
    maxImageDimension: 1280,
    maxActionsPerTurn: 40
  }
}

export function defaultMagicPocketImageGenerationSettings(): MagicPocketImageGenerationSettingsV1 {
  return {
    enabled: false,
    providerId: '',
    protocol: DEFAULT_IMAGE_GENERATION_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    model: '',
    defaultSize: '',
    quality: 'auto',
    timeoutMs: 180_000
  }
}

export function defaultMagicPocketSpeechToTextSettings(): MagicPocketSpeechToTextSettingsV1 {
  return {
    enabled: false,
    providerId: '',
    protocol: DEFAULT_SPEECH_TO_TEXT_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    model: '',
    localWhisperDownloadSource: LOCAL_WHISPER_DEFAULT_DOWNLOAD_SOURCE_ID,
    language: '',
    timeoutMs: 60_000
  }
}

export function defaultMagicPocketTextToSpeechSettings(): MagicPocketTextToSpeechSettingsV1 {
  return {
    enabled: false,
    providerId: '',
    protocol: DEFAULT_TEXT_TO_SPEECH_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    model: '',
    voice: '',
    format: 'mp3',
    timeoutMs: 120_000
  }
}

export function defaultMagicPocketMusicGenerationSettings(): MagicPocketMusicGenerationSettingsV1 {
  return {
    enabled: false,
    providerId: '',
    protocol: DEFAULT_MUSIC_GENERATION_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    model: '',
    format: 'mp3',
    timeoutMs: 300_000
  }
}

export function defaultMagicPocketVideoGenerationSettings(): MagicPocketVideoGenerationSettingsV1 {
  return {
    enabled: false,
    providerId: '',
    protocol: DEFAULT_VIDEO_GENERATION_PROTOCOL,
    baseUrl: '',
    apiKey: '',
    model: '',
    defaultDuration: 6,
    defaultResolution: '1080P',
    timeoutMs: 900_000,
    pollIntervalMs: 10_000
  }
}

export function defaultMagicPocketMcpSearchSettings(): MagicPocketMcpSearchSettingsV1 {
  return {
    enabled: false,
    mode: 'auto',
    autoThresholdToolCount: 24,
    topKDefault: 5,
    topKMax: 10,
    minScore: 0.15
  }
}

export function defaultMagicPocketTokenEconomySettings(): MagicPocketTokenEconomySettingsV1 {
  return {
    enabled: false,
    compressToolDescriptions: true,
    compressToolResults: true,
    conciseResponses: true,
    historyHygiene: defaultMagicPocketHistoryHygieneSettings()
  }
}

export function defaultMagicPocketHistoryHygieneSettings(): MagicPocketHistoryHygieneSettingsV1 {
  return {
    maxToolResultLines: 320,
    maxToolResultBytes: 32 * 1024,
    maxToolResultTokens: 8_000,
    maxToolArgumentStringBytes: 8 * 1024,
    maxToolArgumentStringTokens: 2_000,
    maxArrayItems: 80
  }
}

export function defaultMagicPocketStorageSettings(): MagicPocketStorageSettingsV1 {
  return {
    backend: 'hybrid',
    sqlitePath: ''
  }
}

export function defaultMagicPocketContextCompactionSettings(): MagicPocketContextCompactionSettingsV1 {
  return {
    defaultSoftThreshold: 96_000,
    defaultHardThreshold: 108_800,
    // Default to model-generated summaries (codex-style): the model writes a
    // structured recap of the folded turns instead of a mechanical item list.
    // Falls back to the heuristic summary automatically on timeout/failure.
    summaryMode: 'model',
    summaryTimeoutMs: 15_000,
    summaryMaxTokens: 1_200,
    summaryInputMaxBytes: 96 * 1024
  }
}

export function defaultMagicPocketRuntimeTuningSettings(): MagicPocketRuntimeTuningSettingsV1 {
  return {
    streamIdleTimeoutMs: 450_000,
    toolStorm: {
      enabled: true,
      windowSize: 8,
      threshold: 3
    },
    toolArgumentRepair: {
      maxStringBytes: 512 * 1024
    }
  }
}

export function getMagicPocketRuntimeSettings(
  settings: AppSettingsV1
): MagicPocketRuntimeSettingsV1 {
  const raw = (settings as { agents?: { magicpocket?: Partial<MagicPocketRuntimeSettingsV1> } }).agents?.magicpocket
  return mergeMagicPocketRuntimeSettings(defaultMagicPocketRuntimeSettings(), raw)
}

export function magicpocketSettingsEnvelope(
  magicpocket: MagicPocketRuntimeSettingsV1
): MagicPocketSettingsEnvelopeV1 {
  return { magicpocket }
}

export function magicpocketSettingsPatch(
  magicpocket: MagicPocketRuntimeSettingsPatchV1 | undefined
): MagicPocketSettingsEnvelopePatchV1 {
  return magicpocket ? { magicpocket } : {}
}

export function mergeMagicPocketRuntimeSettings(
  current: MagicPocketRuntimeSettingsV1,
  patch: MagicPocketRuntimeSettingsPatchV1 | undefined
): MagicPocketRuntimeSettingsV1 {
  const currentMcpSearch = normalizeMagicPocketMcpSearchSettings(current.mcpSearch)
  const nextMcpSearch = normalizeMagicPocketMcpSearchSettings({
    ...currentMcpSearch,
    ...(patch?.mcpSearch ?? {})
  })
  const currentTokenEconomy = normalizeMagicPocketTokenEconomySettings(
    current.tokenEconomy,
    current.tokenEconomyMode
  )
  const patchedTokenEconomy = normalizeMagicPocketTokenEconomySettings({
    ...currentTokenEconomy,
    ...(patch?.tokenEconomy ?? {}),
    historyHygiene: {
      ...currentTokenEconomy.historyHygiene,
      ...(patch?.tokenEconomy?.historyHygiene ?? {})
    }
  }, currentTokenEconomy.enabled)
  const tokenEconomyEnabled = typeof patch?.tokenEconomy?.enabled === 'boolean'
    ? patch.tokenEconomy.enabled
    : typeof patch?.tokenEconomyMode === 'boolean'
      ? patch.tokenEconomyMode
      : patchedTokenEconomy.enabled
  const nextTokenEconomy = {
    ...patchedTokenEconomy,
    enabled: tokenEconomyEnabled
  }
  const currentToolOutputLimits = normalizeMagicPocketToolOutputLimitsSettings(current.toolOutputLimits)
  const nextToolOutputLimits = normalizeMagicPocketToolOutputLimitsSettings({
    ...currentToolOutputLimits,
    ...(patch?.toolOutputLimits ?? {})
  })
  const currentStorage = normalizeMagicPocketStorageSettings(current.storage)
  const nextStorage = normalizeMagicPocketStorageSettings({
    ...currentStorage,
    ...(patch?.storage ?? {})
  })
  const currentContextCompaction = normalizeMagicPocketContextCompactionSettings(current.contextCompaction)
  const contextCompactionPatch = patch?.contextCompaction ?? {}
  const nextContextCompactionInput = {
    ...currentContextCompaction,
    ...contextCompactionPatch
  }
  if (
    contextCompactionPatch.defaultSoftThreshold !== undefined &&
    contextCompactionPatch.defaultHardThreshold === undefined
  ) {
    nextContextCompactionInput.defaultHardThreshold = contextCompactionPatch.defaultSoftThreshold
  }
  const nextContextCompaction = normalizeMagicPocketContextCompactionSettings(nextContextCompactionInput)
  const currentImageGeneration = normalizeMagicPocketImageGenerationSettings(current.imageGeneration)
  const nextImageGeneration = normalizeMagicPocketImageGenerationSettings({
    ...currentImageGeneration,
    ...(patch?.imageGeneration ?? {})
  })
  const currentSpeechToText = normalizeMagicPocketSpeechToTextSettings(current.speechToText)
  const nextSpeechToText = normalizeMagicPocketSpeechToTextSettings({
    ...currentSpeechToText,
    ...(patch?.speechToText ?? {})
  })
  const currentTextToSpeech = normalizeMagicPocketTextToSpeechSettings(current.textToSpeech)
  const nextTextToSpeech = normalizeMagicPocketTextToSpeechSettings({
    ...currentTextToSpeech,
    ...(patch?.textToSpeech ?? {})
  })
  const currentMusicGeneration = normalizeMagicPocketMusicGenerationSettings(current.musicGeneration)
  const nextMusicGeneration = normalizeMagicPocketMusicGenerationSettings({
    ...currentMusicGeneration,
    ...(patch?.musicGeneration ?? {})
  })
  const currentVideoGeneration = normalizeMagicPocketVideoGenerationSettings(current.videoGeneration)
  const nextVideoGeneration = normalizeMagicPocketVideoGenerationSettings({
    ...currentVideoGeneration,
    ...(patch?.videoGeneration ?? {})
  })
  const currentComputerUse = normalizeMagicPocketComputerUseSettings(current.computerUse)
  const nextComputerUse = normalizeMagicPocketComputerUseSettings({
    ...currentComputerUse,
    ...(patch?.computerUse ?? {})
  })
  const currentQuality = normalizeMagicPocketQualitySettings(current.quality)
  const nextQuality = normalizeMagicPocketQualitySettings({
    ...currentQuality,
    ...(patch?.quality ?? {})
  })
  const currentRuntimeTuning = normalizeMagicPocketRuntimeTuningSettings(current.runtimeTuning)
  const nextRuntimeTuning = normalizeMagicPocketRuntimeTuningSettings({
    ...currentRuntimeTuning,
    ...(patch?.runtimeTuning
      ? {
          ...(patch.runtimeTuning.streamIdleTimeoutMs !== undefined
            ? { streamIdleTimeoutMs: patch.runtimeTuning.streamIdleTimeoutMs }
            : {}),
          toolStorm: {
            ...currentRuntimeTuning.toolStorm,
            ...(patch.runtimeTuning.toolStorm ?? {})
          },
          toolArgumentRepair: {
            ...currentRuntimeTuning.toolArgumentRepair,
            ...(patch.runtimeTuning.toolArgumentRepair ?? {})
          }
        }
      : {})
  })
  const nextModelProfiles = normalizeMagicPocketModelProfiles(current.modelProfiles, patch?.modelProfiles)
  const nextInstructions = {
    enabled: patch?.instructions?.enabled ?? current.instructions?.enabled ?? true
  }
  const nextPort = normalizeMagicPocketLocalPort(patch?.port ?? current.port, DEFAULT_KUN_PORT)
  // Optional role/small-model slots (agents.magicpocket.*). Patch wins when the key is
  // present (even as empty string => clear); otherwise inherit current. Empty/
  // whitespace strings are dropped so the field is omitted entirely.
  const nextRoleModelSlots = mergeOptionalModelSlot(current, patch)
  const nextRoleReasoningSlots = mergeOptionalReasoningSlot(current, patch)
  // NOTE: approvalPolicy/sandboxMode are merged through verbatim from the patch.
  // The unified 5-mode UI selector already resolves a mode to its concrete
  // {approvalPolicy, sandboxMode} pair via magicpocketToolPermissionModeSettings before
  // dispatching the patch. We must NOT re-canonicalize here: the mode->settings
  // mapping is lossy (only 5 of the 6x4 policy/sandbox combos are representable),
  // so round-tripping would silently rewrite valid non-UI values — e.g. demote
  // approvalPolicy 'never'/'suggest' to 'on-request', or escalate a 'read-only'/
  // 'external-sandbox' sandbox to 'danger-full-access' — on every settings merge.
  const merged: MagicPocketRuntimeSettingsV1 = {
    ...current,
    ...(patch ?? {}),
    port: nextPort,
    tokenEconomyMode: nextTokenEconomy.enabled,
    tokenEconomy: nextTokenEconomy,
    toolOutputLimits: nextToolOutputLimits,
    mcpSearch: nextMcpSearch,
    storage: nextStorage,
    contextCompaction: nextContextCompaction,
    runtimeTuning: nextRuntimeTuning,
    imageGeneration: nextImageGeneration,
    speechToText: nextSpeechToText,
    textToSpeech: nextTextToSpeech,
    musicGeneration: nextMusicGeneration,
    videoGeneration: nextVideoGeneration,
    modelProfiles: nextModelProfiles,
    memoryEnabled: patch?.memoryEnabled ?? current.memoryEnabled ?? false,
    instructions: nextInstructions,
    computerUse: nextComputerUse,
    quality: nextQuality,
    ...(patch?.subagents !== undefined
      ? { subagents: patch.subagents }
      : current.subagents !== undefined
        ? { subagents: current.subagents }
        : {})
  }
  // Optional model slots are authoritative from mergeOptionalModelSlot: strip any
  // verbatim copies leaked by the spreads above, then re-apply only the non-empty
  // ones so a cleared (empty-string) patch value removes the field entirely.
  for (const key of OPTIONAL_MODEL_SLOT_KEYS) delete merged[key]
  for (const key of OPTIONAL_REASONING_SLOT_KEYS) delete merged[key]
  return { ...merged, ...nextRoleModelSlots, ...nextRoleReasoningSlots }
}

const OPTIONAL_MODEL_SLOT_KEYS = [
  'smallModel',
  'smallModelProviderId',
  'titleModel',
  'titleProviderId',
  'summaryModel',
  'summaryProviderId',
  'codeReviewModel',
  'codeReviewProviderId'
] as const

type OptionalModelSlotKey = (typeof OPTIONAL_MODEL_SLOT_KEYS)[number]

function mergeOptionalModelSlot(
  current: MagicPocketRuntimeSettingsV1,
  patch: MagicPocketRuntimeSettingsPatchV1 | undefined
): Partial<Record<OptionalModelSlotKey, string>> {
  const out: Partial<Record<OptionalModelSlotKey, string>> = {}
  for (const key of OPTIONAL_MODEL_SLOT_KEYS) {
    const source = patch && key in patch ? patch[key] : current[key]
    const trimmed = typeof source === 'string' ? source.trim() : ''
    if (trimmed) out[key] = trimmed
  }
  return out
}

// Per-role reasoning-depth slots (agents.magicpocket.*ReasoningEffort). Validated against
// the ModelReasoningEffort enum; default 'off' is omitted so the field stays absent
// unless the user opts into a deeper level. Must be stripped + re-applied exactly
// like the model slots to avoid settings-sync round-trip drift.
const OPTIONAL_REASONING_SLOT_KEYS = [
  'titleReasoningEffort',
  'summaryReasoningEffort',
  'codeReviewReasoningEffort'
] as const

type OptionalReasoningSlotKey = (typeof OPTIONAL_REASONING_SLOT_KEYS)[number]

function mergeOptionalReasoningSlot(
  current: MagicPocketRuntimeSettingsV1,
  patch: MagicPocketRuntimeSettingsPatchV1 | undefined
): Partial<Record<OptionalReasoningSlotKey, ModelReasoningEffort>> {
  const out: Partial<Record<OptionalReasoningSlotKey, ModelReasoningEffort>> = {}
  for (const key of OPTIONAL_REASONING_SLOT_KEYS) {
    const source = patch && key in patch ? patch[key] : current[key]
    const normalized = normalizeReasoningEffortOrUndefined(source)
    // Omit 'off' (the default) and undefined so the field stays absent.
    if (normalized && normalized !== 'off') out[key] = normalized
  }
  return out
}

function normalizeReasoningEffortOrUndefined(
  value: unknown
): ModelReasoningEffort | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim() as ModelReasoningEffort
  return MODEL_REASONING_EFFORTS.includes(trimmed) ? trimmed : undefined
}

function normalizeMagicPocketImageGenerationSettings(
  input: Partial<MagicPocketImageGenerationSettingsV1> | undefined
): MagicPocketImageGenerationSettingsV1 {
  const defaults = defaultMagicPocketImageGenerationSettings()
  const defaultSize = typeof input?.defaultSize === 'string' ? input.defaultSize.trim() : ''
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeMagicPocketImageGenerationProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    defaultSize: /^(auto|\d+x\d+)$/.test(defaultSize) ? defaultSize : '',
    quality: normalizeMagicPocketImageGenerationQuality(input?.quality),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 600_000)
  }
}

function normalizeMagicPocketImageGenerationQuality(value: unknown): ImageGenerationQuality {
  return IMAGE_GENERATION_QUALITIES.includes(value as ImageGenerationQuality)
    ? value as ImageGenerationQuality
    : 'auto'
}

function normalizeMagicPocketImageGenerationProtocol(value: unknown): ImageGenerationProtocol {
  if (value === 'minimax-image') return 'minimax-image'
  if (value === 'codex-responses-image') return 'codex-responses-image'
  return DEFAULT_IMAGE_GENERATION_PROTOCOL
}

function normalizeMagicPocketSpeechToTextSettings(
  input: Partial<MagicPocketSpeechToTextSettingsV1> | undefined
): MagicPocketSpeechToTextSettingsV1 {
  const defaults = defaultMagicPocketSpeechToTextSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeMagicPocketSpeechToTextProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    localWhisperDownloadSource: isLocalWhisperDownloadSourceId(input?.localWhisperDownloadSource)
      ? input.localWhisperDownloadSource
      : defaults.localWhisperDownloadSource,
    language: typeof input?.language === 'string' ? input.language.trim().toLowerCase().slice(0, 16) : defaults.language,
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 600_000)
  }
}

function normalizeMagicPocketSpeechToTextProtocol(value: unknown): SpeechToTextProtocol {
  if (value === 'local-whisper') return 'local-whisper'
  return value === 'mimo-asr' ? 'mimo-asr' : DEFAULT_SPEECH_TO_TEXT_PROTOCOL
}

function normalizeMagicPocketTextToSpeechSettings(
  input: Partial<MagicPocketTextToSpeechSettingsV1> | undefined
): MagicPocketTextToSpeechSettingsV1 {
  const defaults = defaultMagicPocketTextToSpeechSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeMagicPocketTextToSpeechProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    voice: typeof input?.voice === 'string' ? input.voice.trim().slice(0, 128) : defaults.voice,
    format: normalizeAudioFormat(input?.format, defaults.format),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 600_000)
  }
}

function normalizeMagicPocketTextToSpeechProtocol(value: unknown): TextToSpeechProtocol {
  return value === 'minimax-t2a' || value === 'mimo-tts'
    ? value
    : DEFAULT_TEXT_TO_SPEECH_PROTOCOL
}

function normalizeMagicPocketMusicGenerationSettings(
  input: Partial<MagicPocketMusicGenerationSettingsV1> | undefined
): MagicPocketMusicGenerationSettingsV1 {
  const defaults = defaultMagicPocketMusicGenerationSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeMagicPocketMusicGenerationProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    format: normalizeAudioFormat(input?.format, defaults.format),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 900_000)
  }
}

function normalizeMagicPocketMusicGenerationProtocol(value: unknown): MusicGenerationProtocol {
  return value === 'minimax-music' ? 'minimax-music' : DEFAULT_MUSIC_GENERATION_PROTOCOL
}

function normalizeMagicPocketVideoGenerationSettings(
  input: Partial<MagicPocketVideoGenerationSettingsV1> | undefined
): MagicPocketVideoGenerationSettingsV1 {
  const defaults = defaultMagicPocketVideoGenerationSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeMagicPocketVideoGenerationProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    defaultDuration: boundedPositiveInt(input?.defaultDuration, defaults.defaultDuration, 60),
    defaultResolution: typeof input?.defaultResolution === 'string' && input.defaultResolution.trim()
      ? input.defaultResolution.trim().slice(0, 32)
      : defaults.defaultResolution,
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 1_800_000),
    pollIntervalMs: boundedPositiveInt(input?.pollIntervalMs, defaults.pollIntervalMs, 60_000)
  }
}

function normalizeMagicPocketVideoGenerationProtocol(value: unknown): VideoGenerationProtocol {
  return value === 'minimax-video' ? 'minimax-video' : DEFAULT_VIDEO_GENERATION_PROTOCOL
}

function normalizeMagicPocketComputerUseSettings(
  input: Partial<MagicPocketComputerUseSettingsV1> | undefined
): MagicPocketComputerUseSettingsV1 {
  const defaults = defaultMagicPocketComputerUseSettings()
  const mode = input?.mode === 'always' || input?.mode === 'off' || input?.mode === 'auto'
    ? input.mode
    : defaults.mode
  return {
    enabled: input?.enabled === true,
    mode,
    maxImageDimension: boundedPositiveInt(input?.maxImageDimension, defaults.maxImageDimension, 4096),
    maxActionsPerTurn: boundedPositiveInt(input?.maxActionsPerTurn, defaults.maxActionsPerTurn, 1000)
  }
}

function normalizeAudioFormat(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  return /^(mp3|wav|flac|pcm16)$/.test(normalized) ? normalized : fallback
}

function normalizeMagicPocketTokenEconomySettings(
  input: Partial<MagicPocketTokenEconomySettingsV1> | undefined,
  enabledFallback = false
): MagicPocketTokenEconomySettingsV1 {
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : enabledFallback,
    compressToolDescriptions: input?.compressToolDescriptions !== false,
    compressToolResults: input?.compressToolResults !== false,
    conciseResponses: input?.conciseResponses !== false,
    historyHygiene: normalizeMagicPocketHistoryHygieneSettings(input?.historyHygiene)
  }
}

function normalizeMagicPocketToolOutputLimitsSettings(
  input: Partial<MagicPocketToolOutputLimitsSettingsV1> | undefined
): MagicPocketToolOutputLimitsSettingsV1 {
  const defaults = defaultMagicPocketToolOutputLimitsSettings()
  return {
    maxLines: boundedPositiveInt(input?.maxLines, defaults.maxLines, 1_000_000),
    maxBytes: boundedPositiveInt(input?.maxBytes, defaults.maxBytes, 64 * 1024 * 1024)
  }
}

function normalizeMagicPocketHistoryHygieneSettings(
  input: Partial<MagicPocketHistoryHygieneSettingsV1> | undefined
): MagicPocketHistoryHygieneSettingsV1 {
  const defaults = defaultMagicPocketHistoryHygieneSettings()
  return {
    maxToolResultLines: boundedPositiveInt(input?.maxToolResultLines, defaults.maxToolResultLines, 100_000),
    maxToolResultBytes: boundedPositiveInt(input?.maxToolResultBytes, defaults.maxToolResultBytes, 8 * 1024 * 1024),
    maxToolResultTokens: boundedPositiveInt(input?.maxToolResultTokens, defaults.maxToolResultTokens, 256_000),
    maxToolArgumentStringBytes: boundedPositiveInt(
      input?.maxToolArgumentStringBytes,
      defaults.maxToolArgumentStringBytes,
      8 * 1024 * 1024
    ),
    maxToolArgumentStringTokens: boundedPositiveInt(
      input?.maxToolArgumentStringTokens,
      defaults.maxToolArgumentStringTokens,
      64_000
    ),
    maxArrayItems: boundedPositiveInt(input?.maxArrayItems, defaults.maxArrayItems, 10_000)
  }
}

function normalizeMagicPocketMcpSearchSettings(
  input: Partial<MagicPocketMcpSearchSettingsV1> | undefined
): MagicPocketMcpSearchSettingsV1 {
  const defaults = defaultMagicPocketMcpSearchSettings()
  const topKMax = positiveInt(input?.topKMax, defaults.topKMax)
  const topKDefault = Math.min(positiveInt(input?.topKDefault, defaults.topKDefault), topKMax)
  return {
    enabled: input?.enabled === true,
    mode: input?.mode === 'direct' || input?.mode === 'search' || input?.mode === 'auto'
      ? input.mode
      : defaults.mode,
    autoThresholdToolCount: positiveInt(input?.autoThresholdToolCount, defaults.autoThresholdToolCount),
    topKDefault,
    topKMax,
    minScore: nonNegativeNumber(input?.minScore, defaults.minScore)
  }
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

function boundedPositiveInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback
  return Math.min(Math.floor(value), max)
}

/** Like {@link boundedPositiveInt} but accepts `0` (e.g. "disabled"). */
function boundedNonNegativeInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback
  return Math.min(Math.floor(value), max)
}

function normalizeMagicPocketStorageSettings(
  input: Partial<MagicPocketStorageSettingsV1> | undefined
): MagicPocketStorageSettingsV1 {
  const defaults = defaultMagicPocketStorageSettings()
  return {
    backend: input?.backend === 'file' || input?.backend === 'hybrid'
      ? input.backend
      : defaults.backend,
    sqlitePath: typeof input?.sqlitePath === 'string' ? input.sqlitePath.trim() : defaults.sqlitePath
  }
}

function normalizeMagicPocketContextCompactionSettings(
  input: Partial<MagicPocketContextCompactionSettingsV1> | undefined
): MagicPocketContextCompactionSettingsV1 {
  const defaults = defaultMagicPocketContextCompactionSettings()
  const defaultSoftThreshold = boundedPositiveInt(input?.defaultSoftThreshold, defaults.defaultSoftThreshold)
  const defaultHardThreshold = input?.defaultSoftThreshold !== undefined && input?.defaultHardThreshold === undefined
    ? defaultSoftThreshold
    : defaults.defaultHardThreshold
  const requestedHardThreshold = boundedPositiveInt(input?.defaultHardThreshold, defaultHardThreshold)
  return {
    defaultSoftThreshold,
    defaultHardThreshold: Math.max(defaultSoftThreshold, requestedHardThreshold),
    // Compaction is always model-based now (the heuristic fold survives only as
    // a silent in-loop fallback when the model call fails). 'heuristic' is no
    // longer a user-selectable mode, so any stored value coerces to 'model' —
    // this self-heals stale 'heuristic' configs from the removed UI toggle.
    summaryMode: 'model',
    summaryTimeoutMs: boundedPositiveInt(input?.summaryTimeoutMs, defaults.summaryTimeoutMs, 120_000),
    summaryMaxTokens: boundedPositiveInt(input?.summaryMaxTokens, defaults.summaryMaxTokens, 16_000),
    summaryInputMaxBytes: boundedPositiveInt(input?.summaryInputMaxBytes, defaults.summaryInputMaxBytes, 8 * 1024 * 1024),
    ...(typeof input?.summaryModel === 'string' && input.summaryModel.trim() ? { summaryModel: input.summaryModel.trim() } : {}),
    ...(typeof input?.summaryProviderId === 'string' && input.summaryProviderId.trim() ? { summaryProviderId: input.summaryProviderId.trim() } : {})
  }
}

function normalizeMagicPocketRuntimeTuningSettings(
  input: Partial<MagicPocketRuntimeTuningSettingsV1> | undefined
): MagicPocketRuntimeTuningSettingsV1 {
  const defaults = defaultMagicPocketRuntimeTuningSettings()
  return {
    streamIdleTimeoutMs: boundedNonNegativeInt(
      input?.streamIdleTimeoutMs,
      defaults.streamIdleTimeoutMs,
      3_600_000
    ),
    toolStorm: {
      enabled: input?.toolStorm?.enabled !== false,
      windowSize: boundedPositiveInt(input?.toolStorm?.windowSize, defaults.toolStorm.windowSize, 128),
      threshold: Math.max(2, boundedPositiveInt(input?.toolStorm?.threshold, defaults.toolStorm.threshold, 128))
    },
    toolArgumentRepair: {
      maxStringBytes: boundedPositiveInt(
        input?.toolArgumentRepair?.maxStringBytes,
        defaults.toolArgumentRepair.maxStringBytes,
        16 * 1024 * 1024
      )
    }
  }
}

const KUN_DESIGN_QUALITY_STRICTNESS: readonly MagicPocketDesignQualityStrictness[] = [
  'relaxed',
  'standard',
  'strict'
]

function normalizeMagicPocketQualitySettings(
  input: Partial<MagicPocketDesignQualitySettingsV1> | undefined
): MagicPocketDesignQualitySettingsV1 {
  const defaults = defaultMagicPocketQualitySettings()
  const strictness =
    input?.strictness && KUN_DESIGN_QUALITY_STRICTNESS.includes(input.strictness)
      ? input.strictness
      : defaults.strictness
  const sanitizeList = (list: unknown): string[] =>
    Array.isArray(list)
      ? list.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : defaults.ignoreRules
  return {
    enabled: input?.enabled !== false,
    strictness,
    ignoreRules: sanitizeList(input?.ignoreRules),
    ignoreFiles: sanitizeList(input?.ignoreFiles),
    maxFindings: boundedPositiveInt(input?.maxFindings, defaults.maxFindings, 100)
  }
}

function normalizeMagicPocketModelProfiles(
  current: Record<string, ModelProviderModelProfileV1> | undefined,
  patch: Record<string, ModelProviderModelProfilePatchV1 | null> | undefined
): Record<string, ModelProviderModelProfileV1> {
  const profiles: Record<string, ModelProviderModelProfileV1> = {}
  for (const [rawModelId, rawProfile] of Object.entries(current ?? {})) {
    const modelId = normalizeModelProfileId(rawModelId)
    if (!modelId) continue
    profiles[modelId] = normalizeMagicPocketModelProfile(rawProfile)
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return profiles
  for (const [rawModelId, rawProfile] of Object.entries(patch)) {
    const modelId = normalizeModelProfileId(rawModelId)
    if (!modelId) continue
    if (rawProfile === null) {
      delete profiles[modelId]
      continue
    }
    profiles[modelId] = normalizeMagicPocketModelProfile({
      ...(profiles[modelId] ?? {}),
      ...rawProfile
    })
  }
  return profiles
}

function normalizeMagicPocketModelProfile(
  input: ModelProviderModelProfilePatchV1 | undefined
): ModelProviderModelProfileV1 {
  const inputModalities = normalizeMagicPocketModelInputModalities(input?.inputModalities)
  const fallbackMessageParts: ModelProviderMessagePartSupport[] = inputModalities.includes('image')
    ? ['text', 'image_url']
    : ['text']
  const contextWindowTokens = typeof input?.contextWindowTokens === 'number' &&
    Number.isInteger(input.contextWindowTokens) &&
    input.contextWindowTokens > 0
    ? input.contextWindowTokens
    : undefined
  const maxOutputTokens = typeof input?.maxOutputTokens === 'number' &&
    Number.isInteger(input.maxOutputTokens) &&
    input.maxOutputTokens > 0
    ? input.maxOutputTokens
    : undefined
  const reasoning = normalizeMagicPocketReasoningCapability(input?.reasoning)
  const endpointFormat = typeof input?.endpointFormat === 'string' && input.endpointFormat.trim()
    ? normalizeModelEndpointFormat(input.endpointFormat)
    : undefined
  return {
    ...(normalizeMagicPocketProfileAliases(input?.aliases).length
      ? { aliases: normalizeMagicPocketProfileAliases(input?.aliases) }
      : {}),
    ...(contextWindowTokens ? { contextWindowTokens } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    inputModalities,
    outputModalities: normalizeMagicPocketModelInputModalities(input?.outputModalities),
    supportsToolCalling: input?.supportsToolCalling !== false,
    messageParts: normalizeMagicPocketModelMessageParts(input?.messageParts, fallbackMessageParts),
    ...(reasoning ? { reasoning } : {}),
    ...(endpointFormat ? { endpointFormat } : {})
  }
}

function normalizeMagicPocketReasoningCapability(
  input: ModelProviderModelProfilePatchV1['reasoning'] | undefined
): ModelProviderReasoningCapabilityV1 | undefined {
  if (!input || typeof input !== 'object') return undefined
  const supportedEfforts = normalizeMagicPocketReasoningEfforts(input.supportedEfforts)
  if (supportedEfforts.length === 0) return undefined
  const defaultEffort = normalizeMagicPocketReasoningEffort(input.defaultEffort)
  const requestProtocol = normalizeMagicPocketReasoningRequestProtocol(input.requestProtocol)
  if (!requestProtocol) return undefined
  return {
    supportedEfforts,
    defaultEffort: defaultEffort && supportedEfforts.includes(defaultEffort)
      ? defaultEffort
      : supportedEfforts[0],
    requestProtocol
  }
}

function normalizeMagicPocketReasoningEfforts(value: unknown): ModelProviderReasoningCapabilityV1['supportedEfforts'] {
  if (!Array.isArray(value)) return []
  const efforts: ModelProviderReasoningCapabilityV1['supportedEfforts'] = []
  for (const item of value) {
    const effort = normalizeMagicPocketReasoningEffort(item)
    if (effort && !efforts.includes(effort)) efforts.push(effort)
  }
  return efforts
}

function normalizeMagicPocketReasoningEffort(value: unknown): ModelProviderReasoningCapabilityV1['defaultEffort'] | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return MODEL_REASONING_EFFORTS.includes(normalized as ModelProviderReasoningCapabilityV1['defaultEffort'])
    ? normalized as ModelProviderReasoningCapabilityV1['defaultEffort']
    : undefined
}

function normalizeMagicPocketReasoningRequestProtocol(
  value: unknown
): ModelProviderReasoningCapabilityV1['requestProtocol'] | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return MODEL_REASONING_REQUEST_PROTOCOLS.includes(normalized as ModelProviderReasoningCapabilityV1['requestProtocol'])
    ? normalized as ModelProviderReasoningCapabilityV1['requestProtocol']
    : undefined
}

function normalizeModelProfileId(value: string): string {
  return value.trim().slice(0, 128)
}

function normalizeMagicPocketProfileAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const aliases: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const alias = item.trim().slice(0, 128)
    if (alias && !aliases.includes(alias)) aliases.push(alias)
    if (aliases.length >= 50) break
  }
  return aliases
}

function normalizeMagicPocketModelInputModalities(value: unknown): ModelProviderInputModality[] {
  if (!Array.isArray(value)) return ['text']
  const modalities: ModelProviderInputModality[] = []
  for (const item of value) {
    if ((item === 'text' || item === 'image') && !modalities.includes(item)) {
      modalities.push(item)
    }
    if (modalities.length >= 8) break
  }
  return modalities.length > 0 ? modalities : ['text']
}

function normalizeMagicPocketModelMessageParts(
  value: unknown,
  fallback: ModelProviderMessagePartSupport[]
): ModelProviderMessagePartSupport[] {
  if (!Array.isArray(value)) return [...fallback]
  const parts: ModelProviderMessagePartSupport[] = []
  for (const item of value) {
    if (
      (item === 'text' || item === 'image_url' || item === 'input_image') &&
      !parts.includes(item)
    ) {
      parts.push(item)
    }
    if (parts.length >= 8) break
  }
  return parts.length > 0 ? parts : [...fallback]
}

export function withMagicPocketRuntimeSettings(
  settings: AppSettingsV1,
  magicpocket: MagicPocketRuntimeSettingsV1
): AppSettingsV1 {
  return {
    ...settings,
    agents: magicpocketSettingsEnvelope(magicpocket)
  }
}

export function applyMagicPocketRuntimePatch(
  settings: AppSettingsV1,
  patch: MagicPocketRuntimeSettingsPatchV1 | undefined
): AppSettingsV1 {
  return withMagicPocketRuntimeSettings(
    settings,
    mergeMagicPocketRuntimeSettings(getMagicPocketRuntimeSettings(settings), patch)
  )
}

export function isMagicPocketRuntimeInsecure(runtime: Pick<MagicPocketRuntimeSettingsV1, 'insecure' | 'runtimeToken'>): boolean {
  return runtime.insecure === true
}

export function getActiveAgentApiKey(settings: AppSettingsV1): string {
  return resolveMagicPocketRuntimeSettings(settings).apiKey?.trim() ?? ''
}

export function mergeAgentRuntimeSettings(
  defaults: MagicPocketSettingsEnvelopeV1,
  patch: MagicPocketSettingsEnvelopePatchV1 | undefined
): MagicPocketSettingsEnvelopeV1 {
  return magicpocketSettingsEnvelope(
    mergeMagicPocketRuntimeSettings(defaults.magicpocket, patch?.magicpocket)
  )
}

type LegacyAgentsSettingsShape = {
  magicpocket?: Partial<MagicPocketRuntimeSettingsV1>
  codewhale?: Partial<LegacyLocalHttpRuntimeSettingsV1>
  reasonix?: Partial<LegacyReasoningRuntimeSettingsV1>
}

type LegacyAppSettingsShape = Partial<Omit<AppSettingsV1, 'agents' | 'provider'>> & {
  agents?: LegacyAgentsSettingsShape
  provider?: Partial<ModelProviderSettingsV1>
  deepseek?: Partial<LegacyLocalHttpRuntimeSettingsV1>
  /** Legacy single-provider discriminator. Read only inside migration. */
  agentProvider?: unknown
}

function nonEmptyStringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function upgradeLegacyMagicPocketDefaultDataDir(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_KUN_DATA_DIR
  const trimmed = value.trim()
  const normalized = trimmed.replace(/\\/g, '/').toLowerCase()
  if (
    !trimmed ||
    normalized === LEGACY_COREAGENT_DATA_DIR ||
    normalized.endsWith('/.deepseekgui/coreagent')
  ) {
    return DEFAULT_KUN_DATA_DIR
  }
  return trimmed
}

function upgradeLegacyMagicPocketDefaultModel(value: unknown, fallback: string): string {
  const model = nonEmptyStringOrFallback(value, fallback).trim()
  return model === LEGACY_KUN_DEFAULT_MODEL ? DEFAULT_KUN_MODEL : model
}

function upgradeLegacyMagicPocketDefaultPort(value: unknown, fallback: number): number {
  return value === LEGACY_LOCAL_HTTP_DEFAULT_PORT ? DEFAULT_KUN_PORT : fallback
}

function normalizeMagicPocketLocalPort(value: unknown, fallback: number): number {
  if (value === LEGACY_LOCAL_HTTP_DEFAULT_PORT || value === PREVIOUS_KUN_DEFAULT_PORT) {
    return DEFAULT_KUN_PORT
  }
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(65_535, Math.max(MIN_KUN_LOCAL_PORT, Math.floor(parsed)))
}

export function migrateLegacyAppSettings(parsed: LegacyAppSettingsShape): Partial<AppSettingsV1> {
  const rawAgentProvider = parsed.agentProvider
  const isReasoningLegacy = rawAgentProvider === 'reasonix'
  const hasProviderSettings = typeof parsed.provider === 'object' && parsed.provider !== null
  const defaults = legacyLocalHttpRuntimeDefaults()
  const magicpocketDefaults = defaultMagicPocketRuntimeSettings()
  const legacyDeepseek = parsed.deepseek ?? {}
  const legacyLocalHttp = {
    ...defaults,
    ...(parsed.agents?.codewhale ?? {}),
    ...legacyDeepseek
  }
  const legacyReasoning = {
    ...legacyReasoningRuntimeDefaults(),
    ...(parsed.agents?.reasonix ?? {})
  }
  const explicitMagicPocket: Partial<MagicPocketRuntimeSettingsV1> = parsed.agents?.magicpocket ?? {}
  const legacySource = isReasoningLegacy ? legacyReasoning : legacyLocalHttp
  const legacySeed = {
    binaryPath: magicpocketDefaults.binaryPath,
    port: isReasoningLegacy
      ? magicpocketDefaults.port
      : upgradeLegacyMagicPocketDefaultPort(legacyLocalHttp.port, legacyLocalHttp.port),
    autoStart: isReasoningLegacy ? legacyReasoning.autoStart : legacyLocalHttp.autoStart,
    apiKey: legacySource.apiKey,
    baseUrl: legacySource.baseUrl,
    providerId: '',
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    runtimeToken: isReasoningLegacy ? magicpocketDefaults.runtimeToken : legacyLocalHttp.runtimeToken,
    model: isReasoningLegacy ? legacyReasoning.model : magicpocketDefaults.model,
    approvalPolicy: isReasoningLegacy ? magicpocketDefaults.approvalPolicy : legacyLocalHttp.approvalPolicy,
    sandboxMode: isReasoningLegacy ? magicpocketDefaults.sandboxMode : legacyLocalHttp.sandboxMode
  }
  const provider = normalizeModelProviderSettings({
    apiKey: hasProviderSettings
      ? parsed.provider?.apiKey
      : nonEmptyStringOrFallback(explicitMagicPocket.apiKey, legacySeed.apiKey),
    baseUrl: hasProviderSettings
      ? parsed.provider?.baseUrl
      : nonEmptyStringOrFallback(explicitMagicPocket.baseUrl, legacySeed.baseUrl),
    proxy: parsed.provider?.proxy,
    providers: parsed.provider?.providers
  })
  const magicpocket = {
    ...magicpocketDefaults,
    ...legacySeed,
    ...explicitMagicPocket,
    port: normalizeMagicPocketLocalPort(explicitMagicPocket.port ?? legacySeed.port, magicpocketDefaults.port),
    apiKey: hasProviderSettings ? explicitMagicPocket.apiKey ?? '' : '',
    baseUrl: hasProviderSettings ? explicitMagicPocket.baseUrl ?? '' : '',
    runtimeToken: nonEmptyStringOrFallback(explicitMagicPocket.runtimeToken, legacySeed.runtimeToken),
    dataDir: upgradeLegacyMagicPocketDefaultDataDir(explicitMagicPocket.dataDir),
    model: upgradeLegacyMagicPocketDefaultModel(explicitMagicPocket.model, legacySeed.model),
    tokenEconomyMode: typeof explicitMagicPocket.tokenEconomy?.enabled === 'boolean'
      ? explicitMagicPocket.tokenEconomy.enabled
      : explicitMagicPocket.tokenEconomyMode ?? magicpocketDefaults.tokenEconomyMode,
    tokenEconomy: normalizeMagicPocketTokenEconomySettings(
      explicitMagicPocket.tokenEconomy,
      explicitMagicPocket.tokenEconomyMode ?? magicpocketDefaults.tokenEconomyMode
    ),
    toolOutputLimits: normalizeMagicPocketToolOutputLimitsSettings(explicitMagicPocket.toolOutputLimits),
    mcpSearch: normalizeMagicPocketMcpSearchSettings(explicitMagicPocket.mcpSearch),
    storage: normalizeMagicPocketStorageSettings(explicitMagicPocket.storage),
    contextCompaction: normalizeMagicPocketContextCompactionSettings(explicitMagicPocket.contextCompaction),
    runtimeTuning: normalizeMagicPocketRuntimeTuningSettings(explicitMagicPocket.runtimeTuning),
    imageGeneration: normalizeMagicPocketImageGenerationSettings(explicitMagicPocket.imageGeneration),
    speechToText: normalizeMagicPocketSpeechToTextSettings(explicitMagicPocket.speechToText),
    textToSpeech: normalizeMagicPocketTextToSpeechSettings(explicitMagicPocket.textToSpeech),
    musicGeneration: normalizeMagicPocketMusicGenerationSettings(explicitMagicPocket.musicGeneration),
    videoGeneration: normalizeMagicPocketVideoGenerationSettings(explicitMagicPocket.videoGeneration),
    quality: normalizeMagicPocketQualitySettings(explicitMagicPocket.quality)
  }
  // Strip the legacy `agentProvider` discriminator and the legacy
  // per-provider settings from the surfaced migration result. The
  // runtime now has a single agent (MagicPocket) and we no longer
  // round-trip the legacy value into the new settings shape.
  const { deepseek: _legacyDeepseek, agents: _agents, agentProvider: _agentProvider, ...rest } = parsed
  void _legacyDeepseek
  void _agents
  void _agentProvider
  return {
    ...rest,
    provider,
    agents: {
      magicpocket
    }
  }
}
