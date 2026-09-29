-- One budget per signed-in user, stored as a single JSON document.
create table if not exists public.budgets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  -- Which device wrote this version, so a device can ignore its own changes coming back.
  client_id text,
  updated_at timestamptz not null default now()
);

-- Each user can only see and change their own budget.
alter table public.budgets enable row level security;

drop policy if exists "Read own budget" on public.budgets;
create policy "Read own budget" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Create own budget" on public.budgets;
create policy "Create own budget" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own budget" on public.budgets;
create policy "Update own budget" on public.budgets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The server stamps every save, so devices with different clocks agree on what's newest.
create or replace function public.budgets_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists budgets_touch_updated_at on public.budgets;
create trigger budgets_touch_updated_at
  before insert or update on public.budgets
  for each row execute function public.budgets_touch_updated_at();

-- Push changes to other open devices as they happen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets'
  ) then
    alter publication supabase_realtime add table public.budgets;
  end if;
end;
$$;
