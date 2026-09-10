-- Duplicate handling: a merged listing's old address redirects to the
-- surviving listing, and pairs the admin decided to keep apart are recorded
-- so they leave the review queue.
create table if not exists public.listing_redirects (
 slug text primary key,
 target text not null,
 note text not null default '',
 created_by text,
 created_at timestamptz not null default now()
);
create table if not exists public.duplicate_dismissals (
 pair text primary key,
 note text not null default '',
 created_by text,
 created_at timestamptz not null default now()
);
alter table public.listing_redirects enable row level security;
alter table public.duplicate_dismissals enable row level security;
revoke all on public.listing_redirects,public.duplicate_dismissals from anon,authenticated;
grant all on public.listing_redirects,public.duplicate_dismissals to service_role;
