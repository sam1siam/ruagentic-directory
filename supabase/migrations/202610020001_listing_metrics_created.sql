-- The repository's creation time, for the "fastest since launch" board
-- (stars per day since the repository was created).
alter table public.listing_metrics add column if not exists created_at timestamptz;
