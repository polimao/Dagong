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
  type DagongComputerUseSettingsV1,
  type DagongContextCompactionSettingsV1,
  type DagongDesignQualitySettingsV1,
  type DagongDesignQualityStrictness,
  type DagongHistoryHygieneSettingsV1,
  type DagongImageGenerationSettingsV1,
  type DagongInstructionSettingsV1,
  type ImageGenerationQuality,
  type DagongMcpSearchSettingsV1,
  type DagongMusicGenerationSettingsV1,
  type DagongRuntimeTuningSettingsV1,
  type DagongRuntimeSettingsPatchV1,
  type DagongRuntimeSettingsV1,
  type DagongSettingsEnvelopePatchV1,
  type DagongSettingsEnvelopeV1,
  type DagongSpeechToTextSettingsV1,
  type DagongStorageSettingsV1,
  type DagongToolOutputLimitsSettingsV1,
  type DagongTextToSpeechSettingsV1,
  type DagongTokenEconomySettingsV1,
  type DagongVideoGenerationSettingsV1,
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
  resolveDagongRuntimeSettings
} from './app-settings-provider'
import {
  LOCAL_WHISPER_DEFAULT_DOWNLOAD_SOURCE_ID,
  isLocalWhisperDownloadSourceId
} from './local-whisper'

const LEGACY_COREAGENT_DATA_DIR = '~/.deepseekgui/coreagent'
const LEGACY_KUN_DEFAULT_MODEL = 'deepseek-chat'
// 旧版真实落盘默认值, 用于把升级前配置迁移到当前 Dagong 默认端口。
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
 * Dagong runtime settings. Mirrors the `dagong serve` CLI
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

export function defaultDagongRuntimeSettings(
  port = DEFAULT_KUN_PORT
): DagongRuntimeSettingsV1 {
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
    tokenEconomy: defaultDagongTokenEconomySettings(),
    toolOutputLimits: defaultDagongToolOutputLimitsSettings(),
    insecure: false,
    mcpSearch: defaultDagongMcpSearchSettings(),
    storage: defaultDagongStorageSettings(),
    contextCompaction: defaultDagongContextCompactionSettings(),
    runtimeTuning: defaultDagongRuntimeTuningSettings(),
    imageGeneration: defaultDagongImageGenerationSettings(),
    speechToText: defaultDagongSpeechToTextSettings(),
    textToSpeech: defaultDagongTextToSpeechSettings(),
    musicGeneration: defaultDagongMusicGenerationSettings(),
    videoGeneration: defaultDagongVideoGenerationSettings(),
    modelProfiles: {},
    memoryEnabled: false,
    instructions: defaultDagongInstructionSettings(),
    computerUse: defaultDagongComputerUseSettings(),
    quality: defaultDagongQualitySettings()
  }
}

export function defaultDagongInstructionSettings(): DagongInstructionSettingsV1 {
  return {
    enabled: true
  }
}

export function defaultDagongToolOutputLimitsSettings(): DagongToolOutputLimitsSettingsV1 {
  return {
    maxLines: DEFAULT_TOOL_OUTPUT_MAX_LINES,
    maxBytes: DEFAULT_TOOL_OUTPUT_MAX_BYTES
  }
}

export function defaultDagongQualitySettings(): DagongDesignQualitySettingsV1 {
  return {
    enabled: true,
    strictness: 'standard',
    ignoreRules: [],
    ignoreFiles: [],
    maxFindings: 12
  }
}

export function defaultDagongComputerUseSettings(): DagongComputerUseSettingsV1 {
  return {
    enabled: false,
    mode: 'auto',
    maxImageDimension: 1280,
    maxActionsPerTurn: 40
  }
}

