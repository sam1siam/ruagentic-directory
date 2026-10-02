-- Public repository metrics behind the leaderboards. Written only by the
-- metrics cron through the service role; nothing here is editable by users.
create table if not exists public.listing_metrics (
  slug text primary key,
  repository text not null,
  stars integer not null default 0,
  forks integer not null default 0,
  watchers integer not null default 0,
  open_issues integer not null default 0,
  pushed_at timestamptz,
  fetched_at timestamptz not null default now(),
  error text
);
create index if not exists listing_metrics_fetched on public.listing_metrics(fetched_at);
create index if not exists listing_metrics_stars on public.listing_metrics(stars desc);
alter table public.listing_metrics enable row level security;
