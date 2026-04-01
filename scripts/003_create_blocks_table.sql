-- Create blocks table for storing plan content blocks
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  type text not null check (type in ('text', 'tactic')),
  "order" integer not null default 0,
  
  -- Common fields
  title text not null,
  content text not null default '',
  
  -- Tactic-specific fields
  tactic_template_id uuid references public.tactic_templates(id) on delete set null,
  description text,
  hours integer default 0,
  start_date date,
  end_date date,
  icon text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.blocks enable row level security;

-- Allow anyone to manage blocks
create policy "blocks_select_all"
  on public.blocks for select
  using (true);

create policy "blocks_insert_all"
  on public.blocks for insert
  with check (true);

create policy "blocks_update_all"
  on public.blocks for update
  using (true);

create policy "blocks_delete_all"
  on public.blocks for delete
  using (true);

-- Create indexes for faster queries
create index if not exists blocks_plan_id_idx on public.blocks(plan_id);
create index if not exists blocks_plan_order_idx on public.blocks(plan_id, "order");
