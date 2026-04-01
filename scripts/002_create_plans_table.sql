-- Create plans table for storing marketing plans
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  objective text not null,
  client_name text not null,
  start_date date,
  budget numeric(10, 2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.plans enable row level security;

-- For now, allow anyone to manage plans
-- In a production app with auth, you'd restrict to auth.uid()
create policy "plans_select_all"
  on public.plans for select
  using (true);

create policy "plans_insert_all"
  on public.plans for insert
  with check (true);

create policy "plans_update_all"
  on public.plans for update
  using (true);

create policy "plans_delete_all"
  on public.plans for delete
  using (true);

-- Create index for faster client_name searches
create index if not exists plans_client_name_idx on public.plans(client_name);
create index if not exists plans_created_at_idx on public.plans(created_at desc);
