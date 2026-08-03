import type { ReactElement } from 'react'
import dagongClip from '../../../../asset/img/dagong_clip.png'
import dagongSearch from '../../../../asset/img/dagong_search.png'
import dagongLaptop from '../../../../asset/img/dagong_laptop.png'
import dagongMagic from '../../../../asset/img/dagong_magic.png'
import dagongCheer from '../../../../asset/img/dagong_cheer.png'
import dagongHeadset from '../../../../asset/img/dagong_headset.png'
import dagongWrench from '../../../../asset/img/dagong_wrench.png'
import dagongRest from '../../../../asset/img/dagong_rest.png'

/**
 * Animated dagong mascot avatar. Each role id maps to a distinct real dagong PNG pose
 * with a per-role CSS animation (float / sway / breathe / bob). Disabled rows
 * render the resting dagong in grayscale.
 *
 * Pose map:
 *   design-reviewer            → dagong_clip    (写字板·审查,  bob)
 *   over-engineering-reviewer  → dagong_search  (放大镜·审视,  float)
 *   code-review                → dagong_laptop  (笔记本·看代码, breathe)
 *   compaction                 → dagong_magic   (魔法棒·压缩,  sway)
 *   title                      → dagong_cheer   (庆祝·命名,    bob)
 *   summary                    → dagong_headset (耳麦·复述,    float)
 *   custom / fallback          → dagong_wrench  (工具·自定义,  breathe)
 *   disabled                   → dagong_rest    (抱枕睡, grayscale, no motion)
 */

type Anim = 'float' | 'sway' | 'breathe' | 'bob'

const STYLE_ID = 'ds-agent-dagong-style'
const STYLE = `
@keyframes dsDagongFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes dsDagongSway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes dsDagongBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes dsDagongBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-2.5px) rotate(3deg)}}
.ds-agent-dagong{display:inline-flex;align-items:center;justify-content:center}
.ds-agent-dagong img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(31,45,64,.14))}
.ds-agent-dagong.is-disabled img{filter:grayscale(1) opacity(.7)}
.ds-agent-dagong-float img{animation:dsDagongFloat 2.4s ease-in-out infinite}
.ds-agent-dagong-sway img{animation:dsDagongSway 2.1s ease-in-out infinite;transform-origin:50% 90%}
.ds-agent-dagong-breathe img{animation:dsDagongBreathe 3s ease-in-out infinite}
.ds-agent-dagong-bob img{animation:dsDagongBob 2.7s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ds-agent-dagong img{animation:none!important}}
`

function ensureStyle(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = STYLE
  document.head.appendChild(el)
}

const POSE: Record<string, { src: string; anim: Anim }> = {
  general: { src: dagongLaptop, anim: 'breathe' },
  explore: { src: dagongSearch, anim: 'float' },
  'design-reviewer': { src: dagongClip, anim: 'bob' },
  'over-engineering-reviewer': { src: dagongWrench, anim: 'sway' },
  'code-review': { src: dagongClip, anim: 'breathe' },
  compaction: { src: dagongMagic, anim: 'sway' },
  title: { src: dagongCheer, anim: 'bob' },
  summary: { src: dagongHeadset, anim: 'float' }
}

const FALLBACK: { src: string; anim: Anim } = { src: dagongWrench, anim: 'breathe' }

/**
 * @param id      role id (drives the pose); unknown ids → fallback (custom dagong)
 * @param disabled when true, renders resting dagong in grayscale with no motion
 * @param className sizing wrapper class (e.g. "h-10 w-10")
 */
export function AgentDagong({
  id,
  disabled = false,
  className
}: {
  id: string
  /** Retained for API compatibility with old callers; unused (PNGs are fixed). */
  color?: string
  disabled?: boolean
  className?: string
}): ReactElement {
  ensureStyle()
  if (disabled) {
    return (
      <span className={`ds-agent-dagong is-disabled ${className ?? ''}`}>
        <img src={dagongRest} alt="" aria-hidden="true" />
      </span>
    )
  }
  const pose = POSE[id] ?? FALLBACK
  return (
    <span className={`ds-agent-dagong ds-agent-dagong-${pose.anim} ${className ?? ''}`}>
      <img src={pose.src} alt="" aria-hidden="true" />
    </span>
  )
}
