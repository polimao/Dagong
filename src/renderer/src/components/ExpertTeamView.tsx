import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { SidebarTitlebarToggleButton } from './sidebar/SidebarPrimitives'
import { TabButton } from './PluginMarketplaceParts'
import { useExpertTeamStore } from '../store/expert-team-store'
import { ExpertLibraryTab } from './expert-team/ExpertLibraryTab'
import { ExpertTeamsTab } from './expert-team/ExpertTeamsTab'
import { TeamDetailModal } from './expert-team/TeamDetailModal'
import { ExpertDetailModal } from './expert-team/ExpertDetailModal'

type Tab = 'library' | 'teams'

export function ExpertTeamView({
  leftSidebarCollapsed,
  onToggleLeftSidebar
}: {
  leftSidebarCollapsed: boolean
  onToggleLeftSidebar: () => void
}): ReactElement {
  const { t } = useTranslation('common')
  const [tab, setTab] = useState<Tab>('library')
  const [expertDetailId, setExpertDetailId] = useState<string | null>(null)
  const [teamDetailId, setTeamDetailId] = useState<string | null>(null)

  const expertCount = useExpertTeamStore((s) => s.experts.length)
  const templateCount = useExpertTeamStore((s) => s.templates.length)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ds-stage-inset shrink-0">
        <header className="ds-topbar-surface relative z-10 mt-3 flex min-h-[46px] w-full items-stretch overflow-visible rounded-[24px]">
          <div className="grid w-full min-w-0 items-center gap-2.5 px-3 py-2 sm:px-4 md:pl-5 md:pr-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <SidebarTitlebarToggleButton
                onClick={onToggleLeftSidebar}
                title={leftSidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')}
                ariaLabel={leftSidebarCollapsed ? t('sidebarExpand') : t('sidebarCollapse')}
              />
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ds-muted" strokeWidth={1.75} />
                <h1 className="text-[15px] font-semibold text-ds-ink">{t('experts')}</h1>
              </div>
            </div>
          </div>
        </header>
      </div>

      <div className="shrink-0 px-6 pt-4 md:px-10 lg:px-14">
        <div className="inline-flex rounded-xl bg-ds-subtle p-1">
          <TabButton active={tab === 'library'} onClick={() => setTab('library')}>
            专家 ({expertCount})
          </TabButton>
          <TabButton active={tab === 'teams'} onClick={() => setTab('teams')}>
            专家团 ({templateCount})
          </TabButton>
        </div>
      </div>

      <main className="ds-no-drag min-h-0 flex-1 overflow-y-auto px-6 pb-12 pt-6 md:px-10 lg:px-14">
        <div className="mx-auto max-w-6xl">
          {tab === 'library' ? (
            <ExpertLibraryTab onExpertClick={setExpertDetailId} />
          ) : null}
          {tab === 'teams' ? (
            <ExpertTeamsTab onTeamClick={setTeamDetailId} />
          ) : null}
        </div>
      </main>

      {expertDetailId ? (
        <ExpertDetailModal expertId={expertDetailId} onClose={() => setExpertDetailId(null)} />
      ) : null}
      {teamDetailId ? (
        <TeamDetailModal templateId={teamDetailId} onClose={() => setTeamDetailId(null)} />
      ) : null}
    </div>
  )
}
