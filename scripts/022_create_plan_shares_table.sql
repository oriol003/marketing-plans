-- Create plan_shares table for public sharing and approval workflow
create table if not exists public.plan_shares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  share_token text unique not null,
  is_active boolean default true,
  approval_status text default 'pending' check (approval_status in ('pending', 'approved', 'changes_requested')),
  approver_name text,
  approver_email text,
  approval_notes text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.plan_shares enable row level security;

-- Allow anyone to read active shares (for public access)
create policy "plan_shares_select_all"
  on public.plan_shares for select
  using (is_active = true);

-- Allow anyone to create shares
create policy "plan_shares_insert_all"
  on public.plan_shares for insert
  with check (true);

-- Allow anyone to update shares (for approval workflow)
create policy "plan_shares_update_all"
  on public.plan_shares for update
  using (true);

-- Create indexes for faster lookups
create index if not exists plan_shares_token_idx on public.plan_shares(share_token);
create index if not exists plan_shares_plan_id_idx on public.plan_shares(plan_id);
create index if not exists plan_shares_status_idx on public.plan_shares(approval_status);
