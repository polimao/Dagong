import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  HOME_DATA_MIGRATION_MAPPINGS,
  migrateLegacyHomeDataDirs,
  migrateLegacyUserDataDir,
  rewriteLegacyPathsInSettingsFile,
  runLegacyDagongDataMigration,
  USER_DATA_MIGRATION_MARKER
} from './legacy-data-migration'

const tempRoots: string[] = []

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dagong-migration-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root) await rm(root, { recursive: true, force: true })
  }
})

async function isSymlinkTo(path: string, target: string): Promise<boolean> {
  const stats = await lstat(path)
  if (!stats.isSymbolicLink()) return false
  return (await readlink(path)) === target
}

describe('migrateLegacyUserDataDir', () => {
  it('renames the legacy dir to the new name and leaves a compatibility link', async () => {
    const appData = await makeTempRoot()
    const legacy = join(appData, 'DeepSeek GUI')
    await mkdir(join(legacy, 'Local Storage'), { recursive: true })
    await writeFile(join(legacy, 'deepseek-gui-settings.json'), '{"version":1}', 'utf8')

    const result = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })

    expect(result).toEqual({ userDataPath: join(appData, 'Dagong'), migrated: true, usedLegacyFallback: false })
    expect(await readFile(join(appData, 'Dagong', 'deepseek-gui-settings.json'), 'utf8')).toBe('{"version":1}')
    expect(await isSymlinkTo(legacy, join(appData, 'Dagong'))).toBe(true)
    const marker = JSON.parse(await readFile(join(appData, 'Dagong', USER_DATA_MIGRATION_MARKER), 'utf8'))
    expect(marker.from).toBe(legacy)
  })

  it('prefers the newer legacy name and leaves the ancient one untouched', async () => {
    const appData = await makeTempRoot()
    await mkdir(join(appData, 'DeepSeek GUI'), { recursive: true })
    await writeFile(join(appData, 'DeepSeek GUI', 'a.txt'), 'recent', 'utf8')
    await mkdir(join(appData, 'deepseek-gui'), { recursive: true })
    await writeFile(join(appData, 'deepseek-gui', 'a.txt'), 'ancient', 'utf8')

    const result = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })

    expect(result.migrated).toBe(true)
    expect(await readFile(join(appData, 'Dagong', 'a.txt'), 'utf8')).toBe('recent')
    expect((await lstat(join(appData, 'deepseek-gui'))).isDirectory()).toBe(true)
    expect((await lstat(join(appData, 'deepseek-gui'))).isSymbolicLink()).toBe(false)
  })

  it('keeps an existing non-empty new dir and does not touch legacy data', async () => {
    const appData = await makeTempRoot()
    await mkdir(join(appData, 'Dagong'), { recursive: true })
    await writeFile(join(appData, 'Dagong', 'dagong-settings.json'), '{}', 'utf8')
    await mkdir(join(appData, 'DeepSeek GUI'), { recursive: true })

    const result = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })

    expect(result).toEqual({ userDataPath: join(appData, 'Dagong'), migrated: false, usedLegacyFallback: false })
    expect((await lstat(join(appData, 'DeepSeek GUI'))).isDirectory()).toBe(true)
  })

  it('replaces an empty new dir left behind by a previous run', async () => {
    const appData = await makeTempRoot()
    await mkdir(join(appData, 'Dagong'), { recursive: true })
    const legacy = join(appData, 'DeepSeek GUI')
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'a.txt'), 'data', 'utf8')

    const result = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })

    expect(result.migrated).toBe(true)
    expect(await readFile(join(appData, 'Dagong', 'a.txt'), 'utf8')).toBe('data')
  })

  it('is a no-op on fresh installs', async () => {
    const appData = await makeTempRoot()
    const result = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })
    expect(result).toEqual({ userDataPath: join(appData, 'Dagong'), migrated: false, usedLegacyFallback: false })
  })

  it('does not migrate twice once the legacy path is a link', async () => {
    const appData = await makeTempRoot()
    const legacy = join(appData, 'DeepSeek GUI')
    await mkdir(legacy, { recursive: true })
    await writeFile(join(legacy, 'a.txt'), 'data', 'utf8')

    const first = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })
    expect(first.migrated).toBe(true)
    const second = migrateLegacyUserDataDir({ userDataPath: join(appData, 'Dagong') })
    expect(second.migrated).toBe(false)
    expect(second.userDataPath).toBe(join(appData, 'Dagong'))
  })
})

