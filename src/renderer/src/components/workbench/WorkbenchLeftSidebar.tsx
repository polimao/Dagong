import { Suspense, type ComponentProps, type ReactElement } from 'react'
import type { SettingsRouteSection } from '../../store/chat-store'
import { DesignSidebar } from '../design/DesignSidebar'
import { Sidebar } from '../chat/Sidebar'
import { WriteSidebar } from '../write/WriteSidebar'

type CodeSidebarProps = ComponentProps<typeof Sidebar>

export type WorkbenchLeftSidebarProps = {
  collapsed: boolean
  width: number
  route: string
  codeThreads: CodeSidebarProps['threads']
  activeThreadId: CodeSidebarProps['activeThreadId']
  sidebarView: CodeSidebarProps['activeView']
  connectPhoneSidebarOpen: boolean
  runtimeReady: boolean
  threadSearch: string
  showArchivedThreads: boolean
  focusModeEnabled: boolean
  onFocusModeChange: CodeSidebarProps['onFocusModeChange']
  onThreadSearchChange: CodeSidebarProps['onThreadSearchChange']
  onSelectThread: CodeSidebarProps['onSelectThread']
  onRenameThread: CodeSidebarProps['onRenameThread']
  onPinThread: CodeSidebarProps['onPinThread']
  onArchiveThread: CodeSidebarProps['onArchiveThread']
  onDeleteThread: CodeSidebarProps['onDeleteThread']
  onRestoreThread: CodeSidebarProps['onRestoreThread']
  onNewChat: CodeSidebarProps['onNewChat']
  onNewChatInWorkspace: CodeSidebarProps['onNewChatInWorkspace']
  onOpenRequirementDraft: CodeSidebarProps['onOpenRequirementDraft']
  onOpenSettings: (section?: SettingsRouteSection) => void
  onOpenPlugins: CodeSidebarProps['onOpenPlugins']
  onOpenExperts: CodeSidebarProps['onOpenExperts']
  onToggleTheme: CodeSidebarProps['onToggleTheme']
  onToggleConnectPhone: CodeSidebarProps['onToggleConnectPhone']
  onScheduleOpen: CodeSidebarProps['onScheduleOpen']
  onOpenWrite: CodeSidebarProps['onOpenWrite']
  onOpenDesign: CodeSidebarProps['onOpenDesign']
  onNewConversation: CodeSidebarProps['onNewConversation']
}

function SidebarFallback(): ReactElement {
  return <div className="h-full bg-ds-sidebar" />
}

export function WorkbenchLeftSidebar({
  collapsed,
  width,
  route,
  codeThreads,
  activeThreadId,
  sidebarView,
  connectPhoneSidebarOpen,
  runtimeReady,
  threadSearch,
  showArchivedThreads,
  focusModeEnabled,
  onFocusModeChange,
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
  onToggleConnectPhone,
  onScheduleOpen,
  onOpenWrite,
    onOpenDesign,
    onNewConversation
  }: WorkbenchLeftSidebarProps): ReactElement | null {
  if (collapsed) return null
  return (
    <>
      <div className="min-h-0 shrink-0" style={{ width }}>
        {route === 'design' ? (
          <DesignSidebar
            onOpenSettings={onOpenSettings}
            onToggleTheme={onToggleTheme}
            connectPhoneSidebarOpen={connectPhoneSidebarOpen}
            onToggleConnectPhone={onToggleConnectPhone}
            onOpenWrite={onOpenWrite}
            onOpenDesign={onOpenDesign}
          />
        ) : route === 'write' ? (
          <Suspense fallback={<SidebarFallback />}>
            <WriteSidebar
              connectPhoneSidebarOpen={connectPhoneSidebarOpen}
              onOpenSettings={onOpenSettings}
              onToggleConnectPhone={onToggleConnectPhone}
              onOpenWrite={onOpenWrite}
              onOpenDesign={onOpenDesign}
            />
          </Suspense>
        ) : (
          <Sidebar
            threads={codeThreads}
            activeThreadId={activeThreadId}
            activeView={sidebarView}
            connectPhoneSidebarOpen={connectPhoneSidebarOpen}
            pluginsActive={route === 'plugins'}
            expertsActive={route === 'experts'}
            runtimeReady={runtimeReady}
            threadSearch={threadSearch}
            showArchivedThreads={showArchivedThreads}
            onThreadSearchChange={onThreadSearchChange}
            onSelectThread={onSelectThread}
            onRenameThread={onRenameThread}
            onPinThread={onPinThread}
            onArchiveThread={onArchiveThread}
            onDeleteThread={onDeleteThread}
            onRestoreThread={onRestoreThread}
            onNewChat={onNewChat}
            onNewChatInWorkspace={onNewChatInWorkspace}
            onOpenRequirementDraft={onOpenRequirementDraft}
            onOpenSettings={onOpenSettings}
            onOpenPlugins={onOpenPlugins}
            onOpenExperts={onOpenExperts}
            onToggleTheme={onToggleTheme}
            focusModeEnabled={focusModeEnabled}
            onFocusModeChange={onFocusModeChange}
            onToggleConnectPhone={onToggleConnectPhone}
            onScheduleOpen={onScheduleOpen}
            onOpenWrite={onOpenWrite}
            onOpenDesign={onOpenDesign}
            onNewConversation={onNewConversation}
          />
        )}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="relative z-0 w-px shrink-0 bg-ds-border-muted"
      />
    </>
  )
}
