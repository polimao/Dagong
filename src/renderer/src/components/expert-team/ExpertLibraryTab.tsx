import { useMemo, useState, type ReactElement } from 'react'
import { Search } from 'lucide-react'
import {
  useExpertTeamStore,
  type Expert,
  type ExpertCategory
} from '../../store/expert-team-store'
import {
  EmptyState,
  ExpertAvatar,
  TagPill
} from './parts'

type Filter = ExpertCategory | '全部'

export function ExpertLibraryTab({
  onExpertClick
}: {
  onExpertClick: (id: string) => void
}): ReactElement {
  const experts = useExpertTeamStore((s) => s.experts)
  const [filter, setFilter] = useState<Filter>('全部')
  const [query, setQuery] = useState('')

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(experts.map((e) => e.category)))] as Filter[],
    [experts]
  )

  const filtered = useMemo(() => {
    let list = filter === '全部' ? experts : experts.filter((e) => e.category === filter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.domain.toLowerCase().includes(q) ||
          e.tagline.toLowerCase().includes(q) ||
          e.goodAt.some((g) => g.toLowerCase().includes(q))
      )
    }
    return list
  }, [experts, filter, query])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = c === filter
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  active
                    ? 'bg-ds-ink text-white dark:bg-white dark:text-ds-ink'
                    : 'bg-slate-500/10 text-slate-600 hover:opacity-80 dark:text-slate-300'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ds-faint" strokeWidth={1.75} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索专家、领域、技能…"
            className="w-56 rounded-xl border border-ds-border bg-ds-card py-2 pl-9 pr-3 text-[13px] text-ds-ink outline-none transition placeholder:text-ds-faint focus:border-accent/40 focus:ring-1 focus:ring-accent/25"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="未找到匹配的专家"
          desc="尝试调整筛选条件或搜索关键词"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <ExpertCard key={e.id} expert={e} onClick={() => onExpertClick(e.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExpertCard({
  expert,
  onClick
}: {
  expert: Expert
  onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-ds-border bg-ds-card p-4 text-left transition hover:bg-ds-hover"
    >
      <div className="flex items-center gap-3">
        <ExpertAvatar emoji={expert.emoji} category={expert.category} size="md" />
        <div className="min-w-0">
          <span className="truncate text-sm font-semibold text-ds-ink">{expert.name}</span>
          <p className="mt-0.5 text-[12px] text-ds-faint">{expert.domain}</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ds-muted">{expert.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {expert.goodAt.slice(0, 4).map((g) => (
          <TagPill key={g} label={g} />
        ))}
      </div>
    </button>
  )
}
