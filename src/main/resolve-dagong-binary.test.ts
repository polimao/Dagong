import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDagongServeArgs,
  resolveDagongExecutable,
  shouldRunDagongServeAsElectronChild,
  type DagongBinaryResolution
} from './resolve-dagong-binary'

const tempRoots: string[] = []

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dagong-resolver-'))
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

describe('resolveDagongExecutable', () => {
  it('resolves the built Dagong entry from the app root', () => {
    const root = tempRoot()
    const entry = join(root, 'dagong/dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveDagongExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('does not fall back to TypeScript source files that Node cannot execute', () => {
    const root = tempRoot()
    touch(join(root, 'dagong/src/cli/serve-entry.ts'))

    const resolution = resolveDagongExecutable(root, '')

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [join(root, 'dagong/dist/cli/serve-entry.js')],
      dataDir: ''
    })
  })

  it('accepts a Dagong package directory as a custom binary path', () => {
    const root = tempRoot()
    const entry = join(root, 'dist/cli/serve-entry.js')
    touch(entry)

    const resolution = resolveDagongExecutable('/app', root)

    expect(resolution).toEqual({
      kind: 'node-script',
      command: process.execPath,
      args: [entry],
      dataDir: ''
    })
  })

  it('runs a non-JavaScript custom executable directly', () => {
    const resolution = resolveDagongExecutable('/app', '/usr/local/bin/dagong')

    expect(resolution).toEqual({
      kind: 'custom',
      command: '/usr/local/bin/dagong',
      args: [],
      dataDir: ''
    })
  })
})

describe('buildDagongServeArgs', () => {
  it('does not place runtime secrets on the child process argv', () => {
    const resolution: DagongBinaryResolution = {
      kind: 'node-script',
      command: '/usr/bin/node',
      args: ['/app/dagong/dist/cli/serve-entry.js'],
      dataDir: ''
    }

    const args = buildDagongServeArgs({
      resolution,
      host: '127.0.0.1',
      port: 18899,
      dataDir: '/tmp/dagong',
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

describe('shouldRunDagongServeAsElectronChild', () => {
  it('uses the Electron child path only for macOS dev computer-use launches', () => {
    expect(shouldRunDagongServeAsElectronChild({
      platform: 'darwin',
      isPackaged: false,
      computerUseEnabled: true
    })).toBe(true)

    expect(shouldRunDagongServeAsElectronChild({
      platform: 'darwin',
      isPackaged: true,
      computerUseEnabled: true
    })).toBe(false)
  })

  it('keeps the regular Node helper path when computer-use is disabled or off macOS', () => {
    expect(shouldRunDagongServeAsElectronChild({
      platform: 'darwin',
      isPackaged: false,
      computerUseEnabled: false
    })).toBe(false)

    expect(shouldRunDagongServeAsElectronChild({
      platform: 'linux',
      isPackaged: false,
      computerUseEnabled: true
    })).toBe(false)
  })
})
