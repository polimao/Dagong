import type { ReactElement, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  CATEGORY_META,
  formatUsed,
  type ExpertCategory
} from '../../store/expert-team-store'

export function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-2xl border border-ds-border bg-ds-card px-4 py-2.5">
      <div className="text-lg font-bold text-ds-ink">{value}</div>
      <div className="text-[12px] text-ds-faint">{label}</div>
    </div>
  )
}

export function Section({
  title,
  icon: Icon,
  hint,
  action,
  children
}: {
  title: string
  icon: LucideIcon
  hint?: string
  action?: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-ds-subtle text-ds-muted">
          <Icon className="h-4 w-4" strokeWidth={1.9} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-ds-ink">{title}</h3>
          {hint ? <p className="text-[12.5px] text-ds-faint">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ExpertAvatar({
  emoji,
  category,
  size = 'md'
}: {
  emoji: string
  category?: ExpertCategory
  size?: 'sm' | 'md' | 'lg'
}): ReactElement {
  const dims =
    size === 'sm' ? 'h-7 w-7 text-sm' : size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl'
  const bg = category ? CATEGORY_META[category].avatar : 'bg-ds-subtle'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${bg} ${dims}`}
    >
      {emoji}
    </div>
  )
}

export function CategoryChip({ category }: { category: ExpertCategory }): ReactElement {
  const meta = CATEGORY_META[category]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {category}
    </span>
  )
}

export function TagPill({ label }: { label: string }): ReactElement {
  return (
    <span className="rounded-md bg-ds-subtle px-2 py-0.5 text-[11px] text-ds-muted">{label}</span>
  )
}

export function RatingBadge({ rating }: { rating: number }): ReactElement {
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] text-ds-faint">
      <svg className="h-3 w-3 fill-amber-400 text-amber-400" viewBox="0 0 20 20">
        <path d="M10 1l2.928 5.934 6.55.95-4.739 4.62L15.856 19 10 15.918 4.144 19l1.119-6.496L.52 7.884l6.55-.95z" />
      </svg>
      {rating}
    </span>
  )
}

export function UsageText({ count }: { count: number }): ReactElement {
  return <span className="text-[12px] text-ds-faint">{formatUsed(count)} 次使用</span>
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action
}: {
  icon: LucideIcon
  title: string
  desc: string
  action?: ReactNode
}): ReactElement {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ds-border bg-ds-subtle/50 py-12">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ds-card text-ds-faint">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-ds-ink">{title}</div>
        <p className="mt-1 text-[13px] text-ds-muted">{desc}</p>
      </div>
      {action}
    </div>
  )
}

export function PrimaryButton({
  onClick,
  children,
  disabled
}: {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-ds-userbubble px-4 py-2 text-[13px] font-semibold text-ds-userbubbleFg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  onClick,
  children
}: {
  onClick: () => void
  children: ReactNode
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-[13px] font-medium text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
    >
      {children}
    </button>
  )
}
