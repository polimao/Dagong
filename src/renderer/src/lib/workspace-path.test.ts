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

  it('uses ~/Documents/Dagong on macOS', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/Documents/Dagong')
  })

  it('uses ~/.local/share/Dagong/conversations on Linux', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'linux' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/.local/share/Dagong/conversations')
  })

  it('falls back to ~/Documents/Dagong when platform is unknown', () => {
    vi.stubGlobal('window', { dagongGui: { platform: '' } })
    expect(defaultConversationWorkspaceRoot()).toBe('~/Documents/Dagong')
  })

  it('DEFAULT_CONVERSATION_WORKSPACE_ROOT resolves at import time from the platform', () => {
    expect(typeof DEFAULT_CONVERSATION_WORKSPACE_ROOT).toBe('string')
    expect(DEFAULT_CONVERSATION_WORKSPACE_ROOT.length).toBeGreaterThan(0)
  })
})

describe('isInternalDeepSeekGuiWorkspace', () => {
  it('treats write and design workspaces as internal GUI workspaces', () => {
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/.dagong/write_workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/.dagong/design-workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('~/.dagong/design-workspace')).toBe(true)
    expect(isInternalDeepSeekGuiWorkspace('/Users/alice/projects/design-workspace')).toBe(false)
  })
})

describe('isConversationWorkspacePath', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matches a path directly under the conversation root', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/Dagong/20260626-153012', '~/Documents/Dagong')).toBe(true)
  })

  it('matches the conversation root itself', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/Dagong', '~/Documents/Dagong')).toBe(true)
  })

  it('expands ~ in the candidate path', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('~/Documents/Dagong/sub', '~/Documents/Dagong')).toBe(true)
  })

  it('does not match a sibling that merely shares a prefix segment', () => {
    // /Users/alice/Documents/Dagong-other 必须不被当成对话目录,否则会误伤真实项目。
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/Documents/Dagong-other', '~/Documents/Dagong')).toBe(false)
  })

  it('does not match a path outside the conversation root', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('/Users/alice/projects/app', '~/Documents/Dagong')).toBe(false)
  })

  it('handles backslash separators (Windows)', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'win32', homeDir: 'C:\\Users\\alice' } })
    expect(isConversationWorkspacePath('C:\\Users\\alice\\Documents\\Dagong\\20260626-153012', '~/Documents/Dagong')).toBe(true)
    expect(isConversationWorkspacePath('C:\\Users\\alice\\Documents\\Dagong-other', '~/Documents/Dagong')).toBe(false)
  })

  it('returns false for empty input', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'darwin', homeDir: '/Users/alice' } })
    expect(isConversationWorkspacePath('', '~/Documents/Dagong')).toBe(false)
  })

  it('falls back to the platform default when no root is given', () => {
    vi.stubGlobal('window', { dagongGui: { platform: 'linux', homeDir: '/home/alice' } })
    expect(
      isConversationWorkspacePath('/home/alice/.local/share/Dagong/conversations/20260626-153012')
    ).toBe(true)
  })
})
