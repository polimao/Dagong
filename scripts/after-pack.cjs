const { execFileSync } = require('node:child_process')
const { chmodSync, existsSync, readdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const KUN_RUNTIME_REQUIRED_PATHS = [
  'magicpocket/dist/cli/serve-entry.js',
  'magicpocket/package.json',
  'magicpocket/package-lock.json',
  'magicpocket/node_modules/zod/package.json',
  'magicpocket/node_modules/diff/package.json',
  'magicpocket/node_modules/@modelcontextprotocol/sdk/package.json'
]

function normalizePlatform(platform) {
  return platform === 'win' ? 'win32' : platform
}

function appBundlePath(context) {
  return join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
}

function packedResourcesDir(context) {
  if (normalizePlatform(context.electronPlatformName) === 'darwin') {
    return join(appBundlePath(context), 'Contents', 'Resources')
  }
  return join(context.appOutDir, 'resources')
}

function unpackedAppRoot(context) {
  return join(packedResourcesDir(context), 'app.asar.unpacked')
}

function assertExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`[after-pack] Missing ${label}: ${path}`)
  }
}

function npmCommand(args, platform = process.platform) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm', ...args]
    }
  }
  return { command: 'npm', args }
}

function prunePackedMagicPocketDependencies(context) {
  const root = unpackedAppRoot(context)
  const magicpocketDir = join(root, 'magicpocket')
  if (!existsSync(magicpocketDir)) return

  assertExists(join(magicpocketDir, 'package.json'), 'MagicPocket package manifest')
  assertExists(join(magicpocketDir, 'node_modules'), 'MagicPocket node_modules')

  const prune = npmCommand(['prune', '--omit=dev', '--ignore-scripts'])
  execFileSync(prune.command, prune.args, {
    cwd: magicpocketDir,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false'
    },
    stdio: 'inherit'
  })

  // Keep native SQLite on the app root dependency so electron-builder's
  // native-module rebuild owns the target arch and Electron ABI.
  assertExists(
    join(root, 'node_modules', 'better-sqlite3', 'package.json'),
    'root better-sqlite3 dependency'
  )
  rmSync(join(magicpocketDir, 'node_modules', 'better-sqlite3'), { recursive: true, force: true })
}

function validateBundledMagicPocketRuntime(context) {
  const root = unpackedAppRoot(context)
  for (const relativePath of KUN_RUNTIME_REQUIRED_PATHS) {
    assertExists(join(root, relativePath), relativePath)
  }
  assertExists(
    join(root, 'node_modules', 'better-sqlite3', 'package.json'),
    'root better-sqlite3 dependency'
  )
}

function maybeAdhocSignMacApp(context) {
  if (normalizePlatform(context.electronPlatformName) !== 'darwin') {
    return
  }

  if (
    process.env.CSC_LINK ||
    process.env.CSC_NAME ||
    process.env.CSC_KEY_PASSWORD ||
    process.env.MAC_SIGN === '1'
  ) {
    console.log('[after-pack] Developer ID signing is enabled, skipping ad-hoc signing.')
    return
  }

  const appBundle = appBundlePath(context)
  if (!existsSync(appBundle)) {
    throw new Error(`[after-pack] App bundle not found for ad-hoc signing: ${appBundle}`)
  }

  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', appBundle],
    { stdio: 'inherit' }
  )
}

// node-pty execs a bundled `spawn-helper` binary to fork the child shell.
// asar unpacking can drop the executable bit, which makes every PTY spawn
// fail with `posix_spawnp`. Re-chmod every bundled helper after packing so
// the built-in terminal works in the shipped app. Non-fatal: best effort.
function ensureNodePtyHelpersExecutable(context) {
  const root = unpackedAppRoot(context)
  const prebuildsDir = join(root, 'node_modules', 'node-pty', 'prebuilds')
  if (!existsSync(prebuildsDir)) return
  for (const folder of readdirSync(prebuildsDir)) {
    const helper = join(prebuildsDir, folder, 'spawn-helper')
    if (!existsSync(helper)) continue
    try {
      chmodSync(helper, 0o755)
    } catch (error) {
      console.warn(`[after-pack] could not chmod node-pty spawn-helper (${folder}):`, error.message)
    }
  }
}

function normalizeArch(arch) {
  if (arch === 'x64' || arch === 1) return 'x64'
  if (arch === 'arm64' || arch === 3) return 'arm64'
  throw new Error(`[after-pack] Unsupported Whisper runner arch: ${arch}`)
}

function prunePackedWhisperResources(context) {
  const whisperDir = join(packedResourcesDir(context), 'whisper')
  if (!existsSync(whisperDir)) return

  const keep = `${normalizePlatform(context.electronPlatformName)}-${normalizeArch(context.arch)}`
  for (const entry of readdirSync(whisperDir)) {
    if (entry === keep || entry === 'LICENSE.whisper.cpp') continue
    rmSync(join(whisperDir, entry), { recursive: true, force: true })
    console.log(`[after-pack] Removed non-target Whisper resource: ${entry}`)
  }
}

async function afterPack(context) {
  prunePackedMagicPocketDependencies(context)
  validateBundledMagicPocketRuntime(context)
  prunePackedWhisperResources(context)
  ensureNodePtyHelpersExecutable(context)
  maybeAdhocSignMacApp(context)
}

exports.KUN_RUNTIME_REQUIRED_PATHS = KUN_RUNTIME_REQUIRED_PATHS
exports._internals = {
  appBundlePath,
  packedResourcesDir,
  unpackedAppRoot,
  npmCommand,
  prunePackedMagicPocketDependencies,
  validateBundledMagicPocketRuntime,
  normalizeArch,
  prunePackedWhisperResources,
  ensureNodePtyHelpersExecutable
}
exports.default = afterPack
