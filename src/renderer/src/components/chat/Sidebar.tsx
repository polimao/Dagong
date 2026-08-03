import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clock3,
  Focus,
  LayoutGrid,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  Workflow
} from 'lucide-react'
import type { NormalizedThread } from '../../agent/types'
import { useChatStore, type SettingsRouteSection } from '../../store/chat-store'
import { type SddDraft } from '../../sdd/sdd-draft-store'
import type {
  ClawImChannelV1,
} from '@shared/app-settings'
import {
  ClawSidebarContent
} from './SidebarClaw'
import type { ClawImDialogMode } from './SidebarClawDialogHelpers'
import { ClawAddImDialog } from './SidebarClawDialog'
import { SidebarMascot } from './AnimatedWorkLogo'
import { ConnectPhoneSidebarPanel } from './ConnectPhoneView'
import { SidebarProjectsSection } from './SidebarProjectsSection'
import { SidebarConversationsSection } from './SidebarConversationsSection'
import {
  SidebarCommandRow,
  SidebarFrame,
  SidebarIconButton
} from '../sidebar/SidebarPrimitives'
import { SidebarMoreMenu } from '../sidebar/SidebarMoreMenu'

type Props = {
  threads: NormalizedThread[]
  activeThreadId: string | null
  activeView: 'chat' | 'write' | 'claw' | 'schedule' | 'workflow' | 'subagents'
  connectPhoneSidebarOpen: boolean
  pluginsActive: boolean
  expertsActive: boolean
  runtimeReady: boolean
  threadSearch: string
  showArchivedThreads: boolean
  onThreadSearchChange: (query: string) => void
  onSelectThread: (id: string) => void
  onRenameThread: (id: string, title: string) => Promise<void>
  onPinThread: (id: string, pinned: boolean) => Promise<void>
  onArchiveThread: (id: string) => Promise<void>
  onDeleteThread: (id: string) => Promise<void>
  onRestoreThread: (id: string) => Promise<void>
  onNewChat: () => void
  onNewChatInWorkspace: (workspaceRoot: string) => void
  onOpenRequirementDraft: (draft: SddDraft) => void
  onOpenSettings: (section?: SettingsRouteSection) => void
  onOpenPlugins: () => void
  onOpenExperts: () => void
  onToggleTheme: () => void
  focusModeEnabled: boolean
  onFocusModeChange: (enabled: boolean) => void
  onToggleConnectPhone: () => void
  onScheduleOpen: () => void
  onOpenWrite: () => void
  onOpenDesign: () => void
  onNewConversation: () => void
}

