import { describe, expect, it } from 'vitest'
import { isDagongHealthResponseBody } from './dagong-health'

describe('isDagongHealthResponseBody', () => {
  it('accepts Dagong serve health responses', () => {
    expect(isDagongHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'dagong',
      mode: 'serve'
    }))).toBe(true)
  })

  it('rejects generic or legacy runtime health responses', () => {
    expect(isDagongHealthResponseBody(JSON.stringify({ status: 'ok' }))).toBe(false)
    expect(isDagongHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'codewhale',
      mode: 'serve'
    }))).toBe(false)
  })
})
