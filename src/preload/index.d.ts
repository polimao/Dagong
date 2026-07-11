import type { MagicPocketGuiApi } from '../shared/magicpocket-gui-api'

export type * from '../shared/magicpocket-gui-api'

declare global {
  interface Window {
    magicpocketGui: MagicPocketGuiApi
  }
}