export function Sidebar({
  threads,
  activeThreadId,
  activeView,
  connectPhoneSidebarOpen,
  pluginsActive,
  expertsActive,
  runtimeReady,
  threadSearch,
  showArchivedThreads,
  onThreadSearchChange,
  onSelectThread,
  onRenameThread,
  onPinThread,
  onArchiveThread,
  onDeleteThread,
  onRestoreThread,
  onNewChat,
  onNewChatInWorkspace,
  onOpenRequirementDraft,
  onOpenSettings,
  onOpenPlugins,
  onOpenExperts,
  onToggleTheme,
  focusModeEnabled,
  onFocusModeChange,
  onToggleConnectPhone,
  onScheduleOpen,
  onOpenWrite,
  onOpenDesign,
  onNewConversation
}: Props): ReactElement {
  const { t, i18n } = useTranslation('common')
  const [isDarkMode, setIsDarkMode] = useState(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const workspaceRoot = useChatStore((s) => s.workspaceRoot)
  const conversationWorkspaceRoot = useChatStore((s) => s.conversationWorkspaceRoot)
  const codeWorkspaceRoots = useChatStore((s) => s.codeWorkspaceRoots)
  const chooseWorkspace = useChatStore((s) => s.chooseWorkspace)
  const deleteWorkspace = useChatStore((s) => s.deleteWorkspace)
  const busy = useChatStore((s) => s.busy)
  const watchTurnCompletion = useChatStore((s) => s.watchTurnCompletion)
  const unreadThreadIds = useChatStore((s) => s.unreadThreadIds)
  const clawChannels = useChatStore((s) => s.clawChannels)
  const activeClawChannelId = useChatStore((s) => s.activeClawChannelId)
  const selectClawChannel = useChatStore((s) => s.selectClawChannel)
  const addClawChannel = useChatStore((s) => s.addClawChannel)
  const deleteClawChannel = useChatStore((s) => s.deleteClawChannel)
  const resetClawChannelSession = useChatStore((s) => s.resetClawChannelSession)
  const [imDialogMode, setImDialogMode] = useState<ClawImDialogMode | null>(null)

  const activeClawChannel = useMemo(
    () => clawChannels.find((channel) => channel.id === activeClawChannelId) ?? clawChannels[0] ?? null,
    [clawChannels, activeClawChannelId]
  )

  return (
    <>
    <SidebarFrame
      title={t('appName')}
      footer={
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <SidebarCommandRow
                icon={<Settings className="h-4 w-4" strokeWidth={1.75} />}
                label={t('settings')}
                onClick={() => onOpenSettings('general')}
                variant="footer"
              />
            </div>
            <SidebarIconButton
              title={isDarkMode ? t('switchToLight') : t('switchToDark')}
              ariaLabel={t('toggleTheme')}
              onClick={onToggleTheme}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              )}
            </SidebarIconButton>
            {focusModeEnabled ? (
              <SidebarIconButton
                title={`${t('focusModeToggleTitle')} · ${t('switchOn')}`}
                ariaLabel={t('focusModeToggleLabel')}
                active
                onClick={() => onFocusModeChange(false)}
              >
                <Focus className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </SidebarIconButton>
            ) : (
              <SidebarIconButton
                title={t('focusModeToggleTitle')}
                ariaLabel={t('focusModeToggleLabel')}
                onClick={() => onFocusModeChange(true)}
              >
                <SidebarMascot className="ds-focus-mascot" />
              </SidebarIconButton>
            )}
          </div>
        </div>
      }
    >
      <div className="ds-no-drag flex flex-col px-1">
        {activeView !== 'claw' && activeView !== 'schedule' && activeView !== 'workflow' ? (
          <>
            <SidebarCommandRow
              icon={<Plus className="h-4 w-4" strokeWidth={2} />}
              label={t('newAgent')}
              onClick={runtimeReady ? onNewChat : undefined}
              disabled={!runtimeReady}
              disabledHint={t('runtimeActionNeedsConnection')}
              variant="accent"
            />
          </>
        ) : null}
        <SidebarCommandRow
          icon={<LayoutGrid className="h-4 w-4" strokeWidth={1.75} />}
          label={t('plugins')}
          onClick={onOpenPlugins}
          active={pluginsActive}
        />
        <SidebarCommandRow
          icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
          label={t('experts')}
          onClick={onOpenExperts}
          active={expertsActive}
        />
        <SidebarCommandRow
          icon={<Clock3 className="h-4 w-4" strokeWidth={1.75} />}
          label={t('schedule')}
          onClick={onScheduleOpen}
          active={activeView === 'schedule'}
        />
        <SidebarMoreMenu
          connectPhoneSidebarOpen={connectPhoneSidebarOpen}
          currentView={activeView === 'write' ? 'write' : 'chat'}
          onToggleConnectPhone={onToggleConnectPhone}
          onOpenWrite={onOpenWrite}
          onOpenDesign={onOpenDesign}
        />
      </div>

      <div className="ds-no-drag mx-1 my-1" />

      {connectPhoneSidebarOpen ? (
        <ConnectPhoneSidebarPanel
          channels={clawChannels}
          onAddProvider={async (provider, agentProfile, platformCredential, options) => {
            await addClawChannel(provider, agentProfile, platformCredential, options)
            onToggleConnectPhone()
          }}
          onDisconnect={(channelId) => deleteClawChannel(channelId)}
          onOpenSettings={() => onOpenSettings('claw')}
        />
      ) : activeView === 'claw' ? (
        <ClawSidebarContent
          channels={clawChannels}
          activeChannelId={activeClawChannelId}
          activeThreadId={activeThreadId}
          runtimeReady={runtimeReady}
          onSelectChannel={(channelId) => void selectClawChannel(channelId)}
          onAddChannel={() => setImDialogMode('add')}
          onResetChannel={(channelId) => void resetClawChannelSession(channelId)}
          onOpenSettings={() => setImDialogMode('edit')}
          t={t}
        />
      ) : activeView === 'workflow' ? (
        <div className="ds-no-drag flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Workflow className="h-7 w-7 text-ds-faint" strokeWidth={1.5} />
          <p className="text-[12.5px] leading-5 text-ds-faint">{t('workflowSidebarHint')}</p>
        </div>
      ) : activeView === 'schedule' ? (
        <SidebarProjectsSection
          threads={threads}
          activeView="chat"
          activeThreadId={activeThreadId}
          runtimeReady={runtimeReady}
          searchQuery={threadSearch}
          showArchived={showArchivedThreads}
          workspaceRoot={workspaceRoot}
          workspaceRoots={codeWorkspaceRoots}
          conversationRoot={conversationWorkspaceRoot}
          busy={busy}
          watchTurnCompletion={watchTurnCompletion}
          unreadThreadIds={unreadThreadIds}
          locale={i18n.language}
          onPickWorkspace={() => void chooseWorkspace()}
          onRemoveWorkspace={deleteWorkspace}
          onCreateThreadInWorkspace={onNewChatInWorkspace}
          onOpenRequirementDraft={onOpenRequirementDraft}
          onSelectThread={onSelectThread}
          onRenameThread={onRenameThread}
          onPinThread={onPinThread}
          onArchiveThread={onArchiveThread}
          onDeleteThread={onDeleteThread}
          onRestoreThread={onRestoreThread}
          onSearchQueryChange={onThreadSearchChange}
          t={t}
        />
      ) : (
      <>
      <SidebarConversationsSection
        threads={threads}
        activeThreadId={activeThreadId}
        runtimeReady={runtimeReady}
        conversationRoot={conversationWorkspaceRoot}
        onNewConversation={onNewConversation}
        onSelectThread={onSelectThread}
        onRenameThread={onRenameThread}
        onPinThread={onPinThread}
        onArchiveThread={onArchiveThread}
        onDeleteThread={onDeleteThread}
        onRestoreThread={onRestoreThread}
        t={t}
      />
      <SidebarProjectsSection
        threads={threads}
        activeView={activeView === 'write' ? 'write' : 'chat'}
        activeThreadId={activeThreadId}
        runtimeReady={runtimeReady}
        searchQuery={threadSearch}
        showArchived={showArchivedThreads}
        workspaceRoot={workspaceRoot}
        workspaceRoots={codeWorkspaceRoots}
        conversationRoot={conversationWorkspaceRoot}
        busy={busy}
        watchTurnCompletion={watchTurnCompletion}
        unreadThreadIds={unreadThreadIds}
        locale={i18n.language}
        onPickWorkspace={() => void chooseWorkspace()}
        onRemoveWorkspace={deleteWorkspace}
        onCreateThreadInWorkspace={onNewChatInWorkspace}
        onOpenRequirementDraft={onOpenRequirementDraft}
        onSelectThread={onSelectThread}
        onRenameThread={onRenameThread}
        onPinThread={onPinThread}
        onArchiveThread={onArchiveThread}
        onDeleteThread={onDeleteThread}
        onRestoreThread={onRestoreThread}
        onSearchQueryChange={onThreadSearchChange}
        t={t}
      />
      </>
      )}

    </SidebarFrame>

    {imDialogMode ? (
      <ClawAddImDialog
        mode={imDialogMode}
        initialProvider={activeClawChannel?.provider}
        initialChannelId={imDialogMode === 'edit' ? activeClawChannel?.id : undefined}
        channels={clawChannels}
        onClose={() => setImDialogMode(null)}
        onAddProvider={(provider, agentProfile, platformCredential, options) =>
          addClawChannel(provider, agentProfile, platformCredential, options)
        }
        onDeleteChannel={(channelId) => deleteClawChannel(channelId)}
        t={t}
      />
    ) : null}
    </>
  )
}