export function defaultDagongImageGenerationSettings(): DagongImageGenerationSettingsV1 {
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

export function defaultDagongSpeechToTextSettings(): DagongSpeechToTextSettingsV1 {
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

export function defaultDagongTextToSpeechSettings(): DagongTextToSpeechSettingsV1 {
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

export function defaultDagongMusicGenerationSettings(): DagongMusicGenerationSettingsV1 {
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

export function defaultDagongVideoGenerationSettings(): DagongVideoGenerationSettingsV1 {
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

export function defaultDagongMcpSearchSettings(): DagongMcpSearchSettingsV1 {
  return {
    enabled: false,
    mode: 'auto',
    autoThresholdToolCount: 24,
    topKDefault: 5,
    topKMax: 10,
    minScore: 0.15
  }
}

export function defaultDagongTokenEconomySettings(): DagongTokenEconomySettingsV1 {
  return {
    enabled: false,
    compressToolDescriptions: true,
    compressToolResults: true,
    conciseResponses: true,
    historyHygiene: defaultDagongHistoryHygieneSettings()
  }
}

export function defaultDagongHistoryHygieneSettings(): DagongHistoryHygieneSettingsV1 {
  return {
    maxToolResultLines: 320,
    maxToolResultBytes: 32 * 1024,
    maxToolResultTokens: 8_000,
    maxToolArgumentStringBytes: 8 * 1024,
    maxToolArgumentStringTokens: 2_000,
    maxArrayItems: 80
  }
}

export function defaultDagongStorageSettings(): DagongStorageSettingsV1 {
  return {
    backend: 'hybrid',
    sqlitePath: ''
  }
}

export function defaultDagongContextCompactionSettings(): DagongContextCompactionSettingsV1 {
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

export function defaultDagongRuntimeTuningSettings(): DagongRuntimeTuningSettingsV1 {
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

export function getDagongRuntimeSettings(
  settings: AppSettingsV1
): DagongRuntimeSettingsV1 {
  const raw = (settings as { agents?: { dagong?: Partial<DagongRuntimeSettingsV1> } }).agents?.dagong
  return mergeDagongRuntimeSettings(defaultDagongRuntimeSettings(), raw)
}

export function dagongSettingsEnvelope(
  dagong: DagongRuntimeSettingsV1
): DagongSettingsEnvelopeV1 {
  return { dagong }
}

export function dagongSettingsPatch(
  dagong: DagongRuntimeSettingsPatchV1 | undefined
): DagongSettingsEnvelopePatchV1 {
  return dagong ? { dagong } : {}
}

export function mergeDagongRuntimeSettings(
  current: DagongRuntimeSettingsV1,
  patch: DagongRuntimeSettingsPatchV1 | undefined
): DagongRuntimeSettingsV1 {
  const currentMcpSearch = normalizeDagongMcpSearchSettings(current.mcpSearch)
  const nextMcpSearch = normalizeDagongMcpSearchSettings({
    ...currentMcpSearch,
    ...(patch?.mcpSearch ?? {})
  })
  const currentTokenEconomy = normalizeDagongTokenEconomySettings(
    current.tokenEconomy,
    current.tokenEconomyMode
  )
  const patchedTokenEconomy = normalizeDagongTokenEconomySettings({
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
  const currentToolOutputLimits = normalizeDagongToolOutputLimitsSettings(current.toolOutputLimits)
  const nextToolOutputLimits = normalizeDagongToolOutputLimitsSettings({
    ...currentToolOutputLimits,
    ...(patch?.toolOutputLimits ?? {})
  })
  const currentStorage = normalizeDagongStorageSettings(current.storage)
  const nextStorage = normalizeDagongStorageSettings({
    ...currentStorage,
    ...(patch?.storage ?? {})
  })
  const currentContextCompaction = normalizeDagongContextCompactionSettings(current.contextCompaction)
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
  const nextContextCompaction = normalizeDagongContextCompactionSettings(nextContextCompactionInput)
  const currentImageGeneration = normalizeDagongImageGenerationSettings(current.imageGeneration)
  const nextImageGeneration = normalizeDagongImageGenerationSettings({
    ...currentImageGeneration,
    ...(patch?.imageGeneration ?? {})
  })
  const currentSpeechToText = normalizeDagongSpeechToTextSettings(current.speechToText)
  const nextSpeechToText = normalizeDagongSpeechToTextSettings({
    ...currentSpeechToText,
    ...(patch?.speechToText ?? {})
  })
  const currentTextToSpeech = normalizeDagongTextToSpeechSettings(current.textToSpeech)
  const nextTextToSpeech = normalizeDagongTextToSpeechSettings({
    ...currentTextToSpeech,
    ...(patch?.textToSpeech ?? {})
  })
  const currentMusicGeneration = normalizeDagongMusicGenerationSettings(current.musicGeneration)
  const nextMusicGeneration = normalizeDagongMusicGenerationSettings({
    ...currentMusicGeneration,
    ...(patch?.musicGeneration ?? {})
  })
  const currentVideoGeneration = normalizeDagongVideoGenerationSettings(current.videoGeneration)
  const nextVideoGeneration = normalizeDagongVideoGenerationSettings({
    ...currentVideoGeneration,
    ...(patch?.videoGeneration ?? {})
  })
  const currentComputerUse = normalizeDagongComputerUseSettings(current.computerUse)
  const nextComputerUse = normalizeDagongComputerUseSettings({
    ...currentComputerUse,
    ...(patch?.computerUse ?? {})
  })
  const currentQuality = normalizeDagongQualitySettings(current.quality)
  const nextQuality = normalizeDagongQualitySettings({
    ...currentQuality,
    ...(patch?.quality ?? {})
  })
  const currentRuntimeTuning = normalizeDagongRuntimeTuningSettings(current.runtimeTuning)
  const nextRuntimeTuning = normalizeDagongRuntimeTuningSettings({
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
  const nextModelProfiles = normalizeDagongModelProfiles(current.modelProfiles, patch?.modelProfiles)
  const nextInstructions = {
    enabled: patch?.instructions?.enabled ?? current.instructions?.enabled ?? true
  }
  const nextPort = normalizeDagongLocalPort(patch?.port ?? current.port, DEFAULT_KUN_PORT)
  // Optional role/small-model slots (agents.dagong.*). Patch wins when the key is
  // present (even as empty string => clear); otherwise inherit current. Empty/
  // whitespace strings are dropped so the field is omitted entirely.
  const nextRoleModelSlots = mergeOptionalModelSlot(current, patch)
  const nextRoleReasoningSlots = mergeOptionalReasoningSlot(current, patch)
  // NOTE: approvalPolicy/sandboxMode are merged through verbatim from the patch.
  // The unified 5-mode UI selector already resolves a mode to its concrete
  // {approvalPolicy, sandboxMode} pair via dagongToolPermissionModeSettings before
  // dispatching the patch. We must NOT re-canonicalize here: the mode->settings
  // mapping is lossy (only 5 of the 6x4 policy/sandbox combos are representable),
  // so round-tripping would silently rewrite valid non-UI values — e.g. demote
  // approvalPolicy 'never'/'suggest' to 'on-request', or escalate a 'read-only'/
  // 'external-sandbox' sandbox to 'danger-full-access' — on every settings merge.
  const merged: DagongRuntimeSettingsV1 = {
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
  current: DagongRuntimeSettingsV1,
  patch: DagongRuntimeSettingsPatchV1 | undefined
): Partial<Record<OptionalModelSlotKey, string>> {
  const out: Partial<Record<OptionalModelSlotKey, string>> = {}
  for (const key of OPTIONAL_MODEL_SLOT_KEYS) {
    const source = patch && key in patch ? patch[key] : current[key]
    const trimmed = typeof source === 'string' ? source.trim() : ''
    if (trimmed) out[key] = trimmed
  }
  return out
}

// Per-role reasoning-depth slots (agents.dagong.*ReasoningEffort). Validated against
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
  current: DagongRuntimeSettingsV1,
  patch: DagongRuntimeSettingsPatchV1 | undefined
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

function normalizeDagongImageGenerationSettings(
  input: Partial<DagongImageGenerationSettingsV1> | undefined
): DagongImageGenerationSettingsV1 {
  const defaults = defaultDagongImageGenerationSettings()
  const defaultSize = typeof input?.defaultSize === 'string' ? input.defaultSize.trim() : ''
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeDagongImageGenerationProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    defaultSize: /^(auto|\d+x\d+)$/.test(defaultSize) ? defaultSize : '',
    quality: normalizeDagongImageGenerationQuality(input?.quality),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 600_000)
  }
}

function normalizeDagongImageGenerationQuality(value: unknown): ImageGenerationQuality {
  return IMAGE_GENERATION_QUALITIES.includes(value as ImageGenerationQuality)
    ? value as ImageGenerationQuality
    : 'auto'
}

function normalizeDagongImageGenerationProtocol(value: unknown): ImageGenerationProtocol {
  if (value === 'minimax-image') return 'minimax-image'
  if (value === 'codex-responses-image') return 'codex-responses-image'
  return DEFAULT_IMAGE_GENERATION_PROTOCOL
}

function normalizeDagongSpeechToTextSettings(
  input: Partial<DagongSpeechToTextSettingsV1> | undefined
): DagongSpeechToTextSettingsV1 {
  const defaults = defaultDagongSpeechToTextSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeDagongSpeechToTextProtocol(input?.protocol),
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

function normalizeDagongSpeechToTextProtocol(value: unknown): SpeechToTextProtocol {
  if (value === 'local-whisper') return 'local-whisper'
  return value === 'mimo-asr' ? 'mimo-asr' : DEFAULT_SPEECH_TO_TEXT_PROTOCOL
}

function normalizeDagongTextToSpeechSettings(
  input: Partial<DagongTextToSpeechSettingsV1> | undefined
): DagongTextToSpeechSettingsV1 {
  const defaults = defaultDagongTextToSpeechSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeDagongTextToSpeechProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    voice: typeof input?.voice === 'string' ? input.voice.trim().slice(0, 128) : defaults.voice,
    format: normalizeAudioFormat(input?.format, defaults.format),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 600_000)
  }
}

function normalizeDagongTextToSpeechProtocol(value: unknown): TextToSpeechProtocol {
  return value === 'minimax-t2a' || value === 'mimo-tts'
    ? value
    : DEFAULT_TEXT_TO_SPEECH_PROTOCOL
}

function normalizeDagongMusicGenerationSettings(
  input: Partial<DagongMusicGenerationSettingsV1> | undefined
): DagongMusicGenerationSettingsV1 {
  const defaults = defaultDagongMusicGenerationSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeDagongMusicGenerationProtocol(input?.protocol),
    baseUrl: typeof input?.baseUrl === 'string' ? input.baseUrl.trim() : defaults.baseUrl,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey,
    model: typeof input?.model === 'string' ? input.model.trim() : defaults.model,
    format: normalizeAudioFormat(input?.format, defaults.format),
    timeoutMs: boundedPositiveInt(input?.timeoutMs, defaults.timeoutMs, 900_000)
  }
}

function normalizeDagongMusicGenerationProtocol(value: unknown): MusicGenerationProtocol {
  return value === 'minimax-music' ? 'minimax-music' : DEFAULT_MUSIC_GENERATION_PROTOCOL
}

function normalizeDagongVideoGenerationSettings(
  input: Partial<DagongVideoGenerationSettingsV1> | undefined
): DagongVideoGenerationSettingsV1 {
  const defaults = defaultDagongVideoGenerationSettings()
  return {
    enabled: input?.enabled === true,
    providerId: typeof input?.providerId === 'string' ? input.providerId.trim() : defaults.providerId,
    protocol: normalizeDagongVideoGenerationProtocol(input?.protocol),
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

function normalizeDagongVideoGenerationProtocol(value: unknown): VideoGenerationProtocol {
  return value === 'minimax-video' ? 'minimax-video' : DEFAULT_VIDEO_GENERATION_PROTOCOL
}

function normalizeDagongComputerUseSettings(
  input: Partial<DagongComputerUseSettingsV1> | undefined
): DagongComputerUseSettingsV1 {
  const defaults = defaultDagongComputerUseSettings()
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

function normalizeDagongTokenEconomySettings(
  input: Partial<DagongTokenEconomySettingsV1> | undefined,
  enabledFallback = false
): DagongTokenEconomySettingsV1 {
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : enabledFallback,
    compressToolDescriptions: input?.compressToolDescriptions !== false,
    compressToolResults: input?.compressToolResults !== false,
    conciseResponses: input?.conciseResponses !== false,
    historyHygiene: normalizeDagongHistoryHygieneSettings(input?.historyHygiene)
  }
}

function normalizeDagongToolOutputLimitsSettings(
  input: Partial<DagongToolOutputLimitsSettingsV1> | undefined
): DagongToolOutputLimitsSettingsV1 {
  const defaults = defaultDagongToolOutputLimitsSettings()
  return {
    maxLines: boundedPositiveInt(input?.maxLines, defaults.maxLines, 1_000_000),
    maxBytes: boundedPositiveInt(input?.maxBytes, defaults.maxBytes, 64 * 1024 * 1024)
  }
}

function normalizeDagongHistoryHygieneSettings(
  input: Partial<DagongHistoryHygieneSettingsV1> | undefined
): DagongHistoryHygieneSettingsV1 {
  const defaults = defaultDagongHistoryHygieneSettings()
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

function normalizeDagongMcpSearchSettings(
  input: Partial<DagongMcpSearchSettingsV1> | undefined
): DagongMcpSearchSettingsV1 {
  const defaults = defaultDagongMcpSearchSettings()
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

function normalizeDagongStorageSettings(
  input: Partial<DagongStorageSettingsV1> | undefined
): DagongStorageSettingsV1 {
  const defaults = defaultDagongStorageSettings()
  return {
    backend: input?.backend === 'file' || input?.backend === 'hybrid'
      ? input.backend
      : defaults.backend,
    sqlitePath: typeof input?.sqlitePath === 'string' ? input.sqlitePath.trim() : defaults.sqlitePath
  }
}

function normalizeDagongContextCompactionSettings(
  input: Partial<DagongContextCompactionSettingsV1> | undefined
): DagongContextCompactionSettingsV1 {
  const defaults = defaultDagongContextCompactionSettings()
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

function normalizeDagongRuntimeTuningSettings(
  input: Partial<DagongRuntimeTuningSettingsV1> | undefined
): DagongRuntimeTuningSettingsV1 {
  const defaults = defaultDagongRuntimeTuningSettings()
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

const KUN_DESIGN_QUALITY_STRICTNESS: readonly DagongDesignQualityStrictness[] = [
  'relaxed',
  'standard',
  'strict'
]

function normalizeDagongQualitySettings(
  input: Partial<DagongDesignQualitySettingsV1> | undefined
): DagongDesignQualitySettingsV1 {
  const defaults = defaultDagongQualitySettings()
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

function normalizeDagongModelProfiles(
  current: Record<string, ModelProviderModelProfileV1> | undefined,
  patch: Record<string, ModelProviderModelProfilePatchV1 | null> | undefined
): Record<string, ModelProviderModelProfileV1> {
  const profiles: Record<string, ModelProviderModelProfileV1> = {}
  for (const [rawModelId, rawProfile] of Object.entries(current ?? {})) {
    const modelId = normalizeModelProfileId(rawModelId)
    if (!modelId) continue
    profiles[modelId] = normalizeDagongModelProfile(rawProfile)
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return profiles
  for (const [rawModelId, rawProfile] of Object.entries(patch)) {
    const modelId = normalizeModelProfileId(rawModelId)
    if (!modelId) continue
    if (rawProfile === null) {
      delete profiles[modelId]
      continue
    }
    profiles[modelId] = normalizeDagongModelProfile({
      ...(profiles[modelId] ?? {}),
      ...rawProfile
    })
  }
  return profiles
}

function normalizeDagongModelProfile(
  input: ModelProviderModelProfilePatchV1 | undefined
): ModelProviderModelProfileV1 {
  const inputModalities = normalizeDagongModelInputModalities(input?.inputModalities)
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
  const reasoning = normalizeDagongReasoningCapability(input?.reasoning)
  const endpointFormat = typeof input?.endpointFormat === 'string' && input.endpointFormat.trim()
    ? normalizeModelEndpointFormat(input.endpointFormat)
    : undefined
  return {
    ...(normalizeDagongProfileAliases(input?.aliases).length
      ? { aliases: normalizeDagongProfileAliases(input?.aliases) }
      : {}),
    ...(contextWindowTokens ? { contextWindowTokens } : {}),
    ...(maxOutputTokens ? { maxOutputTokens } : {}),
    inputModalities,
    outputModalities: normalizeDagongModelInputModalities(input?.outputModalities),
    supportsToolCalling: input?.supportsToolCalling !== false,
    messageParts: normalizeDagongModelMessageParts(input?.messageParts, fallbackMessageParts),
    ...(reasoning ? { reasoning } : {}),
    ...(endpointFormat ? { endpointFormat } : {})
  }
}

function normalizeDagongReasoningCapability(
  input: ModelProviderModelProfilePatchV1['reasoning'] | undefined
): ModelProviderReasoningCapabilityV1 | undefined {
  if (!input || typeof input !== 'object') return undefined
  const supportedEfforts = normalizeDagongReasoningEfforts(input.supportedEfforts)
  if (supportedEfforts.length === 0) return undefined
  const defaultEffort = normalizeDagongReasoningEffort(input.defaultEffort)
  const requestProtocol = normalizeDagongReasoningRequestProtocol(input.requestProtocol)
  if (!requestProtocol) return undefined
  return {
    supportedEfforts,
    defaultEffort: defaultEffort && supportedEfforts.includes(defaultEffort)
      ? defaultEffort
      : supportedEfforts[0],
    requestProtocol
  }
}

function normalizeDagongReasoningEfforts(value: unknown): ModelProviderReasoningCapabilityV1['supportedEfforts'] {
  if (!Array.isArray(value)) return []
  const efforts: ModelProviderReasoningCapabilityV1['supportedEfforts'] = []
  for (const item of value) {
    const effort = normalizeDagongReasoningEffort(item)
    if (effort && !efforts.includes(effort)) efforts.push(effort)
  }
  return efforts
}

function normalizeDagongReasoningEffort(value: unknown): ModelProviderReasoningCapabilityV1['defaultEffort'] | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return MODEL_REASONING_EFFORTS.includes(normalized as ModelProviderReasoningCapabilityV1['defaultEffort'])
    ? normalized as ModelProviderReasoningCapabilityV1['defaultEffort']
    : undefined
}

function normalizeDagongReasoningRequestProtocol(
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

function normalizeDagongProfileAliases(value: unknown): string[] {
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

function normalizeDagongModelInputModalities(value: unknown): ModelProviderInputModality[] {
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

function normalizeDagongModelMessageParts(
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

export function withDagongRuntimeSettings(
  settings: AppSettingsV1,
  dagong: DagongRuntimeSettingsV1
): AppSettingsV1 {
  return {
    ...settings,
    agents: dagongSettingsEnvelope(dagong)
  }
}

export function applyDagongRuntimePatch(
  settings: AppSettingsV1,
  patch: DagongRuntimeSettingsPatchV1 | undefined
): AppSettingsV1 {
  return withDagongRuntimeSettings(
    settings,
    mergeDagongRuntimeSettings(getDagongRuntimeSettings(settings), patch)
  )
}

export function isDagongRuntimeInsecure(runtime: Pick<DagongRuntimeSettingsV1, 'insecure' | 'runtimeToken'>): boolean {
  return runtime.insecure === true
}

export function getActiveAgentApiKey(settings: AppSettingsV1): string {
  return resolveDagongRuntimeSettings(settings).apiKey?.trim() ?? ''
}

export function mergeAgentRuntimeSettings(
  defaults: DagongSettingsEnvelopeV1,
  patch: DagongSettingsEnvelopePatchV1 | undefined
): DagongSettingsEnvelopeV1 {
  return dagongSettingsEnvelope(
    mergeDagongRuntimeSettings(defaults.dagong, patch?.dagong)
  )
}

type LegacyAgentsSettingsShape = {
  dagong?: Partial<DagongRuntimeSettingsV1>
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

function upgradeLegacyDagongDefaultDataDir(value: unknown): string {
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

function upgradeLegacyDagongDefaultModel(value: unknown, fallback: string): string {
  const model = nonEmptyStringOrFallback(value, fallback).trim()
  return model === LEGACY_KUN_DEFAULT_MODEL ? DEFAULT_KUN_MODEL : model
}

function upgradeLegacyDagongDefaultPort(value: unknown, fallback: number): number {
  return value === LEGACY_LOCAL_HTTP_DEFAULT_PORT ? DEFAULT_KUN_PORT : fallback
}

function normalizeDagongLocalPort(value: unknown, fallback: number): number {
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
  const dagongDefaults = defaultDagongRuntimeSettings()
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
  const explicitDagong: Partial<DagongRuntimeSettingsV1> = parsed.agents?.dagong ?? {}
  const legacySource = isReasoningLegacy ? legacyReasoning : legacyLocalHttp
  const legacySeed = {
    binaryPath: dagongDefaults.binaryPath,
    port: isReasoningLegacy
      ? dagongDefaults.port
      : upgradeLegacyDagongDefaultPort(legacyLocalHttp.port, legacyLocalHttp.port),
    autoStart: isReasoningLegacy ? legacyReasoning.autoStart : legacyLocalHttp.autoStart,
    apiKey: legacySource.apiKey,
    baseUrl: legacySource.baseUrl,
    providerId: '',
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    runtimeToken: isReasoningLegacy ? dagongDefaults.runtimeToken : legacyLocalHttp.runtimeToken,
    model: isReasoningLegacy ? legacyReasoning.model : dagongDefaults.model,
    approvalPolicy: isReasoningLegacy ? dagongDefaults.approvalPolicy : legacyLocalHttp.approvalPolicy,
    sandboxMode: isReasoningLegacy ? dagongDefaults.sandboxMode : legacyLocalHttp.sandboxMode
  }
  const provider = normalizeModelProviderSettings({
    apiKey: hasProviderSettings
      ? parsed.provider?.apiKey
      : nonEmptyStringOrFallback(explicitDagong.apiKey, legacySeed.apiKey),
    baseUrl: hasProviderSettings
      ? parsed.provider?.baseUrl
      : nonEmptyStringOrFallback(explicitDagong.baseUrl, legacySeed.baseUrl),
    proxy: parsed.provider?.proxy,
    providers: parsed.provider?.providers
  })
  const dagong = {
    ...dagongDefaults,
    ...legacySeed,
    ...explicitDagong,
    port: normalizeDagongLocalPort(explicitDagong.port ?? legacySeed.port, dagongDefaults.port),
    apiKey: hasProviderSettings ? explicitDagong.apiKey ?? '' : '',
    baseUrl: hasProviderSettings ? explicitDagong.baseUrl ?? '' : '',
    runtimeToken: nonEmptyStringOrFallback(explicitDagong.runtimeToken, legacySeed.runtimeToken),
    dataDir: upgradeLegacyDagongDefaultDataDir(explicitDagong.dataDir),
    model: upgradeLegacyDagongDefaultModel(explicitDagong.model, legacySeed.model),
    tokenEconomyMode: typeof explicitDagong.tokenEconomy?.enabled === 'boolean'
      ? explicitDagong.tokenEconomy.enabled
      : explicitDagong.tokenEconomyMode ?? dagongDefaults.tokenEconomyMode,
    tokenEconomy: normalizeDagongTokenEconomySettings(
      explicitDagong.tokenEconomy,
      explicitDagong.tokenEconomyMode ?? dagongDefaults.tokenEconomyMode
    ),
    toolOutputLimits: normalizeDagongToolOutputLimitsSettings(explicitDagong.toolOutputLimits),
    mcpSearch: normalizeDagongMcpSearchSettings(explicitDagong.mcpSearch),
    storage: normalizeDagongStorageSettings(explicitDagong.storage),
    contextCompaction: normalizeDagongContextCompactionSettings(explicitDagong.contextCompaction),
    runtimeTuning: normalizeDagongRuntimeTuningSettings(explicitDagong.runtimeTuning),
    imageGeneration: normalizeDagongImageGenerationSettings(explicitDagong.imageGeneration),
    speechToText: normalizeDagongSpeechToTextSettings(explicitDagong.speechToText),
    textToSpeech: normalizeDagongTextToSpeechSettings(explicitDagong.textToSpeech),
    musicGeneration: normalizeDagongMusicGenerationSettings(explicitDagong.musicGeneration),
    videoGeneration: normalizeDagongVideoGenerationSettings(explicitDagong.videoGeneration),
    quality: normalizeDagongQualitySettings(explicitDagong.quality)
  }
  // Strip the legacy `agentProvider` discriminator and the legacy
  // per-provider settings from the surfaced migration result. The
  // runtime now has a single agent (Dagong) and we no longer
  // round-trip the legacy value into the new settings shape.
  const { deepseek: _legacyDeepseek, agents: _agents, agentProvider: _agentProvider, ...rest } = parsed
  void _legacyDeepseek
  void _agents
  void _agentProvider
  return {
    ...rest,
    provider,
    agents: {
      dagong
    }
  }
}
