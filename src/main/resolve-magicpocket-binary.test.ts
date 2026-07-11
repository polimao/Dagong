import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildMagicPocketServeArgs,
  resolveMagicPocketExecutable,
  shouldRunMagicPocketServeAsElectronChild,
  type MagicPocketBinaryResolution
} from './resolve-magicpocket-binary'

const tempRoots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'magicpocket-resolver-'))
  tempRoots.push(root)
  return root
}

function touch(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, '', 'utf8')
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('resolveMagicPocketExecutable', () => {
  it('resolves the built MagicPocket entry from the app root', () => {
    const root = tempRoot()
    const entry = join(root, 'magicpocket/dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveMagicPocketExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('does not fall back to TypeScript source files that Node cannot execute', () => {
    const root = tempRoot()
    touch(join(root, 'magicpocket/src/cli/serve-entry.ts'))

    const resolution = resolveMagicPocketExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [join(root, 'magicpocket/dist/cli/serve-entry.js')],
      dataDir: ''
    })
  })

  it('accepts a MagicPocket package directory as a custom binary path', () => {
    const root = tempRoot()
    const entry = join(root, 'dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveMagicPocketExecutable('/app', root)

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('runs a non-JavaScript custom executable directly', () => {
    const resolution = resolveMagicPocketExecutable('/app', '/usr/local/bin/magicpocket')

    expect(resolution).toEqual({
      kind: 'custom',
      command: '/usr/local/bin/magicpocket',
      args: [],
      dataDir: ''
    })
  })
})

describe('buildMagicPocketServeArgs', () => {
  it('does not place runtime secrets on the child process argv', () => {
    const resolution: MagicPocketBinaryResolution = {
      kind: 'node-script',
      command: '/usr/bin/node',
      args: ['/app/magicpocket/dist/cli/serve-entry.js'],
      dataDir: ''
    }

    const args = buildMagicPocketServeArgs({
      resolution,
      host: '127.0.0.1',
      port: 18899,
      dataDir: '/tmp/magicpocket',
      baseUrl: 'https://api.deepseek.com/beta',
      endpointFormat: 'responses',
      model: 'deepseek-chat',
      approvalPolicy: 'on-request',
      sandboxMode: 'workspace-write',
      tokenEconomyMode: false,
      insecure: false
    })

    expect(args).not.toContain('--api-key')
    expect(args).not.toContain('--runtime-token')
    expect(args).toContain('--endpoint-format')
    expect(args).toContain('responses')
    expect(args).toContain('--token-economy-mode')
    expect(args).toContain('false')
  })
})

describe('shouldRunMagicPocketServeAsElectronChild', () => {
  it('uses the Electron child path only for macOS dev computer-use launches', () => {
    expect(shouldRunMagicPocketServeAsElectronChild({
      platform: 'darwin',
      isPackaged: false,
      computerUseEnabled: true
    })).toBe(true)

    expect(shouldRunMagicPocketServeAsElectronChild({
      platform: 'darwin',
      isPackaged: true,
      computerUseEnabled: true
    })).toBe(false)
  })

  it('keeps the regular Node helper path when computer-use is disabled or off macOS', () => {
    expect(shouldRunMagicPocketServeAsElectronChild({
      platform: 'darwin',
      isPackaged: false,
      computerUseEnabled: false
    })).toBe(false)

    expect(shouldRunMagicPocketServeAsElectronChild({
      platform: 'linux',
      isPackaged: false,
      computerUseEnabled: true
    })).toBe(false)
  })
})
