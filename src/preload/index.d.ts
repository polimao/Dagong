import type { DagongGuiApi } from '../shared/dagong-gui-api'

export type * from '../shared/dagong-gui-api'

declare global {
  interface Window {
    dagongGui: DagongGuiApi
  }
}
