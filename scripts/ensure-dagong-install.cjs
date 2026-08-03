const { existsSync, rmSync } = require('node:fs')
const { spawnSync } = require('node:child_process')

const REQUIRED_PATHS = [
  'dagong/package-lock.json',
  'dagong/node_modules/diff/package.json',
  'dagong/node_modules/zod/package.json',
  'dagong/node_modules/@modelcontextprotocol/sdk/package.json'
]
const KUN_SQLITE_MODULE_PATH = 'dagong/node_modules/better-sqlite3'

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

function ensureDagongInstall() {
  if (!REQUIRED_PATHS.every((path) => existsSync(path))) {
    const installDagong = run('npm', ['--prefix', 'dagong', 'ci'])
    if (installDagong.status !== 0) {
      process.exit(installDagong.status || 1)
    }
  }

  if (existsSync(KUN_SQLITE_MODULE_PATH)) {
    rmSync(KUN_SQLITE_MODULE_PATH, { recursive: true, force: true })
    return
  }
}

ensureDagongInstall()
