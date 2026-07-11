/**
 * MagicPocket HTTP endpoint path templates. The renderer and the main
 * process IPC allow-list both derive their paths from this table, so
 * adding a new endpoint is a one-file change.
 *
 * `*TEMPLATE` constants carry the `{id}` / `{turn}` placeholders
 * literally. `*PATH(...)` builders perform the URL encoding and
 * return a concrete path for runtime use.
 */

export const KUN_HEALTH_PATH = '/health'
export const KUN_HEALTH_TEMPLATE = '/health'

export const KUN_RUNTIME_INFO_PATH = '/v1/runtime/info'
export const KUN_RUNTIME_INFO_TEMPLATE = '/v1/runtime/info'

export const KUN_RUNTIME_TOOLS_PATH = '/v1/runtime/tools'
export const KUN_RUNTIME_TOOLS_TEMPLATE = '/v1/runtime/tools'

export const KUN_SUPPLY_CHAIN_AUDIT_PATH = '/v1/supply-chain/audit'
export const KUN_SUPPLY_CHAIN_AUDIT_TEMPLATE = '/v1/supply-chain/audit'
export const KUN_SUPPLY_CHAIN_UPDATE_CHECK_PATH = '/v1/supply-chain/update-check'
export const KUN_SUPPLY_CHAIN_UPDATE_CHECK_TEMPLATE = '/v1/supply-chain/update-check'

export const KUN_MCP_OAUTH_PATH = '/v1/mcp/oauth'
export const KUN_MCP_OAUTH_TEMPLATE = '/v1/mcp/oauth'
export const KUN_MCP_OAUTH_SERVER_TEMPLATE = '/v1/mcp/oauth/{id}'
export function magicpocketMcpOAuthServerPath(serverId: string): string {
  return `/v1/mcp/oauth/${encodeURIComponent(serverId)}`
}

export const KUN_SKILLS_PATH = '/v1/skills'
export const KUN_SKILLS_TEMPLATE = '/v1/skills'

export const KUN_ATTACHMENTS_PATH = '/v1/attachments'
export const KUN_ATTACHMENTS_TEMPLATE = '/v1/attachments'
export const KUN_ATTACHMENT_DIAGNOSTICS_PATH = '/v1/attachments/diagnostics'
export const KUN_ATTACHMENT_DIAGNOSTICS_TEMPLATE = '/v1/attachments/diagnostics'
export const KUN_ATTACHMENT_TEMPLATE = '/v1/attachments/{id}'
export function magicpocketAttachmentPath(attachmentId: string): string {
  return `/v1/attachments/${encodeURIComponent(attachmentId)}`
}
export const KUN_ATTACHMENT_CONTENT_TEMPLATE = '/v1/attachments/{id}/content'
export function magicpocketAttachmentContentPath(attachmentId: string): string {
  return `${magicpocketAttachmentPath(attachmentId)}/content`
}

export const KUN_MEMORY_PATH = '/v1/memory'
export const KUN_MEMORY_TEMPLATE = '/v1/memory'
export const KUN_MEMORY_DIAGNOSTICS_PATH = '/v1/memory/diagnostics'
export const KUN_MEMORY_DIAGNOSTICS_TEMPLATE = '/v1/memory/diagnostics'
export const KUN_MEMORY_RECORD_TEMPLATE = '/v1/memory/{id}'
export function magicpocketMemoryRecordPath(memoryId: string): string {
  return `/v1/memory/${encodeURIComponent(memoryId)}`
}

export const KUN_THREADS_PATH = '/v1/threads'
export const KUN_THREADS_TEMPLATE = '/v1/threads'

export const KUN_THREAD_TEMPLATE = '/v1/threads/{id}'
export function magicpocketThreadPath(threadId: string): string {
  return `/v1/threads/${encodeURIComponent(threadId)}`
}

export const KUN_THREAD_FORK_TEMPLATE = '/v1/threads/{id}/fork'
export function magicpocketThreadForkPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/fork`
}

export const KUN_THREAD_GOAL_TEMPLATE = '/v1/threads/{id}/goal'
export function magicpocketThreadGoalPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/goal`
}

