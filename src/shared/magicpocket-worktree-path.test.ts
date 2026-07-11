import { describe, expect, it } from 'vitest'
import {
  isMagicPocketBranchWorktreePath,
  parseMagicPocketBranchWorktreeLayout,
  resolveMagicPocketBranchWorktreeProjectPath
} from './magicpocket-worktree-path'

describe('magicpocket-worktree-path', () => {
  it('recognizes default MagicPocket branch worktree paths', () => {
    const path = '/Users/zxy/.magicpocket/worktrees/0ff7/Kook-VoiceShop-Bot'
    expect(isMagicPocketBranchWorktreePath(path)).toBe(true)
    expect(parseMagicPocketBranchWorktreeLayout(path)).toEqual({
      poolId: '0ff7',
      repoName: 'Kook-VoiceShop-Bot'
    })
    expect(
      resolveMagicPocketBranchWorktreeProjectPath(path, ['/Users/zxy/code/Kook-VoiceShop-Bot'])
    ).toBe('/Users/zxy/code/Kook-VoiceShop-Bot')
  })

  it('only treats paths under the MagicPocket worktree root (.magicpocket/worktrees) as worktrees', () => {
    // A user project that merely sits under some other `worktrees/<hex>/<name>`
    // directory must NOT be misclassified as a MagicPocket-managed worktree — otherwise
    // it would be hidden from the sidebar project list.
    expect(isMagicPocketBranchWorktreePath('/data/worktrees/ab12/my-repo')).toBe(false)
    expect(isMagicPocketBranchWorktreePath('/Users/zxy/projects/worktrees/2024/app')).toBe(false)
    expect(isMagicPocketBranchWorktreePath('/Users/zxy/.magicpocket/worktrees/ab12/my-repo')).toBe(true)
  })

  it('rejects regular project directories', () => {
    expect(isMagicPocketBranchWorktreePath('/Users/zxy/code/Kook-VoiceShop-Bot')).toBe(false)
    expect(isMagicPocketBranchWorktreePath('/Users/zxy/.magicpocket/default_workspace')).toBe(false)
  })

  it('resolves a worktree path back to a known project root by repo basename', () => {
    const projectPath = '/Users/zxy/code/Kook-VoiceShop-Bot'
    const worktreePath = '/Users/zxy/.magicpocket/worktrees/38e2/Kook-VoiceShop-Bot'
    expect(
      resolveMagicPocketBranchWorktreeProjectPath(worktreePath, [projectPath, '/Users/zxy/code/DeepSeek-GUI'])
    ).toBe(projectPath)
  })

  it('ignores worktree paths when matching project roots by repo basename', () => {
    expect(
      resolveMagicPocketBranchWorktreeProjectPath(
        '/Users/zxy/.magicpocket/worktrees/ab12/Kook-VoiceShop-Bot',
        [
          '/Users/zxy/.magicpocket/worktrees/ab12/Kook-VoiceShop-Bot',
          '/Users/zxy/code/Kook-VoiceShop-Bot'
        ]
      )
    ).toBe('/Users/zxy/code/Kook-VoiceShop-Bot')
  })
})
