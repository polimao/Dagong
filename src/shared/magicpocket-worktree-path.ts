/**
 * Path helpers for MagicPocket-managed conversation worktrees created by git-service
 * under `<worktreeRoot>/<4-hex-id>/<repo-basename>`.
 */

export type MagicPocketBranchWorktreeLayout = {
  poolId: string
  repoName: string
}

function normalizePathForMatch(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function parseMagicPocketBranchWorktreeLayout(path: string): MagicPocketBranchWorktreeLayout | null {
  const normalized = normalizePathForMatch(path.trim())
  if (!normalized) return null
  const match = normalized.match(/\/([0-9a-f]{4})\/([^/]+)$/i)
  if (!match) return null
  const poolId = match[1] ?? ''
  const repoName = match[2] ?? ''
  if (!poolId || !repoName) return null
  const prefix = normalized.slice(0, -(poolId.length + repoName.length + 2))
  // Branch worktrees are created by git-service's resolveBranchWorktreeRoot under
  // the default MagicPocket worktree root `~/.magicpocket/worktrees`, i.e.
  // `<home>/.magicpocket/worktrees/<4-hex-id>/<repo-basename>`. Anchor on that exact
  // `.magicpocket/worktrees` root so an unrelated user project that merely happens to sit
  // under some other `worktrees/<hex>/<name>` directory (e.g.
  // `/work/worktrees/2024/app`) is not misclassified and hidden as a MagicPocket
  // worktree. The scheduled-agent pool uses a different layout
  // (`<root>/<basename>/pool-N`) and is intentionally not matched here.
  if (!/(?:^|\/)\.magicpocket\/worktrees$/i.test(prefix)) return null
  return { poolId, repoName }
}

export function isMagicPocketBranchWorktreePath(path: string): boolean {
  return parseMagicPocketBranchWorktreeLayout(path) != null
}

export function resolveMagicPocketBranchWorktreeProjectPath(
  worktreePath: string,
  candidateProjectPaths: readonly string[]
): string {
  const layout = parseMagicPocketBranchWorktreeLayout(worktreePath)
  if (!layout) return ''
  for (const candidate of candidateProjectPaths) {
    const trimmed = candidate.trim()
    if (!trimmed || isMagicPocketBranchWorktreePath(trimmed)) continue
    const normalized = normalizePathForMatch(trimmed)
    if (!normalized) continue
    const parts = normalized.split('/').filter(Boolean)
    if (parts[parts.length - 1] === layout.repoName) return trimmed
  }
  return ''
}