export const KUN_THREAD_TODOS_TEMPLATE = '/v1/threads/{id}/todos'
export function magicpocketThreadTodosPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/todos`
}

export const KUN_THREAD_COMPACT_TEMPLATE = '/v1/threads/{id}/compact'
export function magicpocketThreadCompactPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/compact`
}

export const KUN_THREAD_REVIEW_TEMPLATE = '/v1/threads/{id}/review'
export function magicpocketThreadReviewPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/review`
}

export const KUN_THREAD_REWIND_TEMPLATE = '/v1/threads/{id}/rewind'
export function magicpocketThreadRewindPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/rewind`
}

export const KUN_THREAD_TURNS_TEMPLATE = '/v1/threads/{id}/turns'
export function magicpocketThreadTurnsPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/turns`
}

export const KUN_THREAD_STEER_TEMPLATE = '/v1/threads/{id}/turns/{turn}/steer'
export function magicpocketThreadSteerPath(threadId: string, turnId: string): string {
  return `${magicpocketThreadTurnsPath(threadId)}/${encodeURIComponent(turnId)}/steer`
}

export const KUN_THREAD_INTERRUPT_TEMPLATE = '/v1/threads/{id}/turns/{turn}/interrupt'
export function magicpocketThreadInterruptPath(threadId: string, turnId: string): string {
  return `${magicpocketThreadTurnsPath(threadId)}/${encodeURIComponent(turnId)}/interrupt`
}

export const KUN_THREAD_EVENTS_TEMPLATE = '/v1/threads/{id}/events'
export function magicpocketThreadEventsPath(threadId: string): string {
  return `${magicpocketThreadPath(threadId)}/events`
}

export const KUN_APPROVAL_TEMPLATE = '/v1/approvals/{id}'
export function magicpocketApprovalPath(approvalId: string): string {
  return `/v1/approvals/${encodeURIComponent(approvalId)}`
}

export const KUN_USER_INPUT_TEMPLATE = '/v1/user-inputs/{id}'
export function magicpocketUserInputPath(inputId: string): string {
  return `/v1/user-inputs/${encodeURIComponent(inputId)}`
}

export const KUN_SESSION_RESUME_TEMPLATE = '/v1/sessions/{id}/resume-thread'
export function magicpocketSessionResumePath(sessionId: string): string {
  return `/v1/sessions/${encodeURIComponent(sessionId)}/resume-thread`
}

export const KUN_USAGE_PATH = '/v1/usage'
export const KUN_USAGE_TEMPLATE = '/v1/usage'

export const KUN_DEBUG_LLM_ROUNDS_PATH = '/v1/debug/llm-rounds'
export const KUN_DEBUG_LLM_ROUNDS_TEMPLATE = '/v1/debug/llm-rounds'

export const KUN_BACKGROUND_SHELLS_PATH = '/v1/background-shells'
export const KUN_BACKGROUND_SHELLS_TEMPLATE = '/v1/background-shells'
export const KUN_BACKGROUND_SHELL_TEMPLATE = '/v1/background-shells/{sessionId}'
export function magicpocketBackgroundShellPath(sessionId: string): string {
  return `/v1/background-shells/${encodeURIComponent(sessionId)}`
}
export function magicpocketBackgroundShellStopPath(sessionId: string): string {
  return `${magicpocketBackgroundShellPath(sessionId)}/stop`
}

/** Thread mode shared with the MagicPocket contract. */
export type MagicPocketThreadMode = 'agent' | 'plan'

const THREAD_MODES: ReadonlySet<MagicPocketThreadMode> = new Set<MagicPocketThreadMode>(['agent', 'plan'])

export function isMagicPocketThreadMode(value: unknown): value is MagicPocketThreadMode {
  return typeof value === 'string' && (THREAD_MODES as Set<string>).has(value)
}

export function normalizeThreadMode(value: unknown): MagicPocketThreadMode {
  return value === 'plan' ? 'plan' : 'agent'
}
