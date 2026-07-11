import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DEFAULT_MODEL_PROVIDER_ID,
  defaultMagicPocketRuntimeSettings,
  defaultModelProviderSettings,
  getModelProviderPreset,
  modelProviderPresetProfile,
  type ModelProviderProfileV1
} from '@shared/app-settings'
import { AgentsSettingsSection, modelProvidersSettingsPatch } from './settings-section-agents'
import { ProvidersSettingsSection } from './settings-section-providers'

const labels: Record<string, string> = {
  agentsQuickBase: 'Base',
  agentsQuickSkill: 'Skills',
  agentsQuickMcp: 'MCP',
  agentsQuickPermissions: 'Permissions',
  agents: 'Agents',
  providers: 'Providers',
  providersDesc: 'Providers description',
  magicpocketProvider: 'Provider',
  magicpocketProviderDesc: 'Provider description',
  magicpocketProviderSelectDesc: 'Provider select description',
  modelProviderAdd: 'Add provider',
  modelProviderAddMenuCustom: 'Custom provider…',
  modelProviderSectionBasics: 'Provider basics',
  modelProviderSectionConnection: 'Provider connection',
  modelProviderSectionDanger: 'Danger zone',
  modelProviderTestConnection: 'Test connection',
  modelProviderFetchModels: 'Fetch from API',
  modelProviderModelsPlaceholder: 'Type a model ID and press Enter',
  modelProviderModelCount: 'models count',
  modelProviderInUse: 'In use',
  modelProviderMissingKey: 'No API key',
  modelProviderDefaultBadge: 'Default',
  modelProviderPresetBadge: 'Preset',
  modelProviderCustomBadge: 'Custom',
  modelProviderDangerHint: 'Danger hint',
  modelProviderIdLocked: 'Provider ID locked',
  modelProviderRemove: 'Remove provider',
  modelProviderName: 'Provider name',
  modelProviderId: 'Provider ID',
  modelProviderApiKey: 'Provider API key',
  modelProviderApiKeyPlaceholder: 'Enter provider API key',
  modelProviderBaseUrl: 'Provider base URL',
  modelProviderEndpointFormat: 'Endpoint format',
  modelProviderFetchEmpty: 'No models found',
  modelEndpointChatCompletions: '/v1/chat/completions (openai)',
  modelEndpointResponses: '/v1/responses (openai)',
  modelEndpointMessages: '/v1/messages (anthropic)',
  modelEndpointCustomEndpoint: 'Custom full endpoint',
  modelProviderModels: 'Provider models',
  modelProviderImageCapability: 'Image capability',
  modelProviderImageCapabilityDesc: 'Image capability description',
  modelProviderImageEnable: 'Enable image',
  modelProviderImageDisable: 'Disable image',
  imageGenProtocol: 'Image protocol',
  imageGenProtocolOpenAi: 'OpenAI Images',
  imageGenProtocolMiniMax: 'MiniMax image_generation',
  imageGenBaseUrl: 'Image base URL',
  imageGenModel: 'Image model',
  imageGenBaseUrlPlaceholder: 'https://api.example.com/v1',
  baseUrlPlaceholder: 'https://api.example.com/v1',
  magicpocketApiKey: 'MagicPocket API key',
  magicpocketApiKeyDesc: 'MagicPocket API key description',
  magicpocketApiKeyPlaceholder: 'Inherit API key',
  magicpocketApiKeyInherited: 'Inherited API key',
  magicpocketApiKeyMissing: 'Missing API key',
  magicpocketApiKeyOverride: 'Override API key',
  magicpocketBaseUrl: 'MagicPocket base URL',
  magicpocketBaseUrlDesc: 'MagicPocket base URL description',
  magicpocketBaseUrlPlaceholder: 'Inherit base URL',
  magicpocketBaseUrlOfficial: 'Official base URL',
  magicpocketBaseUrlInherited: 'Inherited base URL',
  magicpocketBaseUrlOverride: 'Override base URL',
  magicpocketAssistantAdvanced: 'Assistant advanced settings',
  magicpocketAssistantAdvancedDesc: 'Assistant advanced settings description',
  autoStart: 'Auto start',
  autoStartDesc: 'Auto start description',
  port: 'Port',
  portDesc: 'Port description',
  magicpocketBinary: 'MagicPocket binary',
  magicpocketBinaryDesc: 'MagicPocket binary description',
  magicpocketBinaryPlaceholder: 'Bundled MagicPocket',
  magicpocketDataDir: 'Data dir',
  magicpocketDataDirDesc: 'Data dir description',
  magicpocketModel: 'Model',
  magicpocketModelDesc: 'Model description',
  magicpocketTokenEconomy: 'Token-saving mode',
  magicpocketTokenEconomyDesc: 'Token-saving mode description',
  magicpocketTokenEconomySavings: 'Saved {{tokens}} tokens',
  magicpocketTokenEconomySavingsLoading: 'Loading savings',
  magicpocketTokenEconomySavingsEmpty: 'Savings empty',
  magicpocketTokenEconomyAdvanced: 'Token-saving advanced settings',
  magicpocketTokenEconomyAdvancedDesc: 'Token-saving advanced settings description',
  magicpocketTokenEconomyOptions: 'Token-saving options',
  magicpocketTokenEconomyOptionsDesc: 'Token-saving options description',
  magicpocketCompressToolDescriptions: 'Compress tool descriptions',
  magicpocketCompressToolResults: 'Compress tool results',
  magicpocketConciseResponses: 'Concise responses',
  magicpocketHistoryHygiene: 'History guard',
  magicpocketHistoryHygieneDesc: 'History guard description',
  magicpocketHistoryMaxResultLines: 'Max result lines',
  magicpocketHistoryMaxResultBytes: 'Max result bytes',
  magicpocketHistoryMaxResultTokens: 'Max result tokens',
  magicpocketHistoryMaxArgumentBytes: 'Max argument bytes',
  magicpocketHistoryMaxArgumentTokens: 'Max argument tokens',
  magicpocketHistoryMaxArrayItems: 'Max array items',
  runtimeToken: 'Runtime token',
  runtimeTokenDesc: 'Runtime token description',
  showSecret: 'Show',
  hideSecret: 'Hide',
  magicpocketInsecure: 'Insecure',
  magicpocketInsecureDesc: 'Insecure description',
  magicpocketInsecureForcedDesc: 'Insecure forced',
  magicpocketAdvanced: 'Advanced runtime settings',
  magicpocketAdvancedDetails: 'Storage, model context, and tool guards',
  magicpocketAdvancedDetailsDesc: 'Per-model context policy comes from models.profiles',
  magicpocketStorageBackend: 'Storage backend',
  magicpocketStorageBackendDesc: 'Storage backend description',
  magicpocketStorageHybrid: 'Hybrid storage',
  magicpocketStorageFile: 'Pure JSONL file storage',
  magicpocketStorageSqlitePath: 'SQLite path',
  magicpocketStorageSqlitePathDesc: 'SQLite path description',
  magicpocketStorageSqlitePathPlaceholder: 'Automatic SQLite path',
  magicpocketModelContextProfile: 'Current model context policy',
  magicpocketModelContextProfileDesc: 'Current model context policy description',
  magicpocketModelContextModel: 'Matched model',
  magicpocketModelContextWindow: 'Context window',
  magicpocketModelContextSoft: 'Model soft threshold',
  magicpocketModelContextHard: 'Model hard threshold',
  magicpocketModelContextSourceBuiltIn: 'Built-in model config',
  magicpocketModelContextSourceFallback: 'Fallback model config',
  magicpocketCompactionThresholds: 'Fallback compaction thresholds',
  magicpocketCompactionThresholdsDesc: 'Fallback compaction thresholds description',
  magicpocketCompactionSoftThreshold: 'Fallback soft threshold',
  magicpocketCompactionHardThreshold: 'Fallback hard threshold',
  magicpocketCompactionSummary: 'Compaction summary',
  magicpocketCompactionSummaryDesc: 'Compaction summary description',
  magicpocketCompactionSummaryMode: 'Summary mode',
  magicpocketCompactionSummaryHeuristic: 'Heuristic summary',
  magicpocketCompactionSummaryModel: 'Model summary',
  magicpocketCompactionSummaryTimeout: 'Summary timeout',
  magicpocketCompactionSummaryMaxTokens: 'Summary max tokens',
  magicpocketCompactionSummaryInputBytes: 'Summary input bytes',
  magicpocketToolStorm: 'Tool storm',
  magicpocketToolStormDesc: 'Tool storm description',
  magicpocketToolStormLimits: 'Tool storm limits',
  magicpocketToolStormLimitsDesc: 'Tool storm limits description',
  magicpocketToolStormWindowSize: 'Tool storm window',
  magicpocketToolStormThreshold: 'Tool storm threshold',
  magicpocketToolOutputLimits: 'Tool output limits',
  magicpocketToolOutputLimitsDesc: 'Tool output limits description',
  magicpocketToolOutputMaxLines: 'Tool output max lines',
  magicpocketToolOutputMaxBytes: 'Tool output max bytes',
  magicpocketToolArgumentRepair: 'Tool argument repair',
  magicpocketToolArgumentRepairDesc: 'Tool argument repair description',
  magicpocketInstructions: 'AGENTS.md instructions',
  magicpocketInstructionsDesc: 'AGENTS.md instructions description',
  magicpocketInstructionsDiagnostics: '1 source injected last turn',
  magicpocketDiagnostics: 'MagicPocket diagnostics',
  magicpocketDiagnosticsAdvanced: 'Detailed diagnostics',
  magicpocketDiagnosticsAdvancedDesc: 'Detailed diagnostics description',
  magicpocketRuntimeCapabilities: 'Runtime capabilities',
  magicpocketRuntimeCapabilitiesDesc: 'Runtime capabilities description',
  magicpocketRuntimeModel: 'Runtime model',
  magicpocketRuntimePid: 'Runtime PID',
  magicpocketDiagnosticsRefresh: 'Refresh diagnostics',
  magicpocketToolDiagnostics: 'Tool diagnostics',
  magicpocketToolDiagnosticsDesc: 'Tool diagnostics description',
  magicpocketDiagnosticsProviders: 'Providers',
  magicpocketDiagnosticsMcpServers: 'MCP servers',
  magicpocketDiagnosticsSkills: 'Discovered Skills',
  magicpocketDiagnosticsAttachments: 'Attachments',
  magicpocketMemoryRecords: 'Memory records',
  magicpocketMemoryRecordsDesc: 'Memory records description',
  magicpocketMemoryEmpty: 'No memories',
  magicpocketMemoryDisable: 'Disable memory',
  magicpocketMemoryDelete: 'Delete memory',
  magicpocketMemoryDisabled: 'Disabled',
  skill: 'Skill',
  skillsLocation: 'Skill location',
  skillsLocationDesc: 'Skill location description',
  skillsPath: 'Skills path',
  skillsPathDesc: 'Skills path description',
  skillsRootUnavailable: 'Unavailable',
  skillsPermissionSources: 'Skill permission sources',
  skillsPermissionSourcesDesc: 'Skill permission sources description',
  skillsPermissionEnabledRoots: 'Enabled roots',
  skillsPermissionDisabledRoots: 'Disabled roots',
  skillsPermissionWorkspaceRoots: 'Workspace roots',
  skillsPermissionGlobalRoots: 'Global roots',
  skillsPermissionDisabledIds: 'Blocked skills',
  skillsPermissionRuntimeNote: 'Only enabled skill roots reach runtime',
  skillsScanDirs: 'Scan dirs',
  skillsScanDirsDesc: 'Scan dirs description',
  skillsActions: 'Skill actions',
  skillsActionsDesc: 'Skill actions description',
  skillsOpenRoot: 'Open root',
  skillsOpenPlugins: 'Open plugins',
  mcp: 'MCP',
  mcpSearchEnabled: 'MCP search enabled',
  mcpSearchEnabledDesc: 'MCP search description',
  mcpAdvanced: 'MCP advanced settings',
  mcpAdvancedDesc: 'MCP advanced settings description',
  mcpSearchMode: 'MCP search mode',
  mcpSearchModeDesc: 'MCP search mode description',
  mcpSearchModeAuto: 'Auto mode',
  mcpSearchModeSearch: 'Search mode',
  mcpSearchModeDirect: 'Direct mode',
  mcpSearchLimits: 'MCP search limits',
  mcpSearchLimitsDesc: 'MCP search limits description',
  mcpSearchAutoThreshold: 'Auto threshold',
  mcpSearchTopKDefault: 'Default results',
  mcpSearchTopKMax: 'Max results',
  mcpSearchMinScore: 'Minimum score',
  mcpSearchDiagnostics: 'MCP search diagnostics',
  mcpSearchDiagnosticsDesc: 'MCP search diagnostics description',
  mcpSearchStatus: 'MCP search status',
  mcpSearchActive: 'Active',
  mcpSearchInactive: 'Inactive',
  mcpSearchIndexed: 'Indexed',
  mcpSearchAdvertised: 'Advertised',
  mcpPermissionSources: 'External tool permission sources',
  mcpPermissionSourcesDesc: 'External tool permission sources description',
  mcpPermissionEnabledServers: 'Enabled servers',
  mcpPermissionDisabledServers: 'Disabled servers',
  mcpPermissionUserServers: 'All-workspace scope',
  mcpPermissionWorkspaceServers: 'Workspace scope',
  mcpPermissionVisibleServers: 'Workspace-visible only',
  mcpPermissionLocalServers: 'Local commands',
  mcpPermissionRemoteServers: 'HTTP/SSE servers',
  mcpPermissionEnvServers: 'Uses env',
  mcpPermissionHeaderServers: 'Uses headers',
  mcpPermissionParseError: 'Permission preview unavailable: {{error}}',
  mcpPermissionRuntimeNote: 'Secret values stay hidden here',
  configFilePath: 'External tool config path',
  mcpPathDesc: 'MCP JSON path description',
  mcpEditor: 'MCP editor',
  mcpEditorDesc: 'Model and API credentials do not live in this MCP file',
  mcpFileStatusReady: 'MCP config ready',
  mcpFileStatusMissing: 'MCP config missing',
  loading: 'Loading',
  mcpActions: 'MCP actions',
  mcpRuntimeHint: 'MCP runtime hint',
  mcpSave: 'Save MCP config',
  mcpReload: 'Reload MCP config',
  mcpOpenDir: 'Open MCP directory',
  permissions: 'Permissions',
  toolPermissionMode: 'Tool permission mode',
  toolPermissionModeDesc: 'Tool permission mode description',
  toolPermissionAlwaysAsk: 'Always ask',
  toolPermissionAlwaysAskDesc: 'Every tool call asks first',
  toolPermissionReadOnly: 'Read only',
  toolPermissionReadOnlyDesc: 'Read tools run automatically',
  toolPermissionSensitiveAsk: 'Sensitive operations ask',
  toolPermissionSensitiveAskDesc: 'Sensitive operations ask first',
  toolPermissionWorkspaceWrite: 'Workspace write',
  toolPermissionWorkspaceWriteDesc: 'Can modify the workspace',
  toolPermissionBypass: 'Bypass mode',
  toolPermissionBypassDesc: 'Never asks and has full access',
  permissionsBehaviorHint: 'Tool confirmation and local permissions are unified'
}

