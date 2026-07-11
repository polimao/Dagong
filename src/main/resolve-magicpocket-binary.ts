import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Resolve the MagicPocket executable. MagicPocket ships as a TypeScript
 * package inside the MagicPocket workspace (`magicpocket/`) and is
 * executed through the bundled Node.js runtime that Electron carries.
 *
 * Resolution order:
 * 1. User-supplied binary path (treated as a JS module when it ends
 *    in `.js` or is a directory containing `dist/cli/serve-entry.js`).
 * 2. Bundled `magicpocket/dist/cli/serve-entry.js` (built by the root
 *    `build:magicpocket` script before dev, build, install, and packaging).
 *
 * The resolver never throws on missing artifacts during the user
 * typing flow: it returns the bundled dist path even when the file
 * does not exist yet, and the calling layer is responsible for
 * surfacing a clear "runtime not built" diagnostic.
 */
export type MagicPocketBinaryResolution =
  | { kind: 'node-script'; command: string; args: string[]; dataDir: string }
  | { kind: 'custom'; command: string; args: string[]; dataDir: string }

export function shouldRunMagicPocketServeAsElectronChild(input: {
  platform: NodeJS.Platform
  isPackaged: boolean
  computerUseEnabled: boolean
}): boolean {
  return input.platform === 'darwin' && input.computerUseEnabled && !input.isPackaged
}

const DIST_ENTRY_CANDIDATES = [
  'magicpocket/dist/cli/serve-entry.js',
  'magicpocket/dist/cli/serve.js'
]

function exists(path: string): boolean {
  try {
    return existsSync(path)
  } catch {
    return false
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isNodeScript(path: string): boolean {
  return /\.(?:cjs|mjs|js)$/i.test(path)
}

export function resolveMagicPocketExecutable(
  appRoot: string,
  userBinaryPath: string
): MagicPocketBinaryResolution {
  const trimmed = userBinaryPath?.trim() ?? ''
  if (trimmed) {
    if (isDirectory(trimmed)) {
      const entry = join(trimmed, 'dist/cli/serve-entry.js')
      return {
        kind: 'node-script',
        command: process.execPath,
        args: [entry],
        dataDir: ''
      }
    }
    if (isNodeScript(trimmed)) {
      return {
        kind: 'node-script',
        command: process.execPath,
        args: [trimmed],
        dataDir: ''
      }
    }
    return {
      kind: 'custom',
      command: trimmed,
      args: [],
      dataDir: ''
    }
  }
  for (const candidate of DIST_ENTRY_CANDIDATES) {
    const full = join(appRoot, candidate)
    if (exists(full)) {
      return {
        kind: 'node-script',
        command: process.execPath,
        args: [full],
        dataDir: ''
      }
    }
  }
  return {
    kind: 'node-script',
    command: process.execPath,
    args: [join(appRoot, DIST_ENTRY_CANDIDATES[0])],
    dataDir: ''
  }
}

/**
 * Build the full `magicpocket serve` argv from resolved binary info
 * and MagicPocket runtime settings. The function is pure: no I/O, no
 * side effects, easy to test.
 */
export function buildMagicPocketServeArgs(input: {
  resolution: MagicPocketBinaryResolution
  host: string
  port: number
  dataDir: string
  baseUrl?: string
  modelProxyUrl?: string
  endpointFormat?: string
  model: string
  approvalPolicy: string
  sandboxMode: string
  tokenEconomyMode: boolean
  insecure: boolean
}): string[] {
  return [
    ...input.resolution.args,
    '--host',
    input.host,
    '--port',
    String(input.port),
    '--data-dir',
    input.dataDir,
    ...(input.baseUrl ? ['--base-url', input.baseUrl] : []),
    ...(input.modelProxyUrl ? ['--model-proxy-url', input.modelProxyUrl] : []),
    ...(input.endpointFormat ? ['--endpoint-format', input.endpointFormat] : []),
    '--model',
    input.model,
    '--approval-policy',
    input.approvalPolicy,
    '--sandbox-mode',
    input.sandboxMode,
    '--token-economy-mode',
    input.tokenEconomyMode ? 'true' : 'false',
    ...(input.insecure ? ['--insecure'] : [])
  ]
}
