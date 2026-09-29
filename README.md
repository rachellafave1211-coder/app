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
