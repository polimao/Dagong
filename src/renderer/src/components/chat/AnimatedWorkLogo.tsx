import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { UiPluginFigureSlot } from '@shared/ui-plugin'
import { useUiPluginFigure } from '../../store/ui-plugin-store'
import magicpocketLogo from '../../../../asset/img/magicpocket_bird.png'
import magicpocketSurfFigure from '../../../../asset/img/magicpocket_surf.png'
import magicpocketGreetFigure from '../../../../asset/img/magicpocket_greet.png'
import magicpocketSleepFigure from '../../../../asset/img/magicpocket_sleep.png'
import magicpocketSitFigure from '../../../../asset/img/magicpocket_sit.png'
import imagicpocketFigure from '../../../../asset/img/imagicpocket.png'
import imagicpocketRunFigure from '../../../../asset/img/imagicpocket_run.png'
import imagicpocketBobaFigure from '../../../../asset/img/imagicpocket_boba.png'
import imagicpocketWaveFigure from '../../../../asset/img/imagicpocket_wave.png'
import imagicpocketSleepFigure from '../../../../asset/img/imagicpocket_sleep.png'

/* UI 插件按槽位覆盖默认 MagicPocket 形象时的回退链 */
export const UI_PLUGIN_STATE_SLOTS: Record<MagicPocketStateFigureKind, readonly UiPluginFigureSlot[]> = {
  greet: ['greet', 'swim'],
  sleep: ['sleep', 'sit', 'swim'],
  sit: ['sit', 'greet', 'swim']
}

export type WorkLogoSwimMode = 'propel' | 'sprint' | 'dive' | 'surf'

export const WORK_LOGO_SWIM_MODES: readonly WorkLogoSwimMode[] = [
  'propel',
  'sprint',
  'dive',
  'surf'
]

export const WORK_LOGO_SWIM_MODE_LABEL_KEYS: Record<WorkLogoSwimMode, string> = {
  propel: 'working',
  sprint: 'workingSprint',
  dive: 'workingDive',
  surf: 'workingSurf'
}

const WORK_LOGO_SWIM_MODE_INTERVAL_MS = 4200

export function useWorkLogoSwimMode(active: boolean): WorkLogoSwimMode {
  // 起点随机,避免每次都从「推进中」开始;之后按顺序轮播
  const [modeIndex, setModeIndex] = useState(() =>
    Math.floor(Math.random() * WORK_LOGO_SWIM_MODES.length)
  )

  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      setModeIndex((current) => (current + 1) % WORK_LOGO_SWIM_MODES.length)
    }, WORK_LOGO_SWIM_MODE_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [active])

  return WORK_LOGO_SWIM_MODES[modeIndex] ?? 'propel'
}

export type MagicPocketStateFigureKind = 'greet' | 'sleep' | 'sit'

const KUN_STATE_FIGURES: Record<MagicPocketStateFigureKind, string> = {
  greet: magicpocketGreetFigure,
  sleep: magicpocketSleepFigure,
  sit: magicpocketSitFigure
}

/* iMagicPocket 模式下的对应姿态:打招呼→挥手,睡觉→抱枕打盹,坐着→喝奶茶 */
const KUN_STATE_IKUN_FIGURES: Record<MagicPocketStateFigureKind, string> = {
  greet: imagicpocketWaveFigure,
  sleep: imagicpocketSleepFigure,
  sit: imagicpocketBobaFigure
}

