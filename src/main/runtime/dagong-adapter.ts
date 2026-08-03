import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_KUN_DATA_DIR,
  getDagongRuntimeSettings,
  type AppSettingsV1
} from '../../shared/app-settings'
import {
  buildDagongServeArgs,
  resolveDagongExecutable
} from '../resolve-dagong-binary'
import {
  isDagongChildRunning,
  reclaimDagongPort,
  resolveAvailableDagongPort,
  startDagongChild,
  stopDagongChildAndWait
} from '../dagong-process'
import { getDagongBaseUrl } from '../dagong-base-url'

const KUN_RUNTIME_ID = 'dagong' as const

function appRoot(): string {
  return app.isPackaged
    ? app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked')
    : app.getAppPath()
}

export const dagongRuntimeAdapter = {
  id: KUN_RUNTIME_ID,

  async resolveExecutable(settings: AppSettingsV1): Promise<string> {
    const runtime = getDagongRuntimeSettings(settings)
    const resolution = resolveDagongExecutable(appRoot(), runtime.binaryPath)
    if (resolution.kind === 'node-script') {
      const scriptPath = resolution.args[0] ?? ''
      return runtime.binaryPath.trim()
        ? `Node.js script (${scriptPath})`
        : `Bundled Dagong (${scriptPath})`
    }
    return resolution.command
  },

  ensureRunning(settings: AppSettingsV1): Promise<void> {
    return startDagongChild(settings)
  },

  stopAndWait(): Promise<void> {
    return stopDagongChildAndWait()
  },

  isChildRunning(): boolean {
    return isDagongChildRunning()
  },

  getBaseUrl(settings: AppSettingsV1): string {
    const runtime = getDagongRuntimeSettings(settings)
    return getDagongBaseUrl(runtime.port)
  },

  reclaimPort(port: number): Promise<{ ok: true } | { ok: false; message: string }> {
    return reclaimDagongPort(port)
  },

  resolveAvailablePort(port: number): Promise<{ port: number; changed: boolean; message?: string }> {
    return resolveAvailableDagongPort(port)
  }
}

export function getRuntimeBaseUrlForSettings(settings: AppSettingsV1): string {
  return dagongRuntimeAdapter.getBaseUrl(settings)
}

/** Build the bearer-token authorization header for Dagong requests. */
export function runtimeAuthHeaders(settings: AppSettingsV1): Headers {
  const runtime = getDagongRuntimeSettings(settings)
  const headers = new Headers()
  if (runtime.runtimeToken.trim()) {
    headers.set('Authorization', `Bearer ${runtime.runtimeToken.trim()}`)
  }
  return headers
}

export type RuntimeRequestInit = {
  method?: string
  body?: string
  headers?: Record<string, string>
}

export async function runtimeRequestViaHost(
  settings: AppSettingsV1,
  pathAndQuery: string,
  init: RuntimeRequestInit,
  ensureRuntime: (settings: AppSettingsV1) => Promise<AppSettingsV1 | void>
): Promise<{ ok: boolean; status: number; body: string }> {
  const ensuredSettings = await ensureRuntime(settings)
  const requestSettings = ensuredSettings ?? settings
  const method = (init.method ?? 'GET').toUpperCase()
  const base = getRuntimeBaseUrlForSettings(requestSettings)
  const pathNorm = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  try {
    return await fetchRuntimeRequest(requestSettings, base, pathNorm, method, init)
  } catch (error) {
    const retrySettings = await ensureRuntime(requestSettings)
    const nextSettings = retrySettings ?? requestSettings
    const nextBase = getRuntimeBaseUrlForSettings(nextSettings)
    const safeToRetry =
      method === 'GET' ||
      method === 'HEAD' ||
      (nextBase !== base && isRuntimeConnectionFailure(error))
    if (!safeToRetry) throw error
    return fetchRuntimeRequest(nextSettings, nextBase, pathNorm, method, init)
  }
}

async function fetchRuntimeRequest(
  settings: AppSettingsV1,
  base: string,
  pathNorm: string,
  method: string,
  init: RuntimeRequestInit
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${base}${pathNorm}`
  const hdrs = runtimeAuthHeaders(settings)
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    hdrs.set(key, value)
  }
  hdrs.set('Accept', 'application/json')
  if (init.body && !hdrs.has('Content-Type')) {
    hdrs.set('Content-Type', 'application/json')
  }
  const res = await fetch(url, {
    method,
    headers: hdrs,
    body: init.body,
    signal: AbortSignal.timeout(method === 'POST' ? 60_000 : 15_000)
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text }
}

function isRuntimeConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const text = `${error.name} ${error.message} ${String((error as { cause?: unknown }).cause ?? '')}`.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('econnrefused') ||
    text.includes('econnreset') ||
    text.includes('socket') ||
    text.includes('connect')
  )
}

export { buildDagongServeArgs, resolveDagongExecutable }

/**
 * Default data directory used when the user has not provided one.
 * The path lives under the app user-data directory so packaged
 * installs do not need write access to the install folder.
 */
export function defaultDagongDataDir(): string {
  return DEFAULT_KUN_DATA_DIR.replace(/^~(?=$|[\\/])/, homedir())
}
