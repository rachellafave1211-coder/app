// Payday bank connection: a Supabase Edge Function that talks to Plaid.
//
// The Plaid secret and each bank's access token stay here on the server; the app only ever
// receives link tokens, transactions and balances. Every request must carry the signed-in
// person's Supabase session, and every database query is limited to their own rows.
//
// Actions (POST JSON { action, ... }):
//   link_token                       → { link_token }            start Plaid Link
//   exchange { public_token, institution_name } → { item }        save a newly connected bank
//   list                             → { items }                  connected banks
//   sync { item_id }                 → { transactions, accounts, next_cursor }
//   commit { item_id, cursor }       → { ok }                     mark transactions as imported
//   remove { item_id }               → { ok }                     disconnect a bank
//
// Secrets (Edge Functions → Secrets): PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox or
// production), optional PLAID_REDIRECT_URI (your site, for banks that sign in through their
// own website). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Uses only web-standard APIs, so it has no imports.

export interface Env {
  PLAID_CLIENT_ID?: string
  PLAID_SECRET?: string
  PLAID_ENV?: string
  PLAID_REDIRECT_URI?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

type Fetch = typeof fetch

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export interface BankTransaction {
  id: string
  date: string
  name: string
  /** Positive = money out, as Plaid reports it. */
  amount: number
  pending: boolean
  /** Plaid's detailed category, e.g. FOOD_AND_DRINK_GROCERIES. */
  category: string
  account_id: string
}

export interface BankAccount {
  id: string
  name: string
  mask: string | null
  type: string
  subtype: string | null
  current: number | null
  available: number | null
}

export async function handle(req: Request, env: Env, fetchImpl: Fetch = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  try {
    const missing = (['PLAID_CLIENT_ID', 'PLAID_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const).filter((k) => !env[k])
    if (missing.length) throw new HttpError(500, `The bank connection isn't set up yet: missing ${missing.join(', ')}.`)

    const userId = await currentUser(req, env, fetchImpl)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const plaid = plaidClient(env, fetchImpl)
    const db = dbClient(env, fetchImpl, userId)

    switch (body.action) {
      case 'link_token': {
        const res = await plaid('/link/token/create', {
          user: { client_user_id: userId },
          client_name: 'Payday',
          products: ['transactions'],
          transactions: { days_requested: 90 },
          country_codes: ['US'],
          language: 'en',
          ...(env.PLAID_REDIRECT_URI ? { redirect_uri: env.PLAID_REDIRECT_URI } : {}),
        })
        return json({ link_token: res.link_token })
      }

      case 'exchange': {
        const publicToken = str(body.public_token)
        if (!publicToken) throw new HttpError(400, 'Missing public_token.')
        const res = await plaid('/item/public_token/exchange', { public_token: publicToken })
        const item = { item_id: res.item_id, user_id: userId, access_token: res.access_token, institution_name: str(body.institution_name) || 'Bank' }
        await db.upsert(item)
        return json({ item: { item_id: item.item_id, institution_name: item.institution_name } })
      }

      case 'list': {
        const rows = await db.select('item_id,institution_name,created_at')
        return json({ items: rows })
      }

      case 'sync': {
        const item = await db.one(str(body.item_id))
        const transactions = new Map<string, BankTransaction>()
        let accounts: BankAccount[] = []
        let cursor: string | undefined = item.cursor ?? undefined
        // Page through everything new since the last import. Nothing is saved here: the
        // cursor only moves on `commit`, so cancelling the review loses nothing.
        for (let page = 0; page < 20; page++) {
          const res = await plaid('/transactions/sync', { access_token: item.access_token, count: 500, ...(cursor ? { cursor } : {}) })
          for (const t of [...(res.added ?? []), ...(res.modified ?? [])]) transactions.set(t.transaction_id, toTransaction(t))
          for (const t of res.removed ?? []) transactions.delete(t.transaction_id)
          if (res.accounts) accounts = res.accounts.map(toAccount)
          cursor = res.next_cursor
          if (!res.has_more) break
        }
        return json({ transactions: [...transactions.values()], accounts, next_cursor: cursor ?? null })
      }

      case 'commit': {
        const itemId = str(body.item_id)
        await db.one(itemId)
        await db.update(itemId, { cursor: str(body.cursor) || null })
        return json({ ok: true })
      }

      case 'remove': {
        const item = await db.one(str(body.item_id))
        await plaid('/item/remove', { access_token: item.access_token }).catch(() => undefined)
        await db.remove(item.item_id)
        return json({ ok: true })
      }

      default:
        throw new HttpError(400, 'Unknown action.')
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong talking to the bank. Try again in a minute.' }, 502)
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** The signed-in person, from the Supabase session the app sends. */
async function currentUser(req: Request, env: Env, fetchImpl: Fetch): Promise<string> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to connect a bank.')
  const res = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: env.SUPABASE_SERVICE_ROLE_KEY! } })
  if (!res.ok) throw new HttpError(401, 'Your session expired. Sign in again.')
  const user = (await res.json()) as { id?: string }
  if (!user.id) throw new HttpError(401, 'Sign in to connect a bank.')
  return user.id
}

function plaidClient(env: Env, fetchImpl: Fetch) {
  const host = env.PLAID_ENV === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com'
  // deno-lint-ignore no-explicit-any
  return async (path: string, body: Record<string, unknown>): Promise<any> => {
    const res = await fetchImpl(host + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const code = data.error_code as string | undefined
      if (code === 'ITEM_LOGIN_REQUIRED') throw new HttpError(409, 'Your bank needs you to sign in again. Disconnect it and connect it again.')
      throw new HttpError(502, data.display_message || data.error_message || 'Plaid returned an error.')
    }
    return data
  }
}

interface ItemRow {
  item_id: string
  access_token: string
  institution_name: string | null
  cursor: string | null
}

/** PostgREST with the service role, always filtered to one person's rows. */
function dbClient(env: Env, fetchImpl: Fetch, userId: string) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY!
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  // Legacy service-role keys are JWTs and go in Authorization too; new sb_secret_ keys don't.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  const base = `${env.SUPABASE_URL}/rest/v1/plaid_items`
  const mine = `user_id=eq.${encodeURIComponent(userId)}`
  const call = async (url: string, init: RequestInit = {}) => {
    const res = await fetchImpl(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } })
    if (!res.ok) throw new HttpError(500, `Database error (${res.status}). Did you run supabase/migrations/0002_plaid.sql?`)
    // Writes with `return=minimal` reply 201/204 with an empty body.
    const text = await res.text()
    return text ? JSON.parse(text) : null
  }
  return {
    select: (cols: string) => call(`${base}?${mine}&select=${cols}&order=created_at`) as Promise<Record<string, unknown>[]>,
    async one(itemId: string): Promise<ItemRow> {
      if (!itemId) throw new HttpError(400, 'Missing item_id.')
      const rows = (await call(`${base}?${mine}&item_id=eq.${encodeURIComponent(itemId)}&select=item_id,access_token,institution_name,cursor`)) as ItemRow[]
      if (!rows.length) throw new HttpError(404, 'That bank isn’t connected.')
      return rows[0]
    },
    upsert: (row: Record<string, unknown>) =>
      call(`${base}?on_conflict=item_id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) }),
    update: (itemId: string, patch: Record<string, unknown>) =>
      call(`${base}?${mine}&item_id=eq.${encodeURIComponent(itemId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) }),
    remove: (itemId: string) => call(`${base}?${mine}&item_id=eq.${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
  }
}

// deno-lint-ignore no-explicit-any
function toTransaction(t: any): BankTransaction {
  return {
    id: t.transaction_id,
    date: t.date,
    name: t.merchant_name || t.name || 'Transaction',
    amount: t.amount,
    pending: !!t.pending,
    category: t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary ?? '',
    account_id: t.account_id,
  }
}

// deno-lint-ignore no-explicit-any
function toAccount(a: any): BankAccount {
  return {
    id: a.account_id,
    name: a.official_name || a.name,
    mask: a.mask ?? null,
    type: a.type,
    subtype: a.subtype ?? null,
    current: a.balances?.current ?? null,
    available: a.balances?.available ?? null,
  }
}

// Supabase Edge Runtime entry point. (The handler above is plain TypeScript so it can be tested
// without Deno.)
// deno-lint-ignore no-explicit-any
const deno = (globalThis as any).Deno
if (deno?.serve) {
  deno.serve((req: Request) =>
    handle(req, {
      PLAID_CLIENT_ID: deno.env.get('PLAID_CLIENT_ID'),
      PLAID_SECRET: deno.env.get('PLAID_SECRET'),
      PLAID_ENV: deno.env.get('PLAID_ENV'),
      PLAID_REDIRECT_URI: deno.env.get('PLAID_REDIRECT_URI'),
      SUPABASE_URL: deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    }),
  )
}
