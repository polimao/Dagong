import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_CONVERSATION_WORKSPACE_ROOT,
  defaultConversationWorkspaceRoot,
  isConversationWorkspacePath,
  isInternalDeepSeekGuiWorkspace
} from './workspace-path'

describe('defaultConversationWorkspaceRoot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses ~/Documents/MagicPocket on macOS', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/Documents/MagicPocket')
  })

  it('uses ~/.local/share/MagicPocket/conversations on Linux', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'linux' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/.local/share/MagicPocket/conversations')
  })

  it('falls back to ~/Documents/MagicPocket when platform is unknown', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: '' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/Documents/MagicPocket')
  })

  it('DEFAULT_CONVERSATION_WORKSPACE_ROOT resolves at import time from the platform', () => {
    expect(typeof DEFAULT_CONVERSATION_WORKSPACE_ROOT).toBe('string')
    expect(DEFAULT_CONVERSATION_WORKSPACE_ROOT.length).toBeGreaterThan(0)
  })
})

describe('isInternalDeepSeekGuiWorkspace', () => {
  it('treats write and design workspaces as internal GUI workspaces', () => {
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/.magicpocket/write_workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/.magicpocket/design-workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('~/.magicpocket/design-workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/projects/design-workspace')).toBe(false)
  })
})

describe('isConversationWorkspacePath', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches a path directly under the conversation root', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/MagicPocket/20260626-153012', '~/Documents/MagicPocket')).toBe(true)
  })

  it('matches the conversation root itself', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/MagicPocket', '~/Documents/MagicPocket')).toBe(true)
  })

  it('expands ~ in the candidate path', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('~/Documents/MagicPocket/sub', '~/Documents/MagicPocket')).toBe(true)
  })

  it('does not match a sibling that merely shares a prefix segment', () => {
    // /Users/alice/Documents/MagicPocket-other 必须不被当成对话目录,否则会误伤真实项目。
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/MagicPocket-other', '~/Documents/MagicPocket')).toBe(false)
  })

  it('does not match a path outside the conversation root', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/projects/app', '~/Documents/MagicPocket')).toBe(false)
  })

  it('handles backslash separators (Windows)', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'win32', homeDir: 'C:\\Users\\alice' } })
    expect(isConversationWorkspacePath('C:\\Users\\alice\\Documents\\MagicPocket\\20260626-153012', '~/Documents/MagicPocket')).toBe(true)
    expect(isConversationWorkspacePath('C:\\Users\\alice\\Documents\\MagicPocket-other', '~/Documents/MagicPocket')).toBe(false)
  })

  it('returns false for empty input', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('', '~/Documents/MagicPocket')).toBe(false)
  })

  it('falls back to the platform default when no root is given', () => {
    vi.stubGlobal('window', { magicpocketGui: { platform: 'linux', homeDir: '/home/alice' } })
    expect(
      isConversationWorkspacePath('/home/alice/.local/share/MagicPocket/conversations/20260626-153012')
    ).toBe(true)
  })
})
