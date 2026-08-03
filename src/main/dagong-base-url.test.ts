import { describe, expect, it } from 'vitest'
import { getDagongBaseUrl, normalizeLocalDagongHost } from './dagong-base-url'

describe('getDagongBaseUrl', () => {
  it('uses 127.0.0.1 by default', () => {
    expect(getDagongBaseUrl(18899)).toBe('http://127.0.0.1:18899')
  })

  it('formats IPv6 loopback hosts for URL use', () => {
    expect(getDagongBaseUrl(18899, '::1')).toBe('http://[::1]:18899')
    expect(getDagongBaseUrl(18899, '[::1]')).toBe('http://[::1]:18899')
  })

  it('accepts localhost aliases only', () => {
    expect(normalizeLocalDagongHost('localhost')).toBe('localhost')
    expect(() => getDagongBaseUrl(18899, 'example.com')).toThrow(/local host/)
  })
})
