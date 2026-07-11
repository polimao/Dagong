import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveLogDirectory, resolvePreloadPath } from './main-paths'

describe('main paths', () => {
  it('resolves the log directory under Electron userData', () => {
    expect(resolveLogDirectory({ getPath: () => 'C:\\Users\\test\\AppData\\MagicPocket' })).toBe(
      join('C:\\Users\\test\\AppData\\MagicPocket', 'logs')
    )
  })

  it('prefers the CommonJS preload build when present', () => {
    const distDir = 'C:\\app\\out\\main'

    expect(resolvePreloadPath(distDir, (path) => path.endsWith('index.cjs'))).toBe(
      join(distDir, '../preload/index.cjs')
    )
  })

  it('falls back to the ESM preload build', () => {
    const distDir = 'C:\\app\\out\\main'

    expect(resolvePreloadPath(distDir, () => false)).toBe(
      join(distDir, '../preload/index.mjs')
    )
  })
})
