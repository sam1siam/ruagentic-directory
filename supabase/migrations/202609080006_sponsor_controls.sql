-- Admin controls for sponsor placements: manual ordering, hide/show, and a
-- settings table for the top-bar rotation interval.
alter table public.ad_orders add column if not exists hidden boolean not null default false;
alter table public.ad_orders add column if not exists position integer;

create table if not exists public.site_settings (
 key text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon,authenticated;
grant all on public.site_settings to service_role;