function t(key: string): string {
  return labels[key] ?? key
}

function baseCtx(): Record<string, unknown> {
  const noop = () => undefined
  const asyncNoop = async () => undefined
  const ref = { current: null }
  const magicpocket = {
    ...defaultMagicPocketRuntimeSettings(),
    autoStart: true,
    runtimeToken: '',
    insecure: true
  }
  return {
    t,
    tCommon: t,
    form: { claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } } },
    magicpocket,
    activeApiKey: '',
    update: noop,
    updateMagicPocket: noop,
    updateSharedCredential: noop,
    sharedApiKey: '',
    sharedBaseUrl: '',
    showApiKey: false,
    setShowApiKey: noop,
    showRuntimeToken: false,
    setShowRuntimeToken: noop,
    portError: '',
    selectControlClass: 'select',
    openOnboardingPreview: noop,
    pickWorkspace: asyncNoop,
    resetWorkspaceToDefault: noop,
    workspacePickerError: '',
    guiUpdateInfo: null,
    checkingGuiUpdate: false,
    downloadingGuiUpdate: false,
    installingGuiUpdate: false,
    guiUpdateDownloaded: false,
    guiUpdateProgress: null,
    guiUpdateError: null,
    checkGuiUpdate: asyncNoop,
    downloadGuiUpdate: asyncNoop,
    installGuiUpdate: asyncNoop,
    logPath: '',
    logDirOpenError: '',
    setLogDirOpenError: noop,
    compactHomePath: (path: string) => path,
    expandHomePath: (path: string) => path,
    compactHomePathList: (values: readonly string[]) => values.join('\n'),
    expandHomePathList: (value: string) => value.split('\n').filter(Boolean),
    pickWriteWorkspace: asyncNoop,
    resetWriteWorkspaceToDefault: noop,
    writeWorkspacePickerError: '',
    writeInlineBaseUrlInherited: false,
    effectiveWriteInlineBaseUrl: '',
    writeInlineModelInherited: false,
    effectiveWriteInlineModel: '',
    setWriteDebugModalOpen: noop,
    loadWriteDebugEntries: asyncNoop,
    scrollToAgentSection: noop,
    agentsSectionRef: ref,
    skillSectionRef: ref,
    mcpSectionRef: ref,
    permissionsSectionRef: ref,
    skillRoots: [],
    skillRootsLoading: false,
    toggleSkillRoot: noop,
    skillNotice: null,
    openSkillRoot: asyncNoop,
    openPlugins: noop,
    mcpConfigPath: '/tmp/project/.magicpocket/mcp.json',
    mcpConfigExists: true,
    mcpConfigText: '{"mcpServers":{}}',
    setMcpConfigText: noop,
    mcpLoading: false,
    mcpBusy: false,
    mcpNotice: null,
    saveMcpConfig: asyncNoop,
    loadMcpConfig: asyncNoop,
    openMcpConfigDir: asyncNoop,
    runtimeInfo: null,
    toolDiagnostics: null,
    memoryRecords: [],
    runtimeDiagnosticsBusy: false,
    runtimeDiagnosticsNotice: null,
    refreshMagicPocketDiagnostics: asyncNoop,
    disableMemoryRecord: asyncNoop,
    deleteMemoryRecord: asyncNoop,
    pickClawWorkspace: asyncNoop,
    resetClawWorkspaceToDefault: noop,
    clawWorkspacePickerError: '',
    splitSettingsList: (value: string) => value.split('\n').filter(Boolean),
    listSettingsText: (value: string[]) => value.join('\n')
  }
}

