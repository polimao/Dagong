import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  AlertCircle, Banknote, Building2, Cpu, GitMerge, Leaf, LineChart, Loader2,
  MapPin, Megaphone, Palette, Play, Radar, Receipt, Rocket, Scale, ShieldAlert,
  Target, Truck, Users, X, type LucideIcon
} from 'lucide-react'
import {
  buildTeamSystemPrompt,
  COLLABORATION_MODE_META,
  useExpertTeamStore
} from '../../store/expert-team-store'
import { useChatStore } from '../../store/chat-store'
import { ExpertAvatar } from './parts'

export function TeamDetailModal({
  templateId,
  onClose
}: {
  templateId: string
  onClose: () => void
}): ReactElement {
  const tpl = useExpertTeamStore((s) => s.templates.find((t) => t.id === templateId))
  const experts = useExpertTeamStore((s) => s.experts)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const members = useMemo(() => {
    if (!tpl) return []
    return tpl.expertIds
      .map((id) => experts.find((e) => e.id === id))
      .filter((e) => e != null)
  }, [tpl, experts])

  const handleStart = async (): Promise<void> => {
    if (!tpl || members.length === 0 || launching) return
    setLaunching(true)
    setError(null)
    try {
      const store = useChatStore.getState()
      const beforeId = store.activeThreadId
      const systemPrompt = buildTeamSystemPrompt(tpl, members)
      await store.createThread({
        conversation: true,
        systemPrompt,
        title: tpl.name
      })
      const afterId = useChatStore.getState().activeThreadId
      // createThread 失败时不抛出且不更新 activeThreadId，靠前后对比判断是否成功
      if (afterId && afterId !== beforeId) {
        useChatStore.getState().setCollaborationContext({
          type: 'team',
          name: tpl.name,
          emoji: '\u{1F465}',
          systemPrompt,
          threadId: afterId
        })
        store.setRoute('chat')
        onClose()
      } else {
        const err = useChatStore.getState().error
        setError(err ?? '启动协作失败，请检查运行时连接')
        setLaunching(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动协作失败，请检查运行时连接')
      setLaunching(false)
    }
  }

  if (!tpl) {
    return (
      <div
        className="ds-no-drag fixed inset-0 z-[95] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
        onMouseDown={onClose}
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="团队信息不存在"
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-[24px] border border-ds-border bg-ds-card p-8 text-center shadow-2xl"
        >
          <p className="text-sm text-ds-muted">团队信息不存在</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-xl border border-ds-border bg-ds-card px-4 py-2 text-[13px] font-medium text-ds-muted transition hover:bg-ds-hover"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  const modeMeta = COLLABORATION_MODE_META[tpl.collaborationMode]

  return (
    <div
      className="ds-no-drag fixed inset-0 z-[95] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-detail-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[24px] border border-ds-border bg-ds-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-ds-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              {(() => {
                const map: Record<string, LucideIcon> = {
                  rocket: Rocket, banknote: Banknote, radar: Radar, scale: Scale,
                  megaphone: Megaphone, 'line-chart': LineChart, 'building-2': Building2,
                  'git-merge': GitMerge, 'shield-alert': ShieldAlert, receipt: Receipt,
                  truck: Truck, palette: Palette, leaf: Leaf, cpu: Cpu
                }
                const Icon = map[tpl.icon] ?? Target
                return <Icon className="h-5 w-5" strokeWidth={1.8} />
              })()}
            </div>
            <div>
              <h2 id="team-detail-title" className="text-[16px] font-semibold text-ds-ink">{tpl.name}</h2>
              <span className="text-[12px] text-ds-faint">{tpl.scenario}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="rounded-xl bg-ds-subtle/60 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ds-faint">
                <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
                目标
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-ds-ink">
                {tpl.goal || '未设定目标'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-ds-faint">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                  场景
                </div>
                <div className="mt-1 text-[13px] text-ds-ink">{tpl.scenario}</div>
              </div>
              <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-ds-faint">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  成员
                </div>
                <div className="mt-1 text-[13px] text-ds-ink">{members.length} 位专家</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-ds-ink">协作模式</div>
              <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
                <div className="text-[14px] font-semibold text-ds-ink">{modeMeta.label}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-ds-muted">{modeMeta.desc}</p>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium text-ds-ink">成员列表</div>
              <div className="space-y-2">
                {members.map((e, i) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-ds-border bg-ds-card p-3"
                  >
                    <ExpertAvatar emoji={e.emoji} category={e.category} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ds-ink">{e.name}</div>
                      <div className="text-[12px] text-ds-faint">{e.domain}</div>
                    </div>
                    <span className="rounded-md bg-ds-subtle px-2 py-0.5 text-[11px] text-ds-muted">
                      {i === 0 ? '团长' : `成员 ${i}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" strokeWidth={1.75} />
                <p className="text-[13px] leading-relaxed text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="border-t border-ds-border px-6 py-4">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={launching || members.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ds-userbubble px-4 py-2.5 text-[14px] font-semibold text-ds-userbubbleFg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {launching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                正在准备…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" strokeWidth={2} />
                开始协作
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[12px] text-ds-faint">
            点击后创建对话，你可以编写任务要求或上传文件后自行发送
          </p>
        </footer>
      </div>
    </div>
  )
}
