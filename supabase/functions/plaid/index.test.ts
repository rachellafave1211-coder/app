import { beforeEach, describe, expect, it } from 'vitest'
import { handle, type Env } from './index'

const env: Env = {
  PLAID_CLIENT_ID: 'cid',
  PLAID_SECRET: 'sec',
  PLAID_ENV: 'sandbox',
  PLAID_REDIRECT_URI: 'https://app.example/',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJservice',
}

type Row = Record<string, unknown>
let rows: Row[]
let plaidCalls: { path: string; body: Record<string, unknown> }[]
let syncPages: Record<string, unknown>[]

const res = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status })

/** Fake Supabase Auth + PostgREST + Plaid, enough to exercise the function. */
const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  const headers = new Headers(init?.headers)
  if (url.pathname === '/auth/v1/user') {
    const who = { 'Bearer alice': 'u-alice', 'Bearer bob': 'u-bob' }[headers.get('Authorization') ?? '']
    return who ? res({ id: who }) : res({ msg: 'bad jwt' }, 401)
  }
  if (url.pathname === '/rest/v1/plaid_items') {
    expect(headers.get('apikey')).toBe('eyJservice')
    const eq = (k: string) => url.searchParams.get(k)?.replace(/^eq\./, '')
    const match = (r: Row) => (!eq('user_id') || r.user_id === eq('user_id')) && (!eq('item_id') || r.item_id === eq('item_id'))
    const method = init?.method ?? 'GET'
    if (method === 'GET') {
      const cols = (url.searchParams.get('select') ?? '').split(',')
      return res(rows.filter(match).map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))))
    }
    if (method === 'POST') {
      const row = JSON.parse(String(init!.body))
      rows = rows.filter((r) => r.item_id !== row.item_id).concat({ created_at: '2026-10-01', cursor: null, ...row })
      return res(null, 201)
    }
    if (method === 'PATCH') {
      const patch = JSON.parse(String(init!.body))
      rows = rows.map((r) => (match(r) ? { ...r, ...patch } : r))
      return res(null, 204)
    }
    if (method === 'DELETE') {
      rows = rows.filter((r) => !match(r))
      return res(null, 204)
    }
  }
  if (url.host === 'sandbox.plaid.com') {
    const body = JSON.parse(String(init!.body))
    expect(body.client_id).toBe('cid')
    expect(body.secret).toBe('sec')
    plaidCalls.push({ path: url.pathname, body })
    if (url.pathname === '/link/token/create') return res({ link_token: 'link-sandbox-1' })
    if (url.pathname === '/item/public_token/exchange') return res({ item_id: 'item-1', access_token: 'access-secret' })
    if (url.pathname === '/item/remove') return res({})
    if (url.pathname === '/transactions/sync') {
      if (body.access_token === 'expired') return res({ error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'login required' }, 400)
      return res(syncPages.shift() ?? { added: [], modified: [], removed: [], has_more: false, next_cursor: body.cursor })
    }
  }
  throw new Error(`unexpected fetch ${url}`)
}

const call = async (who: string | null, body: Record<string, unknown>, e: Env = env) => {
  const r = await handle(
    new Request('https://proj.supabase.co/functions/v1/plaid', {
      method: 'POST',
      headers: who ? { Authorization: `Bearer ${who}` } : {},
      body: JSON.stringify(body),
    }),
    e,
    fakeFetch,
  )
  return { status: r.status, body: await r.json() }
}

const txn = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  transaction_id: id,
  account_id: 'acc-1',
  date: '2026-10-02',
  name: `RAW ${id}`,
  merchant_name: `Shop ${id}`,
  amount,
  pending: false,
  personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' },
  ...extra,
})

beforeEach(() => {
  rows = []
  plaidCalls = []
  syncPages = []
})

