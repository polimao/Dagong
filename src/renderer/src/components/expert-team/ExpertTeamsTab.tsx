import { useMemo, useState, type ReactElement } from 'react'
import {
  Banknote,
  Building2,
  ChevronRight,
  Cpu,
  GitMerge,
  Layers,
  Leaf,
  LineChart,
  Megaphone,
  Palette,
  Radar,
  Receipt,
  Rocket,
  Scale,
  ShieldAlert,
  Truck,
  type LucideIcon
} from 'lucide-react'
import {
  CATEGORY_META,
  useExpertTeamStore,
  type Expert,
  type TeamTemplate
} from '../../store/expert-team-store'

const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  banknote: Banknote,
  radar: Radar,
  scale: Scale,
  megaphone: Megaphone,
  'line-chart': LineChart,
  'building-2': Building2,
  'git-merge': GitMerge,
  'shield-alert': ShieldAlert,
  receipt: Receipt,
  truck: Truck,
  palette: Palette,
  leaf: Leaf,
  cpu: Cpu
}

const TEAM_ICON_COLOR: Record<string, string> = {
  rocket: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  banknote: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  radar: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  scale: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  megaphone: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  'line-chart': 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  'building-2': 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  'git-merge': 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
  'shield-alert': 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300',
  receipt: 'bg-orange-500/15 text-orange-600 dark:text-orange-300',
  truck: 'bg-lime-500/15 text-lime-600 dark:text-lime-300',
  palette: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300',
  leaf: 'bg-green-500/15 text-green-600 dark:text-green-300',
  cpu: 'bg-teal-500/15 text-teal-600 dark:text-teal-300'
}

function teamIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Layers
}

export function ExpertTeamsTab({
  onTeamClick
}: {
  onTeamClick: (templateId: string) => void
}): ReactElement {
  const templates = useExpertTeamStore((s) => s.templates)
  const experts = useExpertTeamStore((s) => s.experts)
  const [filter, setFilter] = useState<string>('全部')

  const expertMap = useMemo(() => new Map(experts.map((e) => [e.id, e])), [experts])

  const scenarios = useMemo(
    () => ['全部', ...Array.from(new Set(templates.map((t) => t.scenario)))],
    [templates]
  )

  const filtered = useMemo(
    () => (filter === '全部' ? templates : templates.filter((t) => t.scenario === filter)),
    [templates, filter]
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {scenarios.map((s) => {
          const active = s === filter
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                active
                  ? 'bg-ds-ink text-white dark:bg-white dark:text-ds-ink'
                  : 'bg-slate-500/10 text-slate-600 hover:opacity-80 dark:text-slate-300'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tpl) => (
          <TeamCard
            key={tpl.id}
            tpl={tpl}
            expertMap={expertMap}
            onClick={() => onTeamClick(tpl.id)}
          />
        ))}
      </div>
    </div>
  )
}

function TeamCard({
  tpl,
  expertMap,
  onClick
}: {
  tpl: TeamTemplate
  expertMap: Map<string, Expert>
  onClick: () => void
}): ReactElement {
  const members = tpl.expertIds
    .map((id) => expertMap.get(id))
    .filter((m) => m != null)
  const Icon = teamIcon(tpl.icon)
  const iconColor = TEAM_ICON_COLOR[tpl.icon] ?? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-ds-border bg-ds-card p-4 text-left transition hover:bg-ds-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}
          >
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ds-ink">{tpl.name}</span>
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-ds-faint transition-transform group-hover:translate-x-0.5"
        />
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ds-muted">{tpl.description}</p>

      <div className="mt-3 flex items-center gap-1.5">
        {members.map((m) => (
          <span
            key={m.id}
            title={m.name}
            className={`flex h-6 w-6 items-center justify-center rounded-full border border-ds-border text-[12px] ${CATEGORY_META[m.category].avatar}`}
          >
            {m.emoji}
          </span>
        ))}
        <span className="ml-1 text-[12px] text-ds-faint">{members.length} 位专家</span>
      </div>
    </button>
  )
}
