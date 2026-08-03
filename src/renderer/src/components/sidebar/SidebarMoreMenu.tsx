import { useState, type ReactElement } from 'react'
import { ChevronRight, MoreHorizontal, PenLine, Shapes, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SidebarCommandRow } from './SidebarPrimitives'

type Props = {
  connectPhoneSidebarOpen: boolean
  currentView: 'chat' | 'write' | 'design'
  onToggleConnectPhone: () => void
  onOpenWrite: () => void
  onOpenDesign: () => void
}

/**
 * Collapsible "更多" menu shared by the chat / write / design left sidebars.
 * Holds the secondary navigation entries: 连接手机, 写作, 设计.
 */
export function SidebarMoreMenu({
  connectPhoneSidebarOpen,
  currentView,
  onToggleConnectPhone,
  onOpenWrite,
  onOpenDesign
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <SidebarCommandRow
        icon={<MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />}
        label={t('more')}
        onClick={() => setMoreOpen((open) => !open)}
        active={moreOpen}
        trailing={
          <ChevronRight
            className={`h-3.5 w-3.5 text-ds-faint transition-transform ${moreOpen ? 'rotate-90' : ''}`}
            strokeWidth={1.8}
          />
        }
      />
      {moreOpen ? (
        <div className="ds-no-drag flex flex-col pl-3">
          <SidebarCommandRow
            icon={<Smartphone className="h-4 w-4" strokeWidth={1.75} />}
            label={t('claw')}
            onClick={onToggleConnectPhone}
            active={connectPhoneSidebarOpen}
          />
          <SidebarCommandRow
            icon={<PenLine className="h-4 w-4" strokeWidth={1.75} />}
            label={t('write')}
            onClick={onOpenWrite}
            active={currentView === 'write'}
          />
          <SidebarCommandRow
            icon={<Shapes className="h-4 w-4" strokeWidth={1.75} />}
            label={t('design')}
            onClick={onOpenDesign}
            active={currentView === 'design'}
          />
        </div>
      ) : null}
    </>
  )
}
