import { useEffect, useRef, useState, type ReactElement } from 'react'
import { AlertCircle, Loader2, Play, Quote, X } from 'lucide-react'
import { useExpertTeamStore } from '../../store/expert-team-store'
import { useChatStore } from '../../store/chat-store'
import { ExpertAvatar, TagPill } from './parts'

export function ExpertDetailModal({
  expertId,
  onClose
}: {
  expertId: string
  onClose: () => void
}): ReactElement {
  const expert = useExpertTeamStore((s) => s.experts.find((e) => e.id === expertId))
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

  const handleStart = async (): Promise<void> => {
    if (!expert || launching) return
    setLaunching(true)
    setError(null)
    try {
      const store = useChatStore.getState()
      const beforeId = store.activeThreadId
      await store.createThread({
        conversation: true,
        systemPrompt: expert.systemPrompt,
        title: `${expert.emoji} ${expert.name}`
      })
      const afterId = useChatStore.getState().activeThreadId
      // createThread 失败时不抛出且不更新 activeThreadId，靠前后对比判断是否成功
      if (afterId && afterId !== beforeId) {
        useChatStore.getState().setCollaborationContext({
          type: 'expert',
          name: expert.name,
          emoji: expert.emoji,
          systemPrompt: expert.systemPrompt,
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

  if (!expert) {
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
          aria-label="专家信息不存在"
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-[24px] border border-ds-border bg-ds-card p-8 text-center shadow-2xl"
        >
          <p className="text-sm text-ds-muted">专家信息不存在</p>
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
        aria-labelledby="expert-detail-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border border-ds-border bg-ds-card shadow-2xl"
      >
        <header className="relative border-b border-ds-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.7} />
          </button>
          <div className="flex items-start gap-4">
            <ExpertAvatar emoji={expert.emoji} category={expert.category} size="lg" />
            <div className="min-w-0 pr-8">
              <h2 id="expert-detail-title" className="text-[18px] font-bold text-ds-ink">{expert.name}</h2>
              <p className="mt-1.5 text-[13px] text-ds-faint">{expert.domain}</p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div>
              <h3 className="mb-1.5 text-[13px] font-semibold text-ds-ink">简介</h3>
              <p className="text-[14px] leading-relaxed text-ds-muted">{expert.expertise}</p>
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ds-ink">擅长领域</h3>
              <div className="flex flex-wrap gap-1.5">
                {expert.goodAt.map((g) => (
                  <TagPill key={g} label={g} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ds-ink">角色设定</h3>
              <div className="rounded-xl border border-ds-border bg-ds-subtle/40 px-4 py-3">
                <Quote className="mb-1.5 h-3.5 w-3.5 text-ds-faint" strokeWidth={1.75} />
                <p className="text-[13px] leading-relaxed text-ds-muted">{expert.systemPrompt}</p>
              </div>
            </div>

            <div className="flex items-center justify-end rounded-xl bg-ds-subtle/60 px-4 py-3">
              {expert.builtin ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  内置专家
                </span>
              ) : (
                <span className="rounded-full bg-ds-subtle px-2.5 py-0.5 text-[11px] font-medium text-ds-muted">
                  自定义
                </span>
              )}
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
            disabled={launching}
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
