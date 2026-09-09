-- Sponsorship orders created by Stripe Checkout (subscription mode). Rows are
-- written only by the webhook and the thank-you page reconciliation, and read
-- by the site to render the sponsor bar, featured cards and detail tiles.
create table public.ad_orders (
 stripe_session_id text primary key,
 stripe_subscription_id text unique,
 stripe_customer_id text,
 customer_email text,
 placement text not null check(placement in ('bar','card','both')),
 product text not null,
 tagline text not null,
 description text not null default '',
 cta text not null default '',
 url text not null,
 status text not null default 'active' check(status in ('active','past_due','canceled','incomplete')),
 livemode boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.ad_orders enable row level security;
revoke all on public.ad_orders from anon,authenticated;
grant all on public.ad_orders to service_role;