describe('AgentsSettingsSection MagicPocket diagnostics smoke', () => {
  it('builds a single patch when adding and selecting a model provider', () => {
    const provider = defaultModelProviderSettings()
    const customProvider = {
      id: 'custom-provider-2',
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'responses',
      models: [],
      modelProfiles: {}
    } satisfies ModelProviderProfileV1

    const patch = modelProvidersSettingsPatch({
      provider,
      providers: [...provider.providers, customProvider],
      magicpocket: { providerId: customProvider.id }
    })

    expect(patch.provider?.providers).toEqual([...provider.providers, customProvider])
    expect(patch.agents?.magicpocket?.providerId).toBe(customProvider.id)
    expect(patch.agents?.magicpocket?.apiKey).toBe('')
    expect(patch.agents?.magicpocket?.baseUrl).toBe('')
  })

  it('builds a single patch when removing the active model provider', () => {
    const provider = defaultModelProviderSettings()

    const patch = modelProvidersSettingsPatch({
      provider: {
        ...provider,
        providers: [
          ...provider.providers,
          {
            id: 'custom-provider-2',
            name: 'Custom Provider',
            apiKey: '',
            baseUrl: 'https://api.example.com/v1',
            endpointFormat: 'responses',
            models: [],
            modelProfiles: {}
          }
        ]
      },
      providers: provider.providers,
      magicpocket: { providerId: DEFAULT_MODEL_PROVIDER_ID }
    })

    expect(patch.provider?.providers).toEqual(provider.providers)
    expect(patch.agents?.magicpocket?.providerId).toBe(DEFAULT_MODEL_PROVIDER_ID)
    expect(patch.agents?.magicpocket?.apiKey).toBe('')
    expect(patch.agents?.magicpocket?.baseUrl).toBe('')
  })

  it('builds a single patch when adding a preset model provider', () => {
    const provider = defaultModelProviderSettings()
    const xiaomi = getModelProviderPreset('xiaomi')
    expect(xiaomi).not.toBeNull()
    const xiaomiProvider = modelProviderPresetProfile(xiaomi!)

    const patch = modelProvidersSettingsPatch({
      provider,
      providers: [...provider.providers, xiaomiProvider],
      magicpocket: {
        providerId: xiaomiProvider.id,
        model: xiaomiProvider.models[0]
      }
    })

    expect(patch.provider?.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'xiaomi',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        endpointFormat: 'chat_completions',
        models: expect.arrayContaining(['mimo-v2.5'])
      })
    ]))
    expect(patch.agents?.magicpocket).toEqual(expect.objectContaining({
      providerId: 'xiaomi',
      model: xiaomiProvider.models[0]
    }))
  })

  it('defaults MiniMax media generation when adding a configured MiniMax provider', () => {
    const provider = defaultModelProviderSettings()
    const minimax = getModelProviderPreset('minimax')
    expect(minimax).not.toBeNull()
    const minimaxProvider = modelProviderPresetProfile(minimax!, 'sk-minimax')

    const patch = modelProvidersSettingsPatch({
      provider,
      providers: [...provider.providers, minimaxProvider],
      currentMagicPocket: defaultMagicPocketRuntimeSettings(),
      magicpocket: {
        providerId: minimaxProvider.id,
        model: minimaxProvider.models[0]
      }
    })

    expect(patch.agents?.magicpocket).toEqual(expect.objectContaining({
      providerId: 'minimax',
      model: minimaxProvider.models[0],
      textToSpeech: expect.objectContaining({
        enabled: true,
        providerId: 'minimax',
        model: 'speech-2.8-hd'
      }),
      musicGeneration: expect.objectContaining({
        enabled: true,
        providerId: 'minimax',
        model: 'music-2.6'
      }),
      videoGeneration: expect.objectContaining({
        enabled: true,
        providerId: 'minimax',
        model: 'MiniMax-Hailuo-2.3'
      })
    }))
  })

  it('renders custom model provider id as editable', () => {
    const provider = defaultModelProviderSettings()
    const customProvider = {
      id: 'custom-provider-2',
      name: 'Custom Provider',
      apiKey: '',
      baseUrl: 'https://api.example.com/v1',
      endpointFormat: 'messages',
      models: [],
      modelProfiles: {}
    } satisfies ModelProviderProfileV1
    const html = renderToStaticMarkup(createElement(ProvidersSettingsSection, {
      ctx: {
        ...baseCtx(),
        provider: {
          ...provider,
          providers: [...provider.providers, customProvider]
        },
        magicpocket: {
          ...defaultMagicPocketRuntimeSettings(),
          providerId: customProvider.id
        }
      }
    }))
    const providerIdInput = html.match(/<input[^>]+value="custom-provider-2"[^>]*>/)?.[0]

    expect(providerIdInput).toBeTruthy()
    expect(providerIdInput).not.toContain('readOnly')
    expect(providerIdInput).not.toContain('readonly')
    expect(html).toContain('Endpoint format')
    expect(html).toContain('<option value="messages" selected="">/v1/messages (anthropic)</option>')
    expect(html).toContain('<option value="custom_endpoint">Custom full endpoint</option>')
    expect(html).toContain('Enter provider API key')
    expect(html).not.toContain('Inherit API key')
    expect(html).toContain('Add provider')
    expect(html).toContain('Test connection')
    expect(html).toContain('Fetch from API')
    expect(html).toContain('Danger zone')
    expect(html).toContain('In use')
    expect(html).toContain('No API key')
  })

  it('locks preset and default provider ids and shows the danger zone only for removable providers', () => {
    const provider = defaultModelProviderSettings()
    const xiaomi = getModelProviderPreset('xiaomi')
    expect(xiaomi).not.toBeNull()
    const html = renderToStaticMarkup(createElement(ProvidersSettingsSection, {
      ctx: {
        ...baseCtx(),
        provider: {
          ...provider,
          providers: [...provider.providers, modelProviderPresetProfile(xiaomi!)]
        },
        magicpocket: {
          ...defaultMagicPocketRuntimeSettings(),
          providerId: 'xiaomi'
        }
      }
    }))
    const providerIdInput = html.match(/<input[^>]+value="xiaomi"[^>]*>/)?.[0]

    expect(providerIdInput).toBeTruthy()
    expect(providerIdInput?.toLowerCase()).toContain('readonly')
    expect(html).toContain('Provider ID locked')
    expect(html).toContain('Danger zone')
  })

  it('hides the danger zone for the default provider', () => {
    const html = renderToStaticMarkup(createElement(ProvidersSettingsSection, {
      ctx: {
        ...baseCtx(),
        provider: defaultModelProviderSettings(),
        magicpocket: defaultMagicPocketRuntimeSettings()
      }
    }))

    expect(html).not.toContain('Danger zone')
    expect(html).toContain('Test connection')
  })

  it('keeps advanced agent controls behind collapsed disclosures', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Assistant advanced settings')
    expect(html).toContain('Storage, model context, and tool guards')
    expect(html).toContain('MCP advanced settings')
    expect(html).not.toContain('<details open')
  })

  it('does not render image generation settings inside the agent section', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).not.toContain('imageGen')
  })

  it('renders unified permission controls with bypass as the default mode', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Permissions')
    expect(html).toContain('Tool confirmation and local permissions are unified')
    expect(html).toContain('Tool permission mode')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('Every tool call asks first')
    expect(html).toContain('Read tools run automatically')
    expect(html).toContain('Sensitive operations ask first')
    expect(html).toContain('Can modify the workspace')
    expect(html).toContain('Never asks and has full access')
    expect(html).toContain('lucide-hand')
    expect(html).toContain('lucide-eye')
    expect(html).toContain('lucide-shield-question')
    expect(html).toContain('lucide-folder-pen')
    expect(html).toContain('lucide-lock-keyhole-open')
    expect(html).not.toContain('Approval policy')
    expect(html).not.toContain('Sandbox mode')
  })

  it('renders pure JSONL as a selectable storage backend', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Storage backend')
    expect(html).toContain('<option value="hybrid"')
    expect(html).toContain('Hybrid storage')
    expect(html).toContain('<option value="file"')
    expect(html).toContain('Pure JSONL file storage')
  })

  it('shows DeepSeek V4 model compaction thresholds from the model profile', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('Current model context policy')
    expect(html).toContain('deepseek-v4-pro')
    expect(html).toContain('Built-in model config')
    expect(html).toContain('1,000,000')
    expect(html).toContain('980,000')
    expect(html).toContain('990,000')
    expect(html).toContain('Fallback compaction thresholds')
  })

  it('renders MCP, Skill, web, attachment, and memory diagnostics', () => {
    const ctx = {
      ...baseCtx(),
      runtimeInfo: {
        pid: 123,
        capabilities: {
          model: { id: 'deepseek-chat' },
          mcp: { status: 'available', configuredServers: 2, connectedServers: 2 },
          web: { status: 'available', provider: 'brave-search' },
          instructions: { status: 'available', lastSourceCount: 1 },
          skills: { status: 'available' },
          subagents: { status: 'available' },
          attachments: { status: 'available' },
          memory: { status: 'available' }
        }
      },
      toolDiagnostics: {
        providers: [{ id: 'builtin' }, { id: 'mcp' }, { id: 'web' }, { id: 'memory' }],
        mcpServers: [{ id: 'github' }],
        instructions: { lastInjection: { sources: [{ scope: 'workspace', path: '/tmp/project/AGENTS.md' }] } },
        skills: { skills: [{ id: 'skill_docs' }] },
        attachments: { count: 1 }
      },
      memoryRecords: [
        {
          id: 'mem_1',
          content: 'Prefer pnpm for this workspace',
          scope: 'workspace',
          tags: ['tooling']
        }
      ]
    }

    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx }))

    expect(html).toContain('MagicPocket diagnostics')
    expect(html).toContain('MCP')
    expect(html).toContain('available')
    expect(html).toContain('2/2')
    expect(html).toContain('brave-search')
    expect(html).toContain('Instructions')
    expect(html).toContain('AGENTS.md instructions')
    expect(html).toContain('Providers')
    expect(html).toContain('MCP servers')
    expect(html).toContain('Discovered Skills')
    expect(html).toContain('Prefer pnpm for this workspace')
    expect(html).toContain('mem_1')
    expect(html).toContain('Disable memory')
    expect(html).toContain('Delete memory')
  })

  it('describes MCP config as an external-tool JSON file instead of model credentials', () => {
    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx: baseCtx() }))

    expect(html).toContain('External tool config path')
    expect(html).toContain('/tmp/project/.magicpocket/mcp.json')
    expect(html).toContain('Model and API credentials do not live in this MCP file')
    expect(html).not.toContain('DeepSeek auth')
    expect(html).not.toContain('Base URL are stored in this file')
    expect(html).not.toContain('config.toml')
  })

  it('renders Skill and MCP permission-source previews without exposing secret values', () => {
    const ctx = {
      ...baseCtx(),
      form: {
        claw: { skills: { extraDirs: ['/tmp/project/.agents/skills'] } },
        disabledSkillIds: ['legacy-skill']
      },
      skillRoots: [
        {
          id: 'workspace-agents',
          disableKey: 'workspace-agents',
          path: '/repo/.agents/skills',
          scope: 'project',
          source: 'common',
          exists: true,
          enabled: true,
          skillCount: 2
        },
        {
          id: 'global-magicpocket',
          disableKey: 'global-magicpocket',
          path: '/home/me/.magicpocket/skills',
          scope: 'global',
          source: 'common',
          exists: true,
          enabled: true,
          skillCount: 1
        },
        {
          id: 'disabled-extra',
          disableKey: 'disabled-extra',
          path: '/tmp/disabled-skills',
          scope: 'global',
          source: 'extra',
          exists: true,
          enabled: false,
          skillCount: 1
        }
      ],
      mcpConfigText: JSON.stringify({
        servers: {
          github: {
            transport: 'stdio',
            command: 'npx',
            env: { GITHUB_TOKEN: '' },
            trustScope: 'workspace',
            trustedWorkspaceRoots: ['/repo']
          },
          docs: {
            transport: 'streamable-http',
            url: 'https://mcp.example.com',
            workspaceRoots: ['/repo/docs'],
            headers: { Authorization: '' },
            trustScope: 'user'
          },
          disabled: {
            transport: 'sse',
            url: 'https://disabled.example.com',
            enabled: false
          }
        }
      })
    }

    const html = renderToStaticMarkup(createElement(AgentsSettingsSection, { ctx }))

    expect(html).toContain('Skill permission sources')
    expect(html).toContain('Enabled roots')
    expect(html).toContain('Disabled roots')
    expect(html).toContain('Workspace roots')
    expect(html).toContain('Global roots')
    expect(html).toContain('Blocked skills')
    expect(html).toContain('External tool permission sources')
    expect(html).toContain('Enabled servers')
    expect(html).toContain('Disabled servers')
    expect(html).toContain('All-workspace scope')
    expect(html).toContain('Workspace scope')
    expect(html).toContain('Workspace-visible only')
    expect(html).toContain('Local commands')
    expect(html).toContain('HTTP/SSE servers')
    expect(html).toContain('Uses env')
    expect(html).toContain('Uses headers')
    expect(html).toContain('Secret values stay hidden here')
  })

  it('defines the LiteLLM provider preset for the Providers menu', () => {
    const litellm = getModelProviderPreset('litellm')
    expect(litellm && modelProviderPresetProfile(litellm)).toMatchObject({
      id: 'litellm',
      name: 'LiteLLM',
      baseUrl: 'http://localhost:4000',
      endpointFormat: 'chat_completions'
    })
  })

  it('defines OpenAI-compatible provider presets for the Providers menu', () => {
    const expected = [
      ['longcat', 'LongCat', 'https://api.longcat.chat/openai'],
      ['zhipu-coding-plan', 'Zhipu Coding Plan', 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions', 'custom_endpoint'],
      ['zai-coding-plan', 'Z.ai Coding Plan', 'https://api.z.ai/api/coding/paas/v4/chat/completions', 'custom_endpoint'],
      ['kimi-code', 'Kimi Code', 'https://api.kimi.com/coding/v1'],
      ['moonshot-cn', 'Moonshot CN', 'https://api.moonshot.cn/v1'],
      ['moonshot-global', 'Moonshot Global', 'https://api.moonshot.ai/v1']
    ] as const

    for (const [id, name, baseUrl, endpointFormat = 'chat_completions'] of expected) {
      const preset = getModelProviderPreset(id)
      expect(preset && modelProviderPresetProfile(preset)).toMatchObject({
        id,
        name,
        baseUrl,
        endpointFormat
      })
    }
  })
})
