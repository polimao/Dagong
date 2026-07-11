import type { ReactElement } from 'react'
import magicpocketClip from '../../../../asset/img/magicpocket_clip.png'
import magicpocketSearch from '../../../../asset/img/magicpocket_search.png'
import magicpocketLaptop from '../../../../asset/img/magicpocket_laptop.png'
import magicpocketMagic from '../../../../asset/img/magicpocket_magic.png'
import magicpocketCheer from '../../../../asset/img/magicpocket_cheer.png'
import magicpocketHeadset from '../../../../asset/img/magicpocket_headset.png'
import magicpocketWrench from '../../../../asset/img/magicpocket_wrench.png'
import magicpocketRest from '../../../../asset/img/magicpocket_rest.png'

/**
 * Animated magicpocket mascot avatar. Each role id maps to a distinct real magicpocket PNG pose
 * with a per-role CSS animation (float / sway / breathe / bob). Disabled rows
 * render the resting magicpocket in grayscale.
 *
 * Pose map:
 *   design-reviewer            → magicpocket_clip    (写字板·审查,  bob)
 *   over-engineering-reviewer  → magicpocket_search  (放大镜·审视,  float)
 *   code-review                → magicpocket_laptop  (笔记本·看代码, breathe)
 *   compaction                 → magicpocket_magic   (魔法棒·压缩,  sway)
 *   title                      → magicpocket_cheer   (庆祝·命名,    bob)
 *   summary                    → magicpocket_headset (耳麦·复述,    float)
 *   custom / fallback          → magicpocket_wrench  (工具·自定义,  breathe)
 *   disabled                   → magicpocket_rest    (抱枕睡, grayscale, no motion)
 */

type Anim = 'float' | 'sway' | 'breathe' | 'bob'

const STYLE_ID = 'ds-agent-magicpocket-style'
const STYLE = `
@keyframes dsMagicPocketFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes dsMagicPocketSway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes dsMagicPocketBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes dsMagicPocketBob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-2.5px) rotate(3deg)}}
.ds-agent-magicpocket{display:inline-flex;align-items:center;justify-content:center}
.ds-agent-magicpocket img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(31,45,64,.14))}
.ds-agent-magicpocket.is-disabled img{filter:grayscale(1) opacity(.7)}
.ds-agent-magicpocket-float img{animation:dsMagicPocketFloat 2.4s ease-in-out infinite}
.ds-agent-magicpocket-sway img{animation:dsMagicPocketSway 2.1s ease-in-out infinite;transform-origin:50% 90%}
.ds-agent-magicpocket-breathe img{animation:dsMagicPocketBreathe 3s ease-in-out infinite}
.ds-agent-magicpocket-bob img{animation:dsMagicPocketBob 2.7s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ds-agent-magicpocket img{animation:none!important}}
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
  general: { src: magicpocketLaptop, anim: 'breathe' },
  explore: { src: magicpocketSearch, anim: 'float' },
  'design-reviewer': { src: magicpocketClip, anim: 'bob' },
  'over-engineering-reviewer': { src: magicpocketWrench, anim: 'sway' },
  'code-review': { src: magicpocketClip, anim: 'breathe' },
  compaction: { src: magicpocketMagic, anim: 'sway' },
  title: { src: magicpocketCheer, anim: 'bob' },
  summary: { src: magicpocketHeadset, anim: 'float' }
}

const FALLBACK: { src: string; anim: Anim } = { src: magicpocketWrench, anim: 'breathe' }

/**
 * @param id      role id (drives the pose); unknown ids → fallback (custom magicpocket)
 * @param disabled when true, renders resting magicpocket in grayscale with no motion
 * @param className sizing wrapper class (e.g. "h-10 w-10")
 */
export function AgentMagicPocket({
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
      <span className={`ds-agent-magicpocket is-disabled ${className ?? ''}`}>
        <img src={magicpocketRest} alt="" aria-hidden="true" />
      </span>
    )
  }
  const pose = POSE[id] ?? FALLBACK
  return (
    <span className={`ds-agent-magicpocket ds-agent-magicpocket-${pose.anim} ${className ?? ''}`}>
      <img src={pose.src} alt="" aria-hidden="true" />
    </span>
  )
}
