-- Scheduled fact checks for imported listings (links, repositories, registry
-- records) and admin overrides that hide a bundled entry without a deploy.
create table if not exists public.listing_checks (
 slug text primary key,
 checked_at timestamptz not null default now(),
 status text not null check(status in ('ok','warn','broken')),
 issues jsonb not null default '[]'::jsonb,
 links jsonb not null default '{}'::jsonb,
 repo jsonb,
 registry jsonb
);
create table if not exists public.catalog_overrides (
 slug text primary key,
 hidden boolean not null default false,
 note text not null default '',
 updated_by text,
 updated_at timestamptz not null default now()
);
alter table public.listing_checks enable row level security;
alter table public.catalog_overrides enable row level security;
revoke all on public.listing_checks,public.catalog_overrides from anon,authenticated;
grant all on public.listing_checks,public.catalog_overrides to service_role;
