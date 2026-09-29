import type { BuiltInBillType, CustomBillType } from './types'

export const BUILT_IN_TYPES: { id: BuiltInBillType; name: string; short: string }[] = [
  { id: 'bill', name: 'Bill', short: 'Bill' },
  { id: 'subscription', name: 'Subscription', short: 'Sub' },
  { id: 'savings', name: 'Savings', short: 'Savings' },
  { id: 'debt', name: 'Debt', short: 'Debt' },
]

export const isBuiltInType = (t: string): t is BuiltInBillType => BUILT_IN_TYPES.some((b) => b.id === t)

/** Display name for a bill's type; a deleted custom type reads as "Bill". */
export function billTypeLabel(custom: CustomBillType[], type: string, short = false): string {
  const built = BUILT_IN_TYPES.find((b) => b.id === type)
  if (built) return short ? built.short : built.name
  return custom.find((c) => c.id === type)?.name ?? 'Bill'
}
