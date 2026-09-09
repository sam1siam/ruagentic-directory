-- Sponsors manage their own orders from the account dashboard: orders belong
-- to the buying account, and edits to an approved creative wait in `pending`
-- until a reviewer applies them.
alter table public.ad_orders add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.ad_orders add column if not exists pending jsonb;
create index if not exists ad_orders_owner_idx on public.ad_orders(owner_id);
