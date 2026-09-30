-- Banks connected through Plaid. Only the `plaid` Edge Function reads or writes this table
-- (with the service role); row-level security with no policies keeps access tokens away
-- from the app and from other users.
create table if not exists public.plaid_items (
  item_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  institution_name text,
  -- Where /transactions/sync left off; saved only after the person imports.
  cursor text,
  created_at timestamptz not null default now()
);

create index if not exists plaid_items_user_id on public.plaid_items (user_id);

alter table public.plaid_items enable row level security;
-- No policies on purpose: signed-in users cannot select, insert, update or delete rows directly.
