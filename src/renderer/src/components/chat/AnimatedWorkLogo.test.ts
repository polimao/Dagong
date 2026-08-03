import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveUiPluginFigure } from '@shared/ui-plugin'
import { useUiPluginStore } from '../../store/ui-plugin-store'
import {
  AnimatedWorkLogo,
  IKUN_CAMEO_DURATIONS_MS,
  IKUN_CAMEO_TYPES,
  IdagongCameo,
  IKUN_WORK_LOGO_VARIANTS,
  IKUN_WORK_LOGO_VARIANT_LABEL_KEYS,
  KUN_CELEBRATION_DURATIONS_MS,
  KUN_CELEBRATION_VARIANTS,
  DagongCelebration,
  DagongStateFigure,
  SidebarMascot,
  UI_PLUGIN_CAMEO_SLOTS,
  UI_PLUGIN_CELEBRATION_SLOTS,
  UI_PLUGIN_STATE_SLOTS,
  WORK_LOGO_SWIM_MODES,
  WORK_LOGO_SWIM_MODE_LABEL_KEYS,
  pickIdagongCameo,
  pickDagongCelebration
} from './AnimatedWorkLogo'
import { WorkMetaRow } from './message-timeline-cards'

describe('AnimatedWorkLogo', () => {
  it('ships the Dagong bird asset used as the default work mark', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const birdFigure = await readFile(new URL('../../../../asset/img/dagong_bird.png', import.meta.url))

    expect(pngDimensions(birdFigure)).toEqual({ width: 751, height: 512 })
  })

  it('renders layered logo markup for swim animation', () => {
    const html = renderToStaticMarkup(
      createElement(AnimatedWorkLogo, { active: true, className: 'extra-class', size: 'md' })
    )

    expect(html).toContain('ds-work-logo')
    expect(html).toContain('ds-work-logo-md')
    expect(html).toContain('ds-work-logo-phase-lead')
    expect(html).toContain('is-active')
    expect(html).toContain('extra-class')
    expect(html).toContain('ds-work-logo-gust')
    expect(html).toContain('ds-work-logo-current')
    expect(html).toContain('ds-work-logo-swell')
    expect(html).toContain('ds-work-logo-wave-back')
    expect(html).toContain('ds-work-logo-ripple')
    expect(html).toContain('ds-work-logo-wave-front')
    expect(html).toContain('ds-work-logo-breaker')
    expect(html).toContain('ds-work-logo-wake')
    expect(html).toContain('ds-work-logo-foam')
    expect(html).toContain('ds-work-logo-crest')
    expect(html).toContain('ds-work-logo-splash')
    expect(html).toContain('ds-work-logo-spray')
    expect(html).toContain('ds-work-logo-bubbles')
    expect(html).toContain('ds-work-logo-echo')
    expect(html).toContain('ds-work-logo-track')
    expect(html).toContain('ds-work-logo-body')
    expect(html).toContain('ds-work-logo-image')
    expect(html).toContain('ds-idagong-logo')
    expect(html).toContain('ds-idagong-figure')
    expect(html).toMatch(/ds-idagong-logo-(dribble|run|boba)/)
    expect(html).toMatch(/ds-work-logo-mode-(propel|sprint|dive|surf)/)
  })

  it('renders the state figures with their kind classes', () => {
    for (const kind of ['greet', 'sleep', 'sit'] as const) {
      const html = renderToStaticMarkup(createElement(DagongStateFigure, { kind }))
      expect(html).toContain(`ds-dagong-state-${kind}`)
      expect(html).toContain('ds-dagong-state-figure')
      expect(html).toContain('ds-idagong-state-figure')
    }
  })

  describe('UI plugin slot fallback chains', () => {
    const figures = {
      swim: 'data:image/png;base64,SWIM',
      greet: 'data:image/png;base64,GREET'
    }

    it('every surface chain ends at swim so partial skins always resolve', () => {
      const chains = [
        ...Object.values(UI_PLUGIN_STATE_SLOTS),
        ...Object.values(UI_PLUGIN_CAMEO_SLOTS),
        ...Object.values(UI_PLUGIN_CELEBRATION_SLOTS)
      ]
      for (const chain of chains) {
        expect(chain[chain.length - 1]).toBe('swim')
      }
    })

    it('resolves missing slots through the chains', () => {
      expect(resolveUiPluginFigure(figures, UI_PLUGIN_STATE_SLOTS.greet)).toBe(figures.greet)
      // sleep 槽位缺失 → 回退链最终落到 swim
      expect(resolveUiPluginFigure(figures, UI_PLUGIN_STATE_SLOTS.sleep)).toBe(figures.swim)
      expect(resolveUiPluginFigure(figures, UI_PLUGIN_CAMEO_SLOTS.dash)).toBe(figures.swim)
      expect(resolveUiPluginFigure(figures, UI_PLUGIN_CELEBRATION_SLOTS.cheer)).toBe(figures.greet)
      expect(resolveUiPluginFigure(null, UI_PLUGIN_STATE_SLOTS.greet)).toBeNull()
    })

    it('keeps default art when no plugin is active', () => {
      expect(useUiPluginStore.getState().activeRuntime).toBeNull()
      const html = renderToStaticMarkup(createElement(DagongStateFigure, { kind: 'greet' }))
      expect(html).not.toContain('data:image')
      expect(html).toContain('ds-dagong-state-figure')
    })
  })

  it('pins the swim mode when one is provided', () => {
    const html = renderToStaticMarkup(
      createElement(AnimatedWorkLogo, { active: true, mode: 'dive' })
    )

    expect(html).toContain('ds-work-logo-mode-dive')
  })

  it('pins the idagong variant when one is provided', () => {
    const html = renderToStaticMarkup(
      createElement(AnimatedWorkLogo, { active: true, idagongVariant: 'boba' })
    )

    expect(html).toContain('ds-idagong-logo-boba')
  })

  it('renders the sidebar mascot with a state figure', () => {
    const html = renderToStaticMarkup(createElement(SidebarMascot))

    expect(html).toContain('ds-sidebar-mascot')
    expect(html).toMatch(/ds-dagong-state-(sit|greet|sleep)/)
  })

  it('renders every idagong cameo type with side classes', () => {
    for (const type of ['dash', 'peek', 'boba', 'nap'] as const) {
      const html = renderToStaticMarkup(createElement(IdagongCameo, { cameo: { type, side: 'left' } }))
      expect(html).toContain(`ds-idagong-cameo-${type}`)
      expect(html).toContain('is-left')
      expect(html).toContain('ds-idagong-cameo-figure')
    }

    const chaseHtml = renderToStaticMarkup(
      createElement(IdagongCameo, { cameo: { type: 'chase', side: 'right' } })
    )
    expect(chaseHtml.match(/ds-idagong-cameo-dash/g)?.length).toBe(2)
    expect(chaseHtml).toContain('is-second')
  })

  it('renders every celebration variant with dual figures and confetti', () => {
    for (const variant of KUN_CELEBRATION_VARIANTS) {
      const html = renderToStaticMarkup(createElement(DagongCelebration, { variant }))
      expect(html).toContain(`ds-dagong-celebration-${variant}`)
      expect(html).toContain('is-dagong')
      expect(html).toContain('is-idagong')
      expect(html).toContain('ds-dagong-confetti')
      expect(html.match(/<i><\/i>/g)?.length).toBe(10)
      expect(KUN_CELEBRATION_DURATIONS_MS[variant]).toBeGreaterThan(0)
    }
  })

  it('picks valid celebration variants with increasing ids', () => {
    const first = pickDagongCelebration()
    const second = pickDagongCelebration()

    expect(KUN_CELEBRATION_VARIANTS).toContain(first.variant)
    expect(second.id).toBeGreaterThan(first.id)
  })

  it('picks valid cameo specs with increasing ids and complete durations', () => {
    const first = pickIdagongCameo()
    const second = pickIdagongCameo()

    expect(IKUN_CAMEO_TYPES).toContain(first.type)
    expect(['left', 'right']).toContain(first.side)
    expect(second.id).toBeGreaterThan(first.id)

    for (const type of IKUN_CAMEO_TYPES) {
      expect(IKUN_CAMEO_DURATIONS_MS[type]).toBeGreaterThan(0)
    }
  })

  it('maps every swim mode and idagong variant to a status label key in both locales', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const zh = JSON.parse(await readFile(new URL('../../locales/zh/common.json', import.meta.url), 'utf8'))
    const en = JSON.parse(await readFile(new URL('../../locales/en/common.json', import.meta.url), 'utf8'))

    for (const swimMode of WORK_LOGO_SWIM_MODES) {
      const labelKey = WORK_LOGO_SWIM_MODE_LABEL_KEYS[swimMode]
      expect(labelKey).toBeTruthy()
      expect(zh[labelKey]).toBeTruthy()
      expect(en[labelKey]).toBeTruthy()
    }

    for (const variant of IKUN_WORK_LOGO_VARIANTS) {
      const labelKey = IKUN_WORK_LOGO_VARIANT_LABEL_KEYS[variant]
      expect(labelKey).toBeTruthy()
      expect(zh[labelKey]).toBeTruthy()
      expect(en[labelKey]).toBeTruthy()
    }
  })

  it('defaults to a static logo unless active', () => {
    const html = renderToStaticMarkup(createElement(AnimatedWorkLogo))

    expect(html).toContain('ds-work-logo')
    expect(html).toContain('ds-work-logo-phase-lead')
    expect(html).not.toContain('is-active')
  })

  it('keeps wave and splash layers mounted in static state to avoid layout churn', () => {
    const html = renderToStaticMarkup(createElement(AnimatedWorkLogo, { size: 'sm' }))

    expect(html).toContain('ds-work-logo-sm')
    expect(html).toContain('ds-work-logo-gust')
    expect(html).toContain('ds-work-logo-swell')
    expect(html).toContain('ds-work-logo-wave-back')
    expect(html).toContain('ds-work-logo-wave-front')
    expect(html).toContain('ds-work-logo-breaker')
    expect(html).toContain('ds-work-logo-foam')
    expect(html).toContain('ds-work-logo-crest')
    expect(html).toContain('ds-work-logo-splash')
    expect(html).toContain('ds-work-logo-spray')
    expect(html).not.toContain('is-active')
  })

  it('can render a desynchronized trailing phase', () => {
    const html = renderToStaticMarkup(createElement(AnimatedWorkLogo, { active: true, phase: 'trail' }))

    expect(html).toContain('is-active')
    expect(html).toContain('ds-work-logo-phase-trail')
  })

  it('keeps the processing work row as text-only status', () => {
    const html = renderToStaticMarkup(
      createElement(WorkMetaRow, {
        processing: true,
        stepCount: 3,
        expanded: true,
        onToggle: () => undefined
      })
    )

    expect(html).toContain('ds-shiny-text')
    expect(html).not.toContain('ds-work-logo-slot')
  })

  it('keeps the swim animation layers wired in CSS', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const baseShellCss = await readFile(new URL('../../styles/base-shell.css', import.meta.url), 'utf8')

    for (const layer of [
      'gust',
      'swell',
      'wave-front',
      'breaker',
      'wake',
      'foam',
      'waterline',
      'crest',
      'splash',
      'spray',
      'bubbles'
    ]) {
      expect(baseShellCss).toContain(`ds-work-logo-${layer}`)
    }

    expect(baseShellCss).toContain('.ds-work-logo.is-active .ds-work-logo-body::after')
    expect(baseShellCss).toContain('@keyframes ds-work-logo-waterline')
    expect(baseShellCss).not.toContain('ds-work-logo-tail')
    expect(baseShellCss).not.toContain('transform: translateZ(0) scaleX(-1)')
    expect(baseShellCss).toContain('.ds-work-logo.ds-work-logo-mode-sprint')
    expect(baseShellCss).toContain('.ds-work-logo.ds-work-logo-mode-dive')
    expect(baseShellCss).toContain('.ds-work-logo.ds-work-logo-mode-surf')
    expect(baseShellCss).toContain('@keyframes ds-work-logo-sprint-path')
    expect(baseShellCss).toContain('@keyframes ds-work-logo-dive-path')
    expect(baseShellCss).toContain('@keyframes ds-work-logo-dive-figure')
    expect(baseShellCss).toContain('@keyframes ds-work-logo-surf-path')
    expect(baseShellCss).toContain('@keyframes ds-dagong-greet-wave')
    expect(baseShellCss).toContain('@keyframes ds-dagong-sleep-breathe')
    expect(baseShellCss).toContain('@keyframes ds-dagong-sit-sway')
    expect(baseShellCss).toContain('.ds-work-logo:hover')
    expect(baseShellCss).toContain('.ds-dagong-state:hover')
    expect(baseShellCss).toContain("[data-idagong-mode='on'] .ds-work-logo .ds-idagong-logo")
    expect(baseShellCss).toContain("[data-idagong-mode='on'] {")
    expect(baseShellCss).toContain("[data-theme='dark'][data-idagong-mode='on'],")
    expect(baseShellCss).toContain("[data-theme='dark'][data-idagong-mode='on'] .ds-workbench-shell")
    expect(baseShellCss).toContain('@keyframes ds-idagong-dribble')
    expect(baseShellCss).toContain('@keyframes ds-idagong-run')
    expect(baseShellCss).toContain('@keyframes ds-idagong-boba')
    expect(baseShellCss).toContain('.ds-idagong-cameo-layer')
    expect(baseShellCss).toContain('@keyframes ds-idagong-cameo-cross')
    expect(baseShellCss).toContain('@keyframes ds-idagong-cameo-peek')
    expect(baseShellCss).toContain('@keyframes ds-idagong-cameo-rise')
    expect(baseShellCss).toContain('@keyframes ds-idagong-cameo-doze')
    expect(baseShellCss).toContain('.ds-dagong-celebration-layer')
    expect(baseShellCss).toContain('@keyframes ds-dagong-celebrate-cheer')
    expect(baseShellCss).toContain('@keyframes ds-dagong-celebrate-lap')
    expect(baseShellCss).toContain('@keyframes ds-dagong-celebrate-toast')
    expect(baseShellCss).toContain('@keyframes ds-dagong-confetti-burst')
    expect(baseShellCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(baseShellCss).toContain("[data-focus-mode='on'] .ds-idagong-cameo-layer")
    expect(baseShellCss).toContain("[data-focus-mode='on'] .ds-dagong-celebration-layer")
    expect(baseShellCss).toContain("[data-focus-mode='on'] .ds-dagong-state")
    expect(baseShellCss).toContain("[data-focus-mode='on'] .ds-work-logo")
    expect(baseShellCss).toContain("[data-focus-mode='on'] .ds-work-logo-slot:has(.ds-work-logo)")
    expect(baseShellCss).toContain('display: none !important;')
    expect(baseShellCss).not.toContain("[data-focus-mode='on'] .ds-shiny-text")
    expect(baseShellCss).not.toContain("[data-focus-mode='on'] .ds-runtime-wake-shell::before")
  })

  it('keeps generated Dagong PNG icon dimensions stable for packaging', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const appIcon = await readFile(new URL('../../../../asset/img/dagong.png', import.meta.url))
    const macIcon = await readFile(new URL('../../../../asset/img/dagong_mac.png', import.meta.url))
    const trayIcon = await readFile(new URL('../../../../asset/img/dagong_tray.png', import.meta.url))

    expect(pngDimensions(appIcon)).toEqual({ width: 1254, height: 1254 })
    expect(pngDimensions(macIcon)).toEqual({ width: 1024, height: 1024 })
    expect(pngDimensions(trayIcon)).toEqual({ width: 954, height: 994 })
  })

  it('ships the iDagong figure asset used by idagong mode', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const idagongFigure = await readFile(new URL('../../../../asset/img/idagong.png', import.meta.url))

    expect(pngDimensions(idagongFigure)).toEqual({ width: 512, height: 512 })
  })

  it('ships the Dagong state figure assets', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const expected: Record<string, { width: number; height: number }> = {
      dagong_greet: { width: 512, height: 460 },
      dagong_sleep: { width: 512, height: 390 },
      dagong_surf: { width: 512, height: 479 },
      dagong_sit: { width: 512, height: 493 }
    }

    for (const [name, dimensions] of Object.entries(expected)) {
      const figure = await readFile(new URL(`../../../../asset/img/${name}.png`, import.meta.url))
      expect(pngDimensions(figure)).toEqual(dimensions)
    }
  })

  it('ships the iDagong state and variant figure assets', async () => {
    const nodeFs = 'node:fs/promises'
    const { readFile } = await import(/* @vite-ignore */ nodeFs)
    const expected: Record<string, { width: number; height: number }> = {
      idagong_sleep: { width: 455, height: 512 },
      idagong_boba: { width: 422, height: 512 },
      idagong_run: { width: 378, height: 512 },
      idagong_wave: { width: 435, height: 512 },
      idagong_stand: { width: 368, height: 512 }
    }

    for (const [name, dimensions] of Object.entries(expected)) {
      const figure = await readFile(new URL(`../../../../asset/img/${name}.png`, import.meta.url))
      expect(pngDimensions(figure)).toEqual(dimensions)
    }
  })
})

function pngDimensions(buffer: Uint8Array): { width: number; height: number } {
  const signature = [...buffer.slice(0, 8)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  expect(signature).toBe('89504e470d0a1a0a')
  return {
    width: readUint32BE(buffer, 16),
    height: readUint32BE(buffer, 20)
  }
}

function readUint32BE(buffer: Uint8Array, offset: number): number {
  return (
    buffer[offset] * 16_777_216 +
    buffer[offset + 1] * 65_536 +
    buffer[offset + 2] * 256 +
    buffer[offset + 3]
  )
}
