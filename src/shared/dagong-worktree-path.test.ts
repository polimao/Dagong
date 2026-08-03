import { describe, expect, it } from 'vitest'
import {
  isDagongBranchWorktreePath,
  parseDagongBranchWorktreeLayout,
  resolveDagongBranchWorktreeProjectPath
} from './dagong-worktree-path'

describe('dagong-worktree-path', () => {
  it('recognizes default Dagong branch worktree paths', () => {
    const path = '/Users/zxy/.dagong/worktrees/0ff7/Kook-VoiceShop-Bot'
    expect(isDagongBranchWorktreePath(path)).toBe(true)
    expect(parseDagongBranchWorktreeLayout(path)).toEqual({
      poolId: '0ff7',
      repoName: 'Kook-VoiceShop-Bot'
    })
    expect(
      resolveDagongBranchWorktreeProjectPath(path, ['/Users/zxy/code/Kook-VoiceShop-Bot'])
    ).toBe('/Users/zxy/code/Kook-VoiceShop-Bot')
  })

  it('only treats paths under the Dagong worktree root (.dagong/worktrees) as worktrees', () => {
    // A user project that merely sits under some other `worktrees/<hex>/<name>`
    // directory must NOT be misclassified as a Dagong-managed worktree — otherwise
    // it would be hidden from the sidebar project list.
    expect(isDagongBranchWorktreePath('/data/worktrees/ab12/my-repo')).toBe(false)
    expect(isDagongBranchWorktreePath('/Users/zxy/projects/worktrees/2024/app')).toBe(false)
    expect(isDagongBranchWorktreePath('/Users/zxy/.dagong/worktrees/ab12/my-repo')).toBe(true)
  })

  it('rejects regular project directories', () => {
    expect(isDagongBranchWorktreePath('/Users/zxy/code/Kook-VoiceShop-Bot')).toBe(false)
    expect(isDagongBranchWorktreePath('/Users/zxy/.dagong/default_workspace')).toBe(false)
  })

  it('resolves a worktree path back to a known project root by repo basename', () => {
    const projectPath = '/Users/zxy/code/Kook-VoiceShop-Bot'
    const worktreePath = '/Users/zxy/.dagong/worktrees/38e2/Kook-VoiceShop-Bot'
    expect(
      resolveDagongBranchWorktreeProjectPath(worktreePath, [projectPath, '/Users/zxy/code/DeepSeek-GUI'])
    ).toBe(projectPath)
  })

  it('ignores worktree paths when matching project roots by repo basename', () => {
    expect(
      resolveDagongBranchWorktreeProjectPath(
        '/Users/zxy/.dagong/worktrees/ab12/Kook-VoiceShop-Bot',
        [
          '/Users/zxy/.dagong/worktrees/ab12/Kook-VoiceShop-Bot',
          '/Users/zxy/code/Kook-VoiceShop-Bot'
        ]
      )
    ).toBe('/Users/zxy/code/Kook-VoiceShop-Bot')
  })
})
