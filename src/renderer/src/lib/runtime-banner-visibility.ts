import type { DagongRuntimeStatusPayload } from '@shared/dagong-gui-api'

export function shouldSuppressRuntimeErrorBanner(
  status: DagongRuntimeStatusPayload | null | undefined
): boolean {
  return status?.state === 'restarting' || status?.state === 'crashed'
}
