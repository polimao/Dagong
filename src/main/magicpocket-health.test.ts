import { describe, expect, it } from 'vitest'
import { isMagicPocketHealthResponseBody } from './magicpocket-health'

describe('isMagicPocketHealthResponseBody', () => {
  it('accepts MagicPocket serve health responses', () => {
    expect(isMagicPocketHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'magicpocket',
      mode: 'serve'
    }))).toBe(true)
  })

  it('rejects generic or legacy runtime health responses', () => {
    expect(isMagicPocketHealthResponseBody(JSON.stringify({ status: 'ok' }))).toBe(false)
    expect(isMagicPocketHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'codewhale',
      mode: 'serve'
    }))).toBe(false)
  })
})
