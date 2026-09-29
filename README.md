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

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_budgets.sql`, and click **Run**. This creates the `budgets` table, locks each budget to its owner, and turns on live updates.
3. Optional, but recommended for phones: add the sign-in code to the email (see the iPhone note below).
4. Under **Authentication → URL Configuration**, set **Site URL** to your site (for example `https://app-bay-rho-90.vercel.app`). Also add `http://localhost:5173` under **Redirect URLs** if you run it locally.
5. Under **Project Settings → API**, copy the **Project URL** and the **anon public** key.
6. Add them as environment variables:
   - On Vercel: Project → Settings → Environment Variables. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy.
   - Locally: copy `.env.example` to `.env` and fill it in.

The anon key is meant to be public. Row-level security in the SQL above keeps each person's budget private.

How it works:
- People sign in from Settings → Sync across devices with an emailed link. There's no password.
- The whole budget syncs, because balances come from paychecks, expenses and checked-off bills. Alert settings stay on each device.
- Changes save automatically and show up on other open devices right away. Devices that were offline catch up when they reconnect or reopen.
- If a device and the account both changed, Payday shows both versions and asks which to keep, instead of overwriting one. It also asks the first time a device signs in and its budget differs from the account's.
- Signing out keeps the budget on that device.

Supabase free-tier projects pause after a week without activity. Unpause the project from the dashboard if sync stops working.

On an iPhone home-screen install, the email link opens in Safari, which doesn't sign in the installed app. To make sign-in work there, add the code to the email: in Supabase, go to **Authentication → Emails → Magic Link** and add a line such as `Or enter this code: {{ .Token }}` to the template. People then type the code in Settings.

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
