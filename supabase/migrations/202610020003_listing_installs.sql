-- CLI installs, one row per listing per client per UTC day. Written only
-- through bump_listing_install from the server; read by the owner's dashboard.
create table if not exists public.listing_installs (
  slug text not null,
  day date not null,
  client text not null default '',
  installs integer not null default 0,
  primary key (slug, day, client)
);
alter table public.listing_installs enable row level security;
revoke all on public.listing_installs from anon, authenticated;
grant all on public.listing_installs to service_role;
create or replace function public.bump_listing_install(p_slug text, p_client text) returns void
language sql security definer set search_path = '' as $$
  insert into public.listing_installs(slug, day, client, installs)
  values (p_slug, (now() at time zone 'utc')::date, coalesce(p_client, ''), 1)
  on conflict (slug, day, client) do update set installs = public.listing_installs.installs + 1;
$$;
revoke execute on function public.bump_listing_install(text, text) from public, anon, authenticated;
grant execute on function public.bump_listing_install(text, text) to service_role;
