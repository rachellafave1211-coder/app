import { describe, expect, it } from 'vitest'
import { billTypeLabel } from './billTypes'

describe('billTypeLabel', () => {
  const custom = [{ id: 't1', name: 'Insurance' }]
  it('names built-in, custom and deleted types', () => {
    expect(billTypeLabel(custom, 'subscription')).toBe('Subscription')
    expect(billTypeLabel(custom, 'subscription', true)).toBe('Sub')
    expect(billTypeLabel(custom, 't1')).toBe('Insurance')
    expect(billTypeLabel(custom, 'gone')).toBe('Bill')
  })
})
