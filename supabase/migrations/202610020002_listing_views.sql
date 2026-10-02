-- Listing page views, one row per listing per UTC day. Written only through
-- bump_listing_view from the server; read by the owner's dashboard.
create table if not exists public.listing_views (
  slug text not null,
  day date not null,
  views integer not null default 0,
  primary key (slug, day)
);
create index if not exists listing_views_day on public.listing_views(day);
alter table public.listing_views enable row level security;
revoke all on public.listing_views from anon, authenticated;
grant all on public.listing_views to service_role;
create or replace function public.bump_listing_view(p_slug text) returns void
language sql security definer set search_path = '' as $$
  insert into public.listing_views(slug, day, views)
  values (p_slug, (now() at time zone 'utc')::date, 1)
  on conflict (slug, day) do update set views = public.listing_views.views + 1;
$$;
revoke execute on function public.bump_listing_view(text) from public, anon, authenticated;
grant execute on function public.bump_listing_view(text) to service_role;