/** 静态场景里的 MagicPocket 形象:打招呼(欢迎)、睡觉(运行时待唤醒)、坐着(空状态) */
export function MagicPocketStateFigure({
  kind,
  className = ''
}: {
  kind: MagicPocketStateFigureKind
  className?: string
}): ReactElement {
  // UI 插件激活时按槽位覆盖默认 MagicPocket 美术(iMagicPocket 内置模式走 CSS 双图切换,不经过这里)
  const magicpocketFigureSrc = useUiPluginFigure(UI_PLUGIN_STATE_SLOTS[kind], KUN_STATE_FIGURES[kind])
  return (
    <span
      className={['ds-magicpocket-state', `ds-magicpocket-state-${kind}`, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <img
        className="ds-magicpocket-state-figure"
        src={magicpocketFigureSrc}
        alt=""
        draggable={false}
        decoding="async"
      />
      <img
        className="ds-imagicpocket-state-figure"
        src={KUN_STATE_IKUN_FIGURES[kind]}
        alt=""
        draggable={false}
        decoding="async"
      />
    </span>
  )
}

export type ImagicpocketCameoType = 'dash' | 'chase' | 'peek' | 'boba' | 'nap'
export type ImagicpocketCameoSide = 'left' | 'right'
export type ImagicpocketCameoSpec = { id: number; type: ImagicpocketCameoType; side: ImagicpocketCameoSide }

export const IKUN_CAMEO_TYPES: readonly ImagicpocketCameoType[] = ['dash', 'chase', 'peek', 'boba', 'nap']

/* 每种戏码演完的总时长,与 CSS 里的 forwards 动画时长保持一致 */
export const IKUN_CAMEO_DURATIONS_MS: Record<ImagicpocketCameoType, number> = {
  dash: 5200,
  chase: 6600,
  peek: 6200,
  boba: 7200,
  nap: 8200
}

const IKUN_CAMEO_FIGURES: Record<Exclude<ImagicpocketCameoType, 'chase'>, string> = {
  dash: imagicpocketRunFigure,
  peek: imagicpocketWaveFigure,
  boba: imagicpocketBobaFigure,
  nap: imagicpocketSleepFigure
}

const IKUN_CAMEO_MIN_GAP_MS = 18000
const IKUN_CAMEO_MAX_GAP_MS = 45000
const IKUN_CAMEO_FIRST_GAP_MS = 7000

let imagicpocketCameoSequence = 0

export function pickImagicpocketCameo(): ImagicpocketCameoSpec {
  const type = IKUN_CAMEO_TYPES[Math.floor(Math.random() * IKUN_CAMEO_TYPES.length)] ?? 'dash'
  const side: ImagicpocketCameoSide = Math.random() < 0.5 ? 'left' : 'right'
  imagicpocketCameoSequence += 1
  return { id: imagicpocketCameoSequence, type, side }
}

/* 出没彩蛋的槽位回退链:插件模式取插件图,iMagicPocket 模式回退坤鸡美术 */
export const UI_PLUGIN_CAMEO_SLOTS: Record<Exclude<ImagicpocketCameoType, 'chase'>, readonly UiPluginFigureSlot[]> = {
  dash: ['run', 'swim'],
  peek: ['greet', 'swim'],
  boba: ['sit', 'greet', 'swim'],
  nap: ['sleep', 'sit', 'swim']
}

function ImagicpocketCameoFigure({
  type,
  side,
  second = false
}: {
  type: Exclude<ImagicpocketCameoType, 'chase'>
  side: ImagicpocketCameoSide
  second?: boolean
}): ReactElement {
  const src = useUiPluginFigure(UI_PLUGIN_CAMEO_SLOTS[type], IKUN_CAMEO_FIGURES[type])
  return (
    <span
      className={[
        'ds-imagicpocket-cameo',
        `ds-imagicpocket-cameo-${type}`,
        `is-${side}`,
        second ? 'is-second' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ds-imagicpocket-cameo-flip">
        <img className="ds-imagicpocket-cameo-figure" src={src} alt="" draggable={false} decoding="async" />
      </span>
    </span>
  )
}

/** 单场坤鸡戏码;chase 是组合动画:两只对穿,第二只小一号晚一拍 */
export function ImagicpocketCameo({ cameo }: { cameo: Pick<ImagicpocketCameoSpec, 'type' | 'side'> }): ReactElement {
  if (cameo.type === 'chase') {
    const otherSide: ImagicpocketCameoSide = cameo.side === 'left' ? 'right' : 'left'
    return (
      <>
        <ImagicpocketCameoFigure type="dash" side={cameo.side} />
        <ImagicpocketCameoFigure type="dash" side={otherSide} second />
      </>
    )
  }
  return <ImagicpocketCameoFigure type={cameo.type} side={cameo.side} />
}

/** iMagicPocket 模式专属:主会话两侧不定时出没的坤鸡彩蛋层(指针穿透,纯装饰) */
export function ImagicpocketCameoLayer(): ReactElement {
  const [cameo, setCameo] = useState<ImagicpocketCameoSpec | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = 0
    const schedule = (delay: number): void => {
      timer = window.setTimeout(() => {
        const next = pickImagicpocketCameo()
        setCameo(next)
        timer = window.setTimeout(() => {
          setCameo(null)
          schedule(
            IKUN_CAMEO_MIN_GAP_MS + Math.random() * (IKUN_CAMEO_MAX_GAP_MS - IKUN_CAMEO_MIN_GAP_MS)
          )
        }, IKUN_CAMEO_DURATIONS_MS[next.type])
      }, delay)
    }
    schedule(IKUN_CAMEO_FIRST_GAP_MS + Math.random() * 8000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <span className="ds-imagicpocket-cameo-layer" aria-hidden="true">
      {cameo ? <ImagicpocketCameo key={cameo.id} cameo={cameo} /> : null}
    </span>
  )
}

export type MagicPocketCelebrationVariant = 'cheer' | 'lap' | 'toast'

export const KUN_CELEBRATION_VARIANTS: readonly MagicPocketCelebrationVariant[] = [
  'cheer',
  'lap',
  'toast'
]

/* 与 CSS 里 forwards 动画总时长一致 */
export const KUN_CELEBRATION_DURATIONS_MS: Record<MagicPocketCelebrationVariant, number> = {
  cheer: 3200,
  lap: 3600,
  toast: 3400
}

/* 每种庆祝的双形象:普通模式用 MagicPocket 鸟,iMagicPocket 模式自动换坤鸡 */
const KUN_CELEBRATION_FIGURES: Record<MagicPocketCelebrationVariant, { magicpocket: string; imagicpocket: string }> = {
  cheer: { magicpocket: magicpocketGreetFigure, imagicpocket: imagicpocketWaveFigure },
  lap: { magicpocket: magicpocketSurfFigure, imagicpocket: imagicpocketRunFigure },
  toast: { magicpocket: magicpocketSitFigure, imagicpocket: imagicpocketBobaFigure }
}

/* 回合至少跑这么久才庆祝,避免秒回也放彩带 */
const KUN_CELEBRATION_MIN_TURN_MS = 2000

let magicpocketCelebrationSequence = 0

export function pickMagicPocketCelebration(): { id: number; variant: MagicPocketCelebrationVariant } {
  const variant =
    KUN_CELEBRATION_VARIANTS[Math.floor(Math.random() * KUN_CELEBRATION_VARIANTS.length)] ??
    'cheer'
  magicpocketCelebrationSequence += 1
  return { id: magicpocketCelebrationSequence, variant }
}

function MagicPocketConfettiBurst(): ReactElement {
  return (
    <span className="ds-magicpocket-confetti">
      {Array.from({ length: 10 }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  )
}

/* 庆祝戏码的插件槽位回退链 */
export const UI_PLUGIN_CELEBRATION_SLOTS: Record<MagicPocketCelebrationVariant, readonly UiPluginFigureSlot[]> = {
  cheer: ['greet', 'swim'],
  lap: ['run', 'surf', 'swim'],
  toast: ['sit', 'greet', 'swim']
}

/** 单场庆祝:跃起欢呼 / 胜利冲浪(iMagicPocket 为快攻冲刺) / 举杯庆功 */
export function MagicPocketCelebration({ variant }: { variant: MagicPocketCelebrationVariant }): ReactElement {
  const figures = KUN_CELEBRATION_FIGURES[variant]
  const magicpocketFigureSrc = useUiPluginFigure(UI_PLUGIN_CELEBRATION_SLOTS[variant], figures.magicpocket)
  return (
    <span className={`ds-magicpocket-celebration ds-magicpocket-celebration-${variant}`}>
      <span className="ds-magicpocket-celebration-figure-wrap">
        <img
          className="ds-magicpocket-celebration-figure is-magicpocket"
          src={magicpocketFigureSrc}
          alt=""
          draggable={false}
          decoding="async"
        />
        <img
          className="ds-magicpocket-celebration-figure is-imagicpocket"
          src={figures.imagicpocket}
          alt=""
          draggable={false}
          decoding="async"
        />
        <MagicPocketConfettiBurst />
      </span>
    </span>
  )
}

/** 回合完成庆祝层:active(busy)从 true 落回 false 且跑得够久时,随机放一段 */
export function MagicPocketCelebrationLayer({
  active,
  suppressed = false
}: {
  active: boolean
  suppressed?: boolean
}): ReactElement {
  const [celebration, setCelebration] = useState<{
    id: number
    variant: MagicPocketCelebrationVariant
  } | null>(null)
  const turnStartRef = useRef<number | null>(null)
  const hideTimerRef = useRef(0)

  useEffect(() => {
    if (active) {
      turnStartRef.current = Date.now()
      return
    }
    if (turnStartRef.current === null) return
    const elapsed = Date.now() - turnStartRef.current
    turnStartRef.current = null
    if (suppressed) return
    if (elapsed < KUN_CELEBRATION_MIN_TURN_MS) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const next = pickMagicPocketCelebration()
    setCelebration(next)
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      setCelebration(null)
    }, KUN_CELEBRATION_DURATIONS_MS[next.variant])
  }, [active, suppressed])

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), [])

  return (
    <span className="ds-magicpocket-celebration-layer" aria-hidden="true">
      {celebration ? <MagicPocketCelebration key={celebration.id} variant={celebration.variant} /> : null}
    </span>
  )
}

const SIDEBAR_MASCOT_KINDS: readonly MagicPocketStateFigureKind[] = ['sit', 'greet', 'sleep']
const SIDEBAR_MASCOT_INTERVAL_MS = 10000

/** 侧边栏角落的吉祥物:循环 坐着→打招呼→睡觉,iMagicPocket 模式自动换成坤鸡全家福 */
export function SidebarMascot({ className = '' }: { className?: string }): ReactElement {
  const [kindIndex, setKindIndex] = useState(() =>
    Math.floor(Math.random() * SIDEBAR_MASCOT_KINDS.length)
  )

  useEffect(() => {
    const interval = window.setInterval(() => {
      setKindIndex((current) => (current + 1) % SIDEBAR_MASCOT_KINDS.length)
    }, SIDEBAR_MASCOT_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  const kind = SIDEBAR_MASCOT_KINDS[kindIndex] ?? 'sit'
  return (
    <MagicPocketStateFigure
      key={kind}
      kind={kind}
      className={['ds-sidebar-mascot', className].filter(Boolean).join(' ')}
    />
  )
}

export type ImagicpocketWorkLogoVariant = 'dribble' | 'run' | 'boba'

export const IKUN_WORK_LOGO_VARIANTS: readonly ImagicpocketWorkLogoVariant[] = [
  'dribble',
  'run',
  'boba'
]

const IKUN_WORK_LOGO_FIGURES: Record<ImagicpocketWorkLogoVariant, string> = {
  dribble: imagicpocketFigure,
  run: imagicpocketRunFigure,
  boba: imagicpocketBobaFigure
}

export const IKUN_WORK_LOGO_VARIANT_LABEL_KEYS: Record<ImagicpocketWorkLogoVariant, string> = {
  dribble: 'imagicpocketDribbling',
  run: 'imagicpocketFastBreak',
  boba: 'imagicpocketBobaTime'
}

const IKUN_WORK_LOGO_VARIANT_INTERVAL_MS = 2800

export function pickImagicpocketWorkLogoVariant(
  current?: ImagicpocketWorkLogoVariant
): ImagicpocketWorkLogoVariant {
  const candidates = IKUN_WORK_LOGO_VARIANTS.filter((variant) => variant !== current)
  const pool = candidates.length > 0 ? candidates : IKUN_WORK_LOGO_VARIANTS
  return pool[Math.floor(Math.random() * pool.length)] ?? 'dribble'
}

export function useImagicpocketWorkLogoVariant(active: boolean): ImagicpocketWorkLogoVariant {
  const [variant, setVariant] = useState<ImagicpocketWorkLogoVariant>(() => pickImagicpocketWorkLogoVariant())

  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      setVariant((current) => pickImagicpocketWorkLogoVariant(current))
    }, IKUN_WORK_LOGO_VARIANT_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [active])

  return variant
}

export function AnimatedWorkLogo({
  active = false,
  className = '',
  imagicpocketVariant,
  mode,
  phase = 'lead',
  size = 'sm'
}: {
  active?: boolean
  className?: string
  imagicpocketVariant?: ImagicpocketWorkLogoVariant
  mode?: WorkLogoSwimMode
  phase?: 'lead' | 'trail'
  size?: 'sm' | 'md'
}): ReactElement {
  const rotatedImagicpocketVariant = useImagicpocketWorkLogoVariant(active && imagicpocketVariant === undefined)
  const effectiveImagicpocketVariant = imagicpocketVariant ?? rotatedImagicpocketVariant
  const rotatedSwimMode = useWorkLogoSwimMode(active && mode === undefined)
  const swimMode = mode ?? rotatedSwimMode
  const figureSrc = useUiPluginFigure(
    swimMode === 'surf' ? ['surf', 'swim'] : ['swim'],
    swimMode === 'surf' ? magicpocketSurfFigure : magicpocketLogo
  )

  return (
    <span
      className={[
        'ds-work-logo',
        `ds-work-logo-${size}`,
        `ds-work-logo-phase-${phase}`,
        `ds-work-logo-mode-${swimMode}`,
        active ? 'is-active' : '',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <span className="ds-work-logo-gust" />
      <span className="ds-work-logo-current" />
      <span className="ds-work-logo-swell" />
      <span className="ds-work-logo-wave ds-work-logo-wave-back" />
      <span className="ds-work-logo-ripple" />
      <span className="ds-work-logo-wave ds-work-logo-wave-front" />
      <span className="ds-work-logo-breaker" />
      <span className="ds-work-logo-wake" />
      <span className="ds-work-logo-foam" />
      <span className="ds-work-logo-crest" />
      <span className="ds-work-logo-splash" />
      <span className="ds-work-logo-spray" />
      <span className="ds-work-logo-bubbles" />
      <img className="ds-work-logo-echo" src={figureSrc} alt="" draggable={false} decoding="async" />
      <span
        className={`ds-imagicpocket-logo ds-imagicpocket-logo-${effectiveImagicpocketVariant}`}
        data-imagicpocket-variant={effectiveImagicpocketVariant}
      >
        <span className="ds-imagicpocket-logo-shadow" />
        <img
          className="ds-imagicpocket-figure"
          src={IKUN_WORK_LOGO_FIGURES[effectiveImagicpocketVariant]}
          alt=""
          draggable={false}
          decoding="async"
        />
      </span>
      <span className="ds-work-logo-track">
        <span className="ds-work-logo-body">
          <img className="ds-work-logo-image" src={figureSrc} alt="" draggable={false} decoding="async" />
        </span>
      </span>
    </span>
  )
}