describe('plaid edge function', () => {
  it('answers CORS preflight', async () => {
    const r = await handle(new Request('https://x', { method: 'OPTIONS' }), env, fakeFetch)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('explains missing setup and missing sign-in', async () => {
    expect((await call('alice', { action: 'list' }, { ...env, PLAID_SECRET: undefined })).body.error).toMatch(/missing PLAID_SECRET/)
    expect((await call(null, { action: 'list' })).status).toBe(401)
    expect((await call('mallory', { action: 'list' })).status).toBe(401)
  })

  it('creates a link token for the signed-in person', async () => {
    const r = await call('alice', { action: 'link_token' })
    expect(r.body).toEqual({ link_token: 'link-sandbox-1' })
    expect(plaidCalls[0].body).toMatchObject({ user: { client_user_id: 'u-alice' }, products: ['transactions'], redirect_uri: 'https://app.example/' })
  })

  it('saves a connected bank without ever returning its access token', async () => {
    const r = await call('alice', { action: 'exchange', public_token: 'public-1', institution_name: 'First Platypus Bank' })
    expect(r.body).toEqual({ item: { item_id: 'item-1', institution_name: 'First Platypus Bank' } })
    expect(rows[0]).toMatchObject({ user_id: 'u-alice', access_token: 'access-secret' })
    const list = await call('alice', { action: 'list' })
    expect(list.body.items).toEqual([{ item_id: 'item-1', institution_name: 'First Platypus Bank', created_at: '2026-10-01' }])
    expect(JSON.stringify(list.body)).not.toContain('access-secret')
  })

  it('syncs every page, applies changes and removals, and only moves the cursor on commit', async () => {
    rows = [{ item_id: 'item-1', user_id: 'u-alice', access_token: 'access-secret', institution_name: 'Bank', cursor: null }]
    syncPages = [
      { added: [txn('a', 54.2), txn('b', 12)], modified: [], removed: [], has_more: true, next_cursor: 'c1', accounts: [] },
      {
        added: [txn('c', -1100, { personal_finance_category: { primary: 'INCOME', detailed: 'INCOME_WAGES' } })],
        modified: [txn('a', 56.8)],
        removed: [{ transaction_id: 'b' }],
        has_more: false,
        next_cursor: 'c2',
        accounts: [{ account_id: 'acc-1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking', balances: { current: 1320.5, available: 1300 } }],
      },
    ]
    const r = await call('alice', { action: 'sync', item_id: 'item-1' })
    expect(r.body.next_cursor).toBe('c2')
    expect(r.body.transactions).toEqual([
      { id: 'a', date: '2026-10-02', name: 'Shop a', amount: 56.8, pending: false, category: 'FOOD_AND_DRINK_GROCERIES', account_id: 'acc-1' },
      { id: 'c', date: '2026-10-02', name: 'Shop c', amount: -1100, pending: false, category: 'INCOME_WAGES', account_id: 'acc-1' },
    ])
    expect(r.body.accounts).toEqual([{ id: 'acc-1', name: 'Checking', mask: '0000', type: 'depository', subtype: 'checking', current: 1320.5, available: 1300 }])
    expect(plaidCalls.map((c) => c.body.cursor)).toEqual([undefined, 'c1'])
    expect(rows[0].cursor).toBeNull()

    await call('alice', { action: 'commit', item_id: 'item-1', cursor: 'c2' })
    expect(rows[0].cursor).toBe('c2')
    await call('alice', { action: 'sync', item_id: 'item-1' })
    expect(plaidCalls.at(-1)!.body.cursor).toBe('c2')
  })

  it('never lets one person use another person’s bank', async () => {
    rows = [{ item_id: 'item-1', user_id: 'u-alice', access_token: 'access-secret', institution_name: 'Bank', cursor: null }]
    expect((await call('bob', { action: 'list' })).body.items).toEqual([])
    expect((await call('bob', { action: 'sync', item_id: 'item-1' })).status).toBe(404)
    expect((await call('bob', { action: 'commit', item_id: 'item-1', cursor: 'x' })).status).toBe(404)
    expect((await call('bob', { action: 'remove', item_id: 'item-1' })).status).toBe(404)
    expect(rows).toHaveLength(1)
    expect(plaidCalls).toEqual([])
  })

  it('explains when the bank needs signing in again', async () => {
    rows = [{ item_id: 'item-1', user_id: 'u-alice', access_token: 'expired', institution_name: 'Bank', cursor: null }]
    const r = await call('alice', { action: 'sync', item_id: 'item-1' })
    expect(r.status).toBe(409)
    expect(r.body.error).toMatch(/sign in again/)
  })

  it('disconnects a bank', async () => {
    rows = [{ item_id: 'item-1', user_id: 'u-alice', access_token: 'access-secret', institution_name: 'Bank', cursor: null }]
    expect((await call('alice', { action: 'remove', item_id: 'item-1' })).body).toEqual({ ok: true })
    expect(plaidCalls.map((c) => c.path)).toEqual(['/item/remove'])
    expect(rows).toEqual([])
  })
})
