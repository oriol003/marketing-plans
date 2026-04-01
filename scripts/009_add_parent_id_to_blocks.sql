-- Add parent_id column to blocks table for nesting
alter table public.blocks add column if not exists parent_id uuid references public.blocks(id) on delete cascade;

-- Update block type check constraint to include 'section' type
alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in ('text', 'tactic', 'table', 'timeline', 'section'));

-- Create index for parent-child queries
create index if not exists blocks_parent_id_idx on public.blocks(parent_id);

-- Update the order to be unique within a parent context
create unique index if not exists blocks_plan_parent_order_idx on public.blocks(plan_id, coalesce(parent_id::text, 'root'), "order");
drop index if exists blocks_plan_order_idx;
