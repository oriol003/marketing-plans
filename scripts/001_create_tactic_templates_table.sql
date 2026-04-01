-- Create tactic_templates table for reusable marketing tactic templates
create table if not exists public.tactic_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  category text not null,
  default_hours integer not null default 0,
  default_duration integer not null default 7,
  icon text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.tactic_templates enable row level security;

-- Allow everyone to read tactic templates (they're shared across all users)
create policy "tactic_templates_select_all"
  on public.tactic_templates for select
  using (true);

-- For now, allow anyone to insert/update/delete templates
-- In production, you might want to restrict this to admins only
create policy "tactic_templates_insert_all"
  on public.tactic_templates for insert
  with check (true);

create policy "tactic_templates_update_all"
  on public.tactic_templates for update
  using (true);

create policy "tactic_templates_delete_all"
  on public.tactic_templates for delete
  using (true);

-- Create index for faster category searches
create index if not exists tactic_templates_category_idx on public.tactic_templates(category);