describe('migrateLegacyHomeDataDirs', () => {
  it('moves all known legacy dirs under ~/.dagong and links the old locations', async () => {
    const home = await makeTempRoot()
    for (const child of ['dagong', 'default_workspace', 'claw', 'write_workspace']) {
      await mkdir(join(home, '.deepseekgui', child), { recursive: true })
      await writeFile(join(home, '.deepseekgui', child, 'marker.txt'), child, 'utf8')
    }

    const results = migrateLegacyHomeDataDirs({ homeDir: home })

    expect(results.map((r) => r.outcome)).toEqual(['migrated', 'migrated', 'migrated', 'migrated'])
    expect(await readFile(join(home, '.dagong', 'data', 'marker.txt'), 'utf8')).toBe('dagong')
    expect(await readFile(join(home, '.dagong', 'claw', 'marker.txt'), 'utf8')).toBe('claw')
    expect(await isSymlinkTo(join(home, '.deepseekgui', 'dagong'), join(home, '.dagong', 'data'))).toBe(true)
    expect(await isSymlinkTo(join(home, '.deepseekgui', 'claw'), join(home, '.dagong', 'claw'))).toBe(true)
    // 旧路径透过链接仍然可读(老版本回滚、sqlite 里的旧绝对路径都靠它)。
    expect(await readFile(join(home, '.deepseekgui', 'dagong', 'marker.txt'), 'utf8')).toBe('dagong')
    expect(await readFile(join(home, '.deepseekgui', 'MIGRATED.txt'), 'utf8')).toContain('.dagong')
  })

  it('merges into an existing ~/.dagong without touching its other children', async () => {
    const home = await makeTempRoot()
    await mkdir(join(home, '.dagong', 'skills'), { recursive: true })
    await writeFile(join(home, '.dagong', 'config.toml'), 'x = 1', 'utf8')
    await mkdir(join(home, '.deepseekgui', 'dagong'), { recursive: true })
    await writeFile(join(home, '.deepseekgui', 'dagong', 'db.sqlite'), 'db', 'utf8')

    const results = migrateLegacyHomeDataDirs({ homeDir: home })

    const dagongMapping = results.find((r) => r.nextPath === join(home, '.dagong', 'data'))
    expect(dagongMapping?.outcome).toBe('migrated')
    expect(await readFile(join(home, '.dagong', 'data', 'db.sqlite'), 'utf8')).toBe('db')
    expect(await readFile(join(home, '.dagong', 'config.toml'), 'utf8')).toBe('x = 1')
  })

  it('leaves both dirs alone when old and new both contain data', async () => {
    const home = await makeTempRoot()
    await mkdir(join(home, '.deepseekgui', 'claw'), { recursive: true })
    await writeFile(join(home, '.deepseekgui', 'claw', 'old.txt'), 'old', 'utf8')
    await mkdir(join(home, '.dagong', 'claw'), { recursive: true })
    await writeFile(join(home, '.dagong', 'claw', 'new.txt'), 'new', 'utf8')

    const results = migrateLegacyHomeDataDirs({ homeDir: home })

    const clawMapping = results.find((r) => r.nextPath === join(home, '.dagong', 'claw'))
    expect(clawMapping?.outcome).toBe('next-exists')
    expect(clawMapping?.rewriteSafe).toBe(false)
    expect(await readFile(join(home, '.deepseekgui', 'claw', 'old.txt'), 'utf8')).toBe('old')
    expect(await readFile(join(home, '.dagong', 'claw', 'new.txt'), 'utf8')).toBe('new')
  })

  it('replaces an empty new home dir with migrated legacy data', async () => {
    const home = await makeTempRoot()
    await mkdir(join(home, '.deepseekgui', 'dagong'), { recursive: true })
    await writeFile(join(home, '.deepseekgui', 'dagong', 'db.sqlite'), 'db', 'utf8')
    await mkdir(join(home, '.dagong', 'data'), { recursive: true })

    const results = migrateLegacyHomeDataDirs({ homeDir: home })

    const dagongMapping = results.find((r) => r.nextPath === join(home, '.dagong', 'data'))
    expect(dagongMapping?.outcome).toBe('migrated')
    expect(dagongMapping?.rewriteSafe).toBe(true)
    expect(await readFile(join(home, '.dagong', 'data', 'db.sqlite'), 'utf8')).toBe('db')
    expect(await isSymlinkTo(join(home, '.deepseekgui', 'dagong'), join(home, '.dagong', 'data'))).toBe(true)
  })

  it('reports missing legacy dirs as rewrite-safe no-ops', async () => {
    const home = await makeTempRoot()
    const results = migrateLegacyHomeDataDirs({ homeDir: home })
    expect(results.every((r) => r.outcome === 'skipped-missing' && r.rewriteSafe)).toBe(true)
  })
})

