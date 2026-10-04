# Payday

A mobile-first budget that works the way you get paid: every paycheck gets its own budget, and every bill is assigned to the paycheck that lands before it's due. If a paycheck can't cover its bills and category budgets, you see **Short $X** before it happens.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # budget engine + import tests
npm run build     # typecheck + production build in dist/
```

Data is kept in `localStorage` on the device, and syncs across devices once Supabase is set up (below). A new device starts with an empty budget, with every balance at $0. A welcome checklist on the Budget page walks through entering balances, paychecks, bills and spending budgets, and offers a sample budget for anyone who wants to look around first. Settings → Your data can load the sample or clear everything.

## Deploy (Vercel)

`vercel.json` is already set up. To deploy:

1. Go to https://vercel.com/new and sign in with GitHub.
2. Import this repo. Vercel detects Vite, so leave the settings as they are.
3. Click **Deploy**.

After that, every push to the production branch redeploys, and every other branch gets its own preview URL.

## Install Payday as an app

Payday installs as a home-screen app, with its own icon and a full-screen window without browser bars.

- **iPhone or iPad:** open the site in **Safari**, tap **Share**, then **Add to Home Screen**.
- **Android:** open the site in **Chrome**, tap **⋮**, then **Install app**.

On an iPhone or iPad, the installed app keeps its own data, separate from Safari, and starts signed out. Tapping the sign-in link in the email opens Safari, not the app. So to sign in inside the app, request the email from the app's Settings, then press and hold the link in the email, tap **Copy**, and paste it into **Settings → Sync across devices → Paste your sign-in link**.

App icons are in `public/icons`. They are generated from `scripts/icon-source.png` (a square, opaque image; replace it to change the icon): `PLAYWRIGHT_PATH=<path to playwright> node scripts/make-icons.mjs`. To list Payday in the App Store or Google Play, package the live site with https://www.pwabuilder.com.

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
- Email templates can't be edited, so sign-in is link-only. In a home-screen app, paste the link instead (see above). With custom SMTP, you can also put `{{ .Token }}` in the **Confirm signup** and **Magic Link** templates so people can type a 6-digit code.

Supabase free-tier projects pause after a week without activity. Unpause the project from the dashboard if sync stops working.

## Connect your bank (Plaid)

Settings → **Connect your bank** links a bank read-only through [Plaid](https://plaid.com). The bank sign-in happens in Plaid's window, so Payday never sees bank passwords. After connecting, **Import new spending** brings in posted spending for review, in the same screen as CSV import:
- Transactions are auto-categorized, and you can edit the category before importing.
- Payments that match a bill check that bill off.
- Pending charges come in once they post. Money coming in, such as paychecks and refunds, isn't counted as spending.
- Only transactions you haven't imported come in.

**Use these as my balances** sets Checking and Savings from the bank's deposit accounts.

The Plaid secret and each bank's access token live only on the server: a Supabase Edge Function (`supabase/functions/plaid`) and a table the app can't read (`plaid_items`). Bank connections belong to the signed-in account, so set up sync first.

Setup:
1. **Plaid account:** sign up at https://dashboard.plaid.com. Under **Developers → Keys**, copy your `client_id` and your **Sandbox** secret. Sandbox is free and uses test banks.
2. **Table:** in Supabase's **SQL Editor**, run `supabase/migrations/0002_plaid.sql`.
3. **Function:** in Supabase, go to **Edge Functions → Deploy a new function → Via Editor**. Name it `plaid`, replace the sample code with the contents of `supabase/functions/plaid/index.ts`, and click **Deploy**. Then, in the function's settings, turn **Verify JWT** (or **Verify JWT with legacy secret**) **off**. The function checks the signed-in user on every request itself, and the gateway check can reject sessions on newer Supabase projects. With the Supabase CLI, you can instead run `supabase functions deploy plaid --no-verify-jwt`.
4. **Secrets:** under **Edge Functions → Secrets**, add:
   - `PLAID_CLIENT_ID`: your client id
   - `PLAID_SECRET`: your Sandbox secret
   - `PLAID_ENV`: `sandbox`
   - `PLAID_REDIRECT_URI` (optional; needed for banks that sign in on their own website, such as Chase): your site, for example `https://app-bay-rho-90.vercel.app/`. Add the same address under **Developers → API → Allowed redirect URIs** in Plaid.
