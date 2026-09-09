-- Sponsorship approval, report resolution and an admin action log. Sponsor
-- placements render only once a reviewer approves the creative; the site
-- promises a decision within 24-48 hours.
alter table public.ad_orders add column if not exists approval text not null default 'pending';
alter table public.ad_orders drop constraint if exists ad_orders_approval_check;
alter table public.ad_orders add constraint ad_orders_approval_check check(approval in ('pending','approved','rejected'));
alter table public.ad_orders add column if not exists reviewed_at timestamptz;
alter table public.ad_orders add column if not exists reviewed_by text;
alter table public.ad_orders add column if not exists review_note text not null default '';

alter table public.listing_reports add column if not exists resolved_at timestamptz;
alter table public.listing_reports add column if not exists resolution text not null default '';

create table if not exists public.admin_actions (
 id uuid primary key default gen_random_uuid(),
 actor text not null,
 action text not null,
 target text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon,authenticated;
grant all on public.admin_actions to service_role;
