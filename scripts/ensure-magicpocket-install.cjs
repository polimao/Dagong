const { existsSync, rmSync } = require('node:fs')
const { spawnSync } = require('node:child_process')

const REQUIRED_PATHS = [
  'magicpocket/package-lock.json',
  'magicpocket/node_modules/diff/package.json',
  'magicpocket/node_modules/zod/package.json',
  'magicpocket/node_modules/@modelcontextprotocol/sdk/package.json'
]
const KUN_SQLITE_MODULE_PATH = 'magicpocket/node_modules/better-sqlite3'

function run(command, args) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false'
    }
  })
}

function ensureMagicPocketInstall() {
  if (!REQUIRED_PATHS.every((path) => existsSync(path))) {
    const installMagicPocket = run('npm', ['--prefix', 'magicpocket', 'ci'])
    if (installMagicPocket.status !== 0) {
      process.exit(installMagicPocket.status || 1)
    }
  }

  if (existsSync(KUN_SQLITE_MODULE_PATH)) {
    rmSync(KUN_SQLITE_MODULE_PATH, { recursive: true, force: true })
    return
  }
}

ensureMagicPocketInstall()
