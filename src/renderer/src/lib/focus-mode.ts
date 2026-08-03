import { readBrowserStorageItem, writeBrowserStorageItem } from './browser-storage'

export const FOCUS_MODE_STORAGE_KEY = 'dagong.focusMode'

export function readFocusModePreference(): boolean {
  const raw = readBrowserStorageItem(FOCUS_MODE_STORAGE_KEY)
  if (raw == null) return true
  const value = raw.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

export function writeFocusModePreference(enabled: boolean): void {
  writeBrowserStorageItem(FOCUS_MODE_STORAGE_KEY, enabled ? '1' : '0')
}
