-- Private discovery and outreach ledger. No rows are exposed through public APIs.
create table if not exists public.discovery_sources (
  source text primary key,
  initialized_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  seen_keys jsonb not null default '[]'::jsonb,
  item_count integer not null default 0
);
create table if not exists public.discovery_candidates (
  id text primary key,
  source text not null,
  source_id text not null,
  first_seen_at timestamptz not null default now(),
  published_at timestamptz,
  data jsonb not null,
  status text not null default 'pending',
  reason text,
  contact jsonb,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(source,source_id)
);
create index if not exists discovery_candidates_pending on public.discovery_candidates(status,first_seen_at);
create table if not exists public.discovery_runs (
  day text primary key,
  owner uuid not null,
  lease_until timestamptz not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  report jsonb
);
create table if not exists public.discovery_outreach (
  project_key text primary key,
  company_domain text not null unique,
  email text not null unique,
  candidate_id text not null references public.discovery_candidates(id),
  campaign_id bigint not null,
  status text not null default 'reserved',
  provider_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.discovery_sources enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.discovery_outreach enable row level security;
revoke all on public.discovery_sources,public.discovery_candidates,public.discovery_runs,public.discovery_outreach from anon,authenticated;
grant all on public.discovery_sources,public.discovery_candidates,public.discovery_runs,public.discovery_outreach to service_role;

create or replace function public.discovery_claim_run(p_day text,p_owner uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare claimed text;
begin
  insert into discovery_runs(day,owner,lease_until) values(p_day,p_owner,now()+interval '10 minutes')
  on conflict(day) do update set owner=excluded.owner,lease_until=excluded.lease_until,status='running'
  where discovery_runs.status <> 'completed' and discovery_runs.lease_until < now()
  returning day into claimed;
  return claimed is not null;
end $$;

-- Commit the seen-set only alongside all new candidates, after a COMPLETE source read.
create or replace function public.discovery_commit_source(p_source text,p_seen jsonb,p_candidates jsonb,p_count integer)
returns void language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  for r in select value from jsonb_array_elements(p_candidates) loop
    insert into discovery_candidates(id,source,source_id,published_at,data)
    values(r->>'id',p_source,r->>'source_id',nullif(r->>'published_at','')::timestamptz,r->'data')
    on conflict(id) do nothing;
  end loop;
  insert into discovery_sources(source,initialized_at,last_success_at,seen_keys,item_count)
  values(p_source,now(),now(),p_seen,p_count)
  on conflict(source) do update set initialized_at=coalesce(discovery_sources.initialized_at,now()),last_success_at=now(),last_error=null,seen_keys=excluded.seen_keys,item_count=excluded.item_count;
end $$;
revoke all on function public.discovery_claim_run(text,uuid) from public,anon,authenticated;
revoke all on function public.discovery_commit_source(text,jsonb,jsonb,integer) from public,anon,authenticated;
grant execute on function public.discovery_claim_run(text,uuid) to service_role;
grant execute on function public.discovery_commit_source(text,jsonb,jsonb,integer) to service_role;