describe('rewriteLegacyPathsInSettingsFile', () => {
  it('rewrites absolute and tilde paths only for the given mappings', async () => {
    const home = await makeTempRoot()
    const userData = join(home, 'userData')
    await mkdir(userData, { recursive: true })
    const settings = {
      workspaceRoot: join(home, '.deepseekgui', 'default_workspace'),
      agents: { dagong: { dataDir: '~/.deepseekgui/dagong' } },
      write: {
        workspaces: [
          join(home, '.deepseekgui', 'write_workspace'),
          join(home, '.deepseekgui', 'custom_dir')
        ]
      },
      claw: {
        channels: [
          { workspaceRoot: join(home, '.deepseekgui', 'claw', 'feishu', 'app1') }
        ]
      },
      codePromptPrefix: 'mentions /.deepseekgui/dagong casually',
      disabledSkillIds: [],
    }
    await writeFile(join(userData, 'deepseek-gui-settings.json'), JSON.stringify(settings), 'utf8')

    const rewritten = rewriteLegacyPathsInSettingsFile({
      userDataPath: userData,
      homeDir: home,
      mappings: HOME_DATA_MIGRATION_MAPPINGS.filter(
        (m) => m.legacySegments[1] !== 'write_workspace'
      )
    })

    expect(rewritten).toBe(true)
    const updated = JSON.parse(await readFile(join(userData, 'deepseek-gui-settings.json'), 'utf8'))
    expect(updated.workspaceRoot).toBe(join(home, '.dagong', 'default_workspace'))
    expect(updated.agents.dagong.dataDir).toBe('~/.dagong/data')
    expect(updated.claw.channels[0].workspaceRoot).toBe(join(home, '.dagong', 'claw', 'feishu', 'app1'))
    // write_workspace 映射没有传入 → 不重写;未知子目录永远不重写。
    expect(updated.write.workspaces[0]).toBe(join(home, '.deepseekgui', 'write_workspace'))
    expect(updated.write.workspaces[1]).toBe(join(home, '.deepseekgui', 'custom_dir'))
    // 非路径文本(前缀不是完整映射路径)不受影响。
    expect(updated.codePromptPrefix).toBe('mentions /.deepseekgui/dagong casually')
  })

  it('leaves invalid JSON untouched', async () => {
    const home = await makeTempRoot()
    const userData = join(home, 'userData')
    await mkdir(userData, { recursive: true })
    await writeFile(join(userData, 'dagong-settings.json'), '{not json', 'utf8')

    const rewritten = rewriteLegacyPathsInSettingsFile({
      userDataPath: userData,
      homeDir: home,
      mappings: HOME_DATA_MIGRATION_MAPPINGS
    })

    expect(rewritten).toBe(false)
    expect(await readFile(join(userData, 'dagong-settings.json'), 'utf8')).toBe('{not json')
  })

  it('rewrites absolute paths even when separators differ', async () => {
    const home = await makeTempRoot()
    const userData = join(home, 'userData')
    await mkdir(userData, { recursive: true })
    const legacyWindowsish = join(home, '.deepseekgui', 'dagong').replace(/\//g, '\\')
    await writeFile(
      join(userData, 'dagong-settings.json'),
      JSON.stringify({ agents: { dagong: { dataDir: `${legacyWindowsish}\\sessions` } } }),
      'utf8'
    )

    const rewritten = rewriteLegacyPathsInSettingsFile({
      userDataPath: userData,
      homeDir: home,
      mappings: HOME_DATA_MIGRATION_MAPPINGS
    })

    expect(rewritten).toBe(true)
    const updated = JSON.parse(await readFile(join(userData, 'dagong-settings.json'), 'utf8'))
    expect(updated.agents.dagong.dataDir).toBe(`${join(home, '.dagong', 'data').replace(/\//g, '\\')}\\sessions`)
  })
})

describe('runLegacyDagongDataMigration', () => {
  it('migrates userData, home dirs, and rewrites settings in one pass', async () => {
    const root = await makeTempRoot()
    const home = join(root, 'home')
    const appData = join(root, 'appData')
    const legacyUserData = join(appData, 'DeepSeek GUI')
    await mkdir(legacyUserData, { recursive: true })
    await mkdir(join(home, '.deepseekgui', 'dagong'), { recursive: true })
    await writeFile(join(home, '.deepseekgui', 'dagong', 'db.sqlite'), 'db', 'utf8')
    await writeFile(
      join(legacyUserData, 'deepseek-gui-settings.json'),
      JSON.stringify({
        version: 1,
        workspaceRoot: join(home, '.deepseekgui', 'default_workspace'),
        agents: { dagong: { dataDir: '~/.deepseekgui/dagong' } }
      }),
      'utf8'
    )

    const result = runLegacyDagongDataMigration({ userDataPath: join(appData, 'Dagong'), homeDir: home })

    expect(result.userData.migrated).toBe(true)
    expect(result.userData.usedLegacyFallback).toBe(false)
    expect(result.settingsRewritten).toBe(true)
    const settings = JSON.parse(
      await readFile(join(appData, 'Dagong', 'deepseek-gui-settings.json'), 'utf8')
    )
    expect(settings.agents.dagong.dataDir).toBe('~/.dagong/data')
    expect(settings.workspaceRoot).toBe(join(home, '.dagong', 'default_workspace'))
    expect(await readFile(join(home, '.dagong', 'data', 'db.sqlite'), 'utf8')).toBe('db')
  })

  it('never throws even when nothing exists', () => {
    expect(() =>
      runLegacyDagongDataMigration({ userDataPath: join('/nonexistent-root', 'Dagong'), homeDir: '/nonexistent-home' })
    ).not.toThrow()
  })
})
