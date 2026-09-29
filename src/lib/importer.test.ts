import { describe, expect, it } from 'vitest'
import { autoCategory, matchBill, parseCsv, rowsFromCsv, sheetsCsvUrl } from './importer'
import { sampleState } from './seed'

describe('csv import', () => {
  it('parses quoted cells', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })

  it('reads rows with or without a header, in any column order', () => {
    const withHeader = rowsFromCsv('Amount,Date,Description,Category\n"$1,210.00",10/01/2026,Rent,Housing\n-12.50,2026-10-02,Chipotle,')
    expect(withHeader.rows).toEqual([
      { date: '2026-10-01', name: 'Rent', category: 'Housing', amount: 1210 },
      { date: '2026-10-02', name: 'Chipotle', category: '', amount: 12.5 },
    ])
    const bare = rowsFromCsv('2026-10-03,Shell,Gas,41.2\nnot a date,x,y,1')
    expect(bare.rows).toHaveLength(1)
    expect(bare.skipped).toBe(1)
  })

  it('auto-categorizes by label then merchant keywords', () => {
    const cats = sampleState().categories
    expect(autoCategory('Anything', 'groceries', cats)).toBe('c-groceries')
    expect(autoCategory('SHELL OIL 123', '', cats)).toBe('c-gas')
    expect(autoCategory('Starbucks', '', cats)).toBe('c-dining')
    expect(autoCategory('Mystery', '', cats)).toBe('')
  })

  it('matches bill payments by name and amount', () => {
    const bills = sampleState().bills
    expect(matchBill({ date: '2026-09-13', name: 'NETFLIX.COM', category: '', amount: 10 }, bills)?.key).toBe('b-netflix@2026-09')
    expect(matchBill({ date: '2026-09-30', name: 'Rent payment', category: '', amount: 1210 }, bills)?.key).toBe('b-rent@2026-10')
    expect(matchBill({ date: '2026-09-30', name: 'Rent payment', category: '', amount: 400 }, bills)).toBeNull()
  })

  it('builds a Google Sheets CSV url', () => {
    expect(sheetsCsvUrl('https://docs.google.com/spreadsheets/d/abc_123/edit#gid=42')).toBe('https://docs.google.com/spreadsheets/d/abc_123/gviz/tq?tqx=out:csv&gid=42')
    expect(sheetsCsvUrl('https://example.com')).toBeNull()
  })
})
