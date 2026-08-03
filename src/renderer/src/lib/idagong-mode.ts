import { readBrowserStorageItem, writeBrowserStorageItem } from './browser-storage'

export const IKUN_MODE_STORAGE_KEY = 'dagong.idagongMode'

export function readIdagongModePreference(): boolean {
  const value = readBrowserStorageItem(IKUN_MODE_STORAGE_KEY)?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'on'
}

export function writeIdagongModePreference(enabled: boolean): void {
  writeBrowserStorageItem(IKUN_MODE_STORAGE_KEY, enabled ? '1' : '0')
}
