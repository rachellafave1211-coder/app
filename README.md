# Payday

A mobile-first budget that works the way you get paid: every paycheck gets its own budget, and every bill is assigned to the paycheck that lands before it's due. If a paycheck can't cover its bills and category budgets, you see **Short $X** before it happens.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # budget engine + import tests
npm run build     # typecheck + production build in dist/
```

This version keeps all data in `localStorage` on the device. It opens with a sample budget, which you can edit or clear from Settings.

## Deploy (Vercel)

`vercel.json` is already set up. To deploy:

1. Go to https://vercel.com/new and sign in with GitHub.
2. Import this repo. Vercel detects Vite, so leave the settings as they are.
3. Click **Deploy**.

After that, every push to the production branch redeploys, and every other branch gets its own preview URL.

## Sync across devices (Supabase)

Payday works without an account. To keep a budget and its balances the same on several devices, connect a free Supabase project:

1. Create a project at https://supabase.com/dashboard. You'll be asked to create an organization first; a personal one on the Free plan is fine.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_budgets.sql`, and click **Run**. Supabase warns that the query is "destructive" because of its `drop … if exists` lines. That's expected: they only replace Payday's own policies and trigger so the script can be run again. You should see "Success. No rows returned."
3. Under **Authentication → URL Configuration**, set **Site URL** to your site, for example `https://app-bay-rho-90.vercel.app`.
4. Copy two values from **Project Settings**:
   - **Project URL**, under **Data API** (or the **Connect** button). Use just `https://<your-project>.supabase.co`, with nothing after it.
   - **Publishable key** (starts with `sb_publishable_`), under **API Keys**. The legacy **anon public** key works too. Never use a **secret** or **service_role** key.
5. Add them as environment variables:
   - On Vercel, go to Project → Settings → Environment Variables → **Add Environment Variable**. Choose type **Config** (the values are public by design), and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then redeploy: Vite reads them at build time.
   - Locally, copy `.env.example` to `.env` and fill it in.

Row-level security in the SQL above keeps each person's budget private, so it's safe for these values to be public.

If a value is wrong, the app still loads, and Settings → Sync across devices says which setting to fix.

How it works:
- People sign in from Settings → Sync across devices with an emailed link. There's no password.
- The whole budget syncs, because balances come from paychecks, expenses and checked-off bills. Alert settings stay on each device.
- Changes save automatically and show up on other open devices right away. Devices that were offline catch up when they reconnect or reopen.
- If a device and the account both changed, Payday shows both versions and asks which to keep, instead of overwriting one. It also asks the first time a device signs in and its budget differs from the account's.
- Signing out keeps the budget on that device.

Limits of Supabase's built-in email sender (connect your own SMTP service under Authentication settings to remove them):
- It only sends to members of your Supabase organization, so sign in with the email you signed up to Supabase with.
- It sends only a few emails per hour.
- Email templates can't be edited. So sign-in is link-only, and an iPhone home-screen install can't sign in, because the link opens in Safari instead of the installed app. Use Payday in Safari, or add custom SMTP and put `{{ .Token }}` in the **Confirm signup** and **Magic Link** templates so people can type the 6-digit code in Settings.

Supabase free-tier projects pause after a week without activity. Unpause the project from the dashboard if sync stops working.

## What's in it

- **Budget.** Running Checking, Savings and Total balances (tap one to set it), a month switcher, a "Left to spend" hero with a progress ring, and one card per paycheck. Each card has Short/free pills, category bars that turn red when over budget, and bill check-offs. The ↪ button moves a bill to the next paycheck, and "undo" puts it back.
- **Calendar.** A month grid that fills the page. Phones show dots for paydays, bills and reminders; wider screens show their names. Tap a day to see what's on it (beside the grid on desktop).
- **Reminders.** Your own dated reminders, bills due in the next 7 days, and local notifications (a service worker handles them once the app is installed).
- **Settings.** 6 preset accents plus a custom color, light/dark/auto, account balances, and editors for paychecks, categories and bills. Also: shared budgets with rent-split tracking, CSV / Google Sheets import, the bank card, template links and data reset.
- **Add expense (+).** A bottom sheet with amount, category chips, an optional note and a date.
- **Sharing.**
  - A *Paycheck Wrapped* recap image in your theme colors that shows percentages only.
  - Budget-template links (dollar amounts are optional) and household invite links.
  - Links carry their data in the URL hash and ask for confirmation before anything is applied.

### Balances

You enter what's in Checking and Savings now, and Payday keeps them current from there:
- Checking goes up on each payday after the day you set it.
- Checking goes down when you log an expense or check off a bill.
- Checking off a savings item moves its amount from Checking to Savings.

Un-checking a bill or deleting an expense reverses its effect. Anything dated or checked off before you set the balance is treated as already included. Covered by `src/lib/budget.test.ts`.

### How bills are assigned

A bill is paid from the latest payday on or before its due date. A bill that's due before the month's first payday falls to the previous month's last paycheck. Moving a bill (↪) shifts only that month's occurrence. The logic lives in `src/lib/budget.ts` and is covered by `src/lib/budget.test.ts`.

### Import

CSV columns are `date, name, category, amount`. The header is optional, and when present, columns can be in any order. Rows are auto-categorized (from the category label first, then merchant keywords) and can be edited before import. A row that matches a bill by name and amount (within 10%) checks that bill off instead of counting as spending. Google Sheets import works for sheets shared as "Anyone with the link".

## Roadmap

- Supabase auth + sync (live shared households, email alerts)
- Plaid read-only bank linking, reusing the import pipeline (auto-categorize → review → bill matching)