5. **Try it:** in Payday, go to **Settings → Connect your bank → Connect a bank**. If Plaid asks for a phone number, skip it. Choose **First Platypus Bank** (not an "OAuth" test bank unless `PLAID_REDIRECT_URI` is set), then sign in with username `user_good` and password `pass_good`. A new connection's transactions can take a minute or two to appear; tap **Import new spending** again if the first check finds none. The test data is fake, so close the review without importing and disconnect the test bank afterwards.

**Real banks:** request Production access in the Plaid dashboard. Plaid reviews the request, and live data may cost money depending on your plan. Once approved, change `PLAID_ENV` to `production` and `PLAID_SECRET` to your Production secret. Nothing in the app changes.

The function's tests (`supabase/functions/plaid/index.test.ts`) run with `npm test` against fake Plaid and Supabase services.

## What's in it

- **Budget.** Running Checking, Savings and Total balances (tap one to set it), a month switcher, a "Left to spend" hero with a progress ring, and one card per paycheck. Each card has Short/free pills, category bars that turn red when over budget, and bill check-offs. Bills assigned to a paycheck in Settings are marked "assigned in Settings".
- **Calendar.** A compact month grid with dots for paydays, bills, reminders and unfinished tasks. Tap a day to see its paycheck, bills, reminders and tasks. Below it, a to-do list: tasks with an optional due date (a selected day becomes the new task's due date).
- **Reminders.** An agenda of what's coming up, grouped into Overdue, Today, Tomorrow, each day this week, and Later. Unpaid bills due this week and your reminders are marked with colored dots. Finished reminders go to a collapsible Completed list. Local notifications work too (a service worker handles them once the app is installed).
- **Settings.** 6 preset accents plus a custom color, light/dark/auto, account balances, and editors for paychecks, categories and bills. Each bill can be assigned to a specific paycheck and given a type: Bill, Subscription, Savings, Debt, or one you add. Also: shared budgets with rent-split tracking, CSV / Google Sheets import, bank connection, template links and data reset.
- **Add expense (+).** A bottom sheet with amount, category chips, an optional note and a date.
- **Edit spending.** Tap any expense under Recent spending to change its category, amount, note or date, or delete it. A banner counts the month's uncategorized charges and filters the list to them. Giving one a category offers to do the same for other uncategorized charges from that merchant, and later imports from that merchant use it (`src/lib/expenses.ts`). If a charge paid a bill, pick the bill under **Did this pay a bill?**: the bill's nearest unpaid month is checked off, the charge leaves spending (balances stay the same), and later imports from that merchant check the bill off whatever the amount.
- **Privacy policy.** `public/privacy.html`, served at `/privacy` and linked from Settings and the bank connection.
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

A bill is paid from the latest payday on or before its due date. A bill that's due before the month's first payday falls to the previous month's last paycheck. A bill assigned to a paycheck in Settings comes out of the last payday of that paycheck on or before its due date, every month. Every item appears under exactly one paycheck. If the paycheck a bill is assigned to is deleted, the bill goes back to automatic. One-month moves made in earlier versions still apply until you tap **Move back**. The logic lives in `src/lib/budget.ts` and is covered by `src/lib/budget.test.ts`.

### Import

CSV columns are `date, name, category, amount`. The header is optional, and when present, columns can be in any order. Rows are auto-categorized (from the category label first, then merchant keywords) and can be edited before import. A row that matches a bill by name and amount (within 10%) checks that bill off instead of counting as spending. Google Sheets import works for sheets shared as "Anyone with the link".

## Roadmap

- Live shared households (roommates see the same split bills) and email alerts
- Automatic bank imports in the background (today you tap **Import new spending**)
