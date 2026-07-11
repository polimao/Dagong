import type { MagicPocketRuntimeStatusPayload } from '@shared/magicpocket-gui-api'

export function shouldSuppressRuntimeErrorBanner(
  status: MagicPocketRuntimeStatusPayload | null | undefined
): boolean {
  return status?.state === 'restarting' || status?.state === 'crashed'
}
