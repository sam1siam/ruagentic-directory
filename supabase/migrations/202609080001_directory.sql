create extension if not exists pgcrypto;

create table public.submissions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb, revision integer not null default 1 check(revision>0), identity_key text not null,
 state text not null default 'editing' check(state in ('editing','published','withdrawn','suspended')),
 slug text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(owner_id,identity_key)
);
create table public.submission_revisions (
 submission_id uuid references public.submissions(id) on delete cascade, revision integer not null, payload jsonb not null, identity_key text not null,
 created_at timestamptz not null default now(), primary key(submission_id,revision)
);
create table public.audit_runs (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions(id) on delete cascade,
 revision integer not null, identity_key text not null, profile_url text not null, readme_url text, report jsonb not null,
 eligible boolean not null, policy_version text not null default '1', checked_at timestamptz not null default now()
);
create table public.checkout_attempts (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions(id) on delete cascade,
 revision integer not null, identity_key text not null, stripe_session_id text unique, stripe_payment_id text unique,
 state text not null default 'creating' check(state in ('creating','open','paid','expired','failed','refunded','disputed')),
 amount integer not null default 4999 check(amount=4999), currency text not null default 'usd' check(currency='usd'),
 terms_version text not null, consent_at timestamptz not null default now(), created_at timestamptz not null default now(), expires_at timestamptz,
 checkout_url text, paid_at timestamptz
);
create unique index one_open_checkout on public.checkout_attempts(submission_id) where state in ('creating','open');
create table public.directory_entries (
 slug text primary key, submission_id uuid unique references public.submissions(id) on delete cascade,
 data jsonb not null, visible boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.publication_events (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions(id) on delete cascade,
 revision integer not null, method text not null check(method in ('payment','agentic')), evidence_id uuid not null,
 created_at timestamptz not null default now(), unique(submission_id,revision)
);
create table public.email_outbox (
 id uuid primary key default gen_random_uuid(), event_id uuid unique not null references public.publication_events(id) on delete cascade,
 recipient text not null, payload jsonb not null, state text not null default 'pending' check(state in ('pending','sending','sent','failed','uncertain')),
 attempts integer not null default 0, lease_until timestamptz, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
 provider_id text, provider_request jsonb, lease_token uuid, last_error text, created_at timestamptz not null default now()
);
create table public.webhook_events (id text primary key, type text not null, payload jsonb not null, processed_at timestamptz, created_at timestamptz not null default now());
create table public.payment_revocations(payment_id text primary key,state text not null check(state in ('refunded','disputed')),event_id text not null,created_at timestamptz not null default now());
create table public.rate_limits (key text primary key, hits integer not null, reset_at timestamptz not null);
create table public.bookmarks (owner_id uuid references auth.users(id) on delete cascade, slug text references public.directory_entries(slug) on delete cascade, created_at timestamptz not null default now(), primary key(owner_id,slug));
create table public.listing_reports (id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id) on delete set null, slug text references public.directory_entries(slug), reason text not null check(length(reason) between 10 and 2000), state text not null default 'open', created_at timestamptz not null default now());

alter table public.submissions enable row level security;
alter table public.submission_revisions enable row level security;
alter table public.audit_runs enable row level security;
alter table public.checkout_attempts enable row level security;
alter table public.directory_entries enable row level security;
alter table public.publication_events enable row level security;
alter table public.email_outbox enable row level security;
alter table public.webhook_events enable row level security;
alter table public.payment_revocations enable row level security;
revoke all on public.payment_revocations from anon,authenticated;
alter table public.rate_limits enable row level security;
alter table public.bookmarks enable row level security;
alter table public.listing_reports enable row level security;
revoke all on public.submissions,public.submission_revisions,public.audit_runs,public.checkout_attempts,public.directory_entries,public.publication_events,public.email_outbox,public.webhook_events,public.rate_limits,public.bookmarks,public.listing_reports from anon,authenticated;
grant select on public.directory_entries to anon,authenticated;
grant select on public.submissions,public.audit_runs,public.checkout_attempts,public.bookmarks to authenticated;
grant insert,delete on public.bookmarks to authenticated;
grant all on all tables in schema public to service_role;
create policy public_entries on public.directory_entries for select using(visible);
create policy own_submissions on public.submissions for select to authenticated using(owner_id=(select auth.uid()));
create policy own_audits on public.audit_runs for select to authenticated using(exists(select 1 from public.submissions s where s.id=submission_id and s.owner_id=(select auth.uid())));
create policy own_checkouts on public.checkout_attempts for select to authenticated using(exists(select 1 from public.submissions s where s.id=submission_id and s.owner_id=(select auth.uid())));
create policy own_bookmarks on public.bookmarks for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

create function public.consume_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare total integer; begin
 insert into public.rate_limits(key,hits,reset_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when public.rate_limits.reset_at<=now() then 1 else public.rate_limits.hits+1 end, reset_at=case when public.rate_limits.reset_at<=now() then excluded.reset_at else public.rate_limits.reset_at end returning hits into total;
 return total<=p_limit;end;$$;

create function public.save_submission(p_owner uuid,p_id uuid,p_revision integer,p_payload jsonb,p_identity text) returns public.submissions language plpgsql security definer set search_path='' as $$
declare s public.submissions; begin
 if p_id is null then
 insert into public.submissions(owner_id,payload,identity_key) values(p_owner,p_payload,p_identity) returning * into s;
 else
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.state='suspended' then raise exception 'submission_suspended';end if;
 if s.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if s.slug is not null and s.identity_key<>p_identity then raise exception 'published_identity_locked';end if;
 if exists(select 1 from public.checkout_attempts where submission_id=s.id and state in ('creating','open')) then raise exception 'checkout_in_progress';end if;
 update public.submissions set payload=p_payload,identity_key=p_identity,revision=revision+1,updated_at=now() where id=s.id returning * into s;
 end if;
 insert into public.submission_revisions(submission_id,revision,payload,identity_key) values(s.id,s.revision,s.payload,s.identity_key);
 return s;end;$$;

create function public.publish_submission(p_owner uuid,p_id uuid,p_revision integer,p_method text,p_evidence uuid) returns public.directory_entries language plpgsql security definer set search_path='' as $$
declare s public.submissions;a public.audit_runs;c public.checkout_attempts;e public.directory_entries;event_id uuid;recipient text;checked timestamptz; begin
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.state in ('suspended','withdrawn') then raise exception 'submission_unavailable';end if;
 if s.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if exists(select 1 from public.publication_events where submission_id=s.id and revision=s.revision) then
 select * into e from public.directory_entries where submission_id=s.id;return e;end if;
 select email into recipient from auth.users where id=p_owner and email_confirmed_at is not null;
 if recipient is null then raise exception 'confirmed_email_required';end if;
 if p_method='agentic' then
 if exists(select 1 from public.checkout_attempts where submission_id=s.id and state in ('creating','open')) then raise exception 'checkout_in_progress';end if;
 select * into a from public.audit_runs where id=p_evidence and submission_id=s.id and revision=s.revision and identity_key=s.identity_key;
 if not found or not a.eligible or a.checked_at<now()-interval '15 minutes' then raise exception 'fresh_verification_required';end if;checked=a.checked_at;
 elsif p_method='payment' then
 select * into c from public.checkout_attempts where id=p_evidence and submission_id=s.id and identity_key=s.identity_key and state='paid' and amount=4999 and currency='usd' for update;
 if not found then raise exception 'verified_payment_required';end if;
 else raise exception 'invalid_publication_path';end if;
 if s.slug is null then s.slug:=left(trim(both '-' from regexp_replace(lower(s.payload->>'name'),'[^a-z0-9]+','-','g')),70)||'-'||left(replace(s.id::text,'-',''),10);end if;
 insert into public.directory_entries(slug,submission_id,data) values(s.slug,s.id,s.payload||jsonb_build_object('slug',s.slug,'source','User submission','sourceUrl',s.payload->>'homepage','observedAt',now(),'publishedAt',now(),'submitted',true,'agenticCheckedAt',checked,'publicationRevision',s.revision))
 on conflict(submission_id) do update set data=excluded.data,visible=true,updated_at=now() returning * into e;
 update public.submissions set state='published',slug=s.slug,updated_at=now() where id=s.id;
 insert into public.publication_events(submission_id,revision,method,evidence_id) values(s.id,s.revision,p_method,p_evidence) on conflict(submission_id,revision) do nothing returning id into event_id;
 if event_id is not null then insert into public.email_outbox(event_id,recipient,payload) values(event_id,recipient,jsonb_build_object('name',s.payload->>'name','slug',s.slug,'method',p_method));end if;
 return e;end;$$;

create function public.claim_email_jobs(p_limit integer default 10) returns setof public.email_outbox language plpgsql security definer set search_path='' as $$
begin
 update public.email_outbox set state='uncertain',last_error='Reconcile provider before retrying past the deduplication window.' where state in ('pending','sending','failed') and first_attempt_at<now()-interval '23 hours';
 return query with jobs as(select id from public.email_outbox where state in ('pending','sending','failed') and next_attempt_at<=now() and (lease_until is null or lease_until<now()) and attempts<8 order by created_at for update skip locked limit least(p_limit,20))
 update public.email_outbox o set state='sending',attempts=attempts+1,lease_token=gen_random_uuid(),first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes' from jobs where o.id=jobs.id returning o.*;
end;$$;

revoke execute on function public.consume_rate_limit(text,integer,integer),public.save_submission(uuid,uuid,integer,jsonb,text),public.publish_submission(uuid,uuid,integer,text,uuid),public.claim_email_jobs(integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.save_submission(uuid,uuid,integer,jsonb,text),public.publish_submission(uuid,uuid,integer,text,uuid),public.claim_email_jobs(integer) to service_role;

create function public.begin_checkout(p_owner uuid,p_id uuid,p_revision integer,p_terms text) returns public.checkout_attempts language plpgsql security definer set search_path='' as $$
declare s public.submissions;c public.checkout_attempts;begin
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if s.state in ('suspended','withdrawn') then raise exception 'submission_unavailable';end if;
 select * into c from public.checkout_attempts where submission_id=s.id and identity_key=s.identity_key and state='paid' order by paid_at limit 1;
 if found then return c;end if;
 select * into c from public.checkout_attempts where submission_id=s.id and state in ('creating','open') for update;
 if found then return c;end if;
 insert into public.checkout_attempts(submission_id,revision,identity_key,terms_version) values(s.id,s.revision,s.identity_key,p_terms) returning * into c;return c;
end;$$;

create function public.fulfill_checkout(p_attempt uuid,p_session text,p_payment text,p_event text,p_event_type text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.submissions;c public.checkout_attempts;e public.directory_entries;begin
 perform pg_advisory_xact_lock(hashtextextended(p_payment,0));
 select s0.* into s from public.submissions s0 join public.checkout_attempts c0 on c0.submission_id=s0.id where c0.id=p_attempt for update of s0;
 if not found then raise exception 'submission_not_found';end if;
 select * into c from public.checkout_attempts where id=p_attempt for update;
 if c.stripe_session_id is not null and c.stripe_session_id<>p_session then raise exception 'session_mismatch';end if;
 if c.state in ('refunded','disputed') or exists(select 1 from public.payment_revocations where payment_id=p_payment) then
 update public.checkout_attempts set state=coalesce((select state from public.payment_revocations where payment_id=p_payment),c.state),stripe_session_id=p_session,stripe_payment_id=p_payment where id=c.id;
 return jsonb_build_object('state','revoked');end if;
 update public.checkout_attempts set state='paid',stripe_session_id=p_session,stripe_payment_id=p_payment,paid_at=coalesce(paid_at,now()) where id=c.id;
 insert into public.webhook_events(id,type,payload,processed_at) values(p_event,p_event_type,jsonb_build_object('attempt',c.id,'session',p_session),now()) on conflict(id) do nothing;
 if s.state in ('withdrawn','suspended') or s.revision<>c.revision or s.identity_key<>c.identity_key then return jsonb_build_object('state','paid','publication','review_required');end if;
 e:=public.publish_submission(s.owner_id,s.id,s.revision,'payment',c.id);
 return jsonb_build_object('state','paid','slug',e.slug);
end;$$;

create function public.revoke_payment(p_payment text,p_state text,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare s public.submissions;c public.checkout_attempts;begin
 if p_state not in ('refunded','disputed') then raise exception 'invalid_payment_state';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_payment,0));
 insert into public.payment_revocations(payment_id,state,event_id) values(p_payment,p_state,p_event) on conflict(payment_id) do nothing;
 select s0.* into s from public.submissions s0 join public.checkout_attempts c0 on c0.submission_id=s0.id where c0.stripe_payment_id=p_payment for update of s0;
 if not found then return;end if;
 select * into c from public.checkout_attempts where stripe_payment_id=p_payment for update;
 update public.checkout_attempts set state=p_state where id=c.id;
 if exists(select 1 from public.publication_events pe join public.directory_entries de on de.submission_id=pe.submission_id where pe.submission_id=s.id and pe.revision=(de.data->>'publicationRevision')::integer and pe.method='payment' and pe.evidence_id=c.id) then
 update public.directory_entries set visible=false,updated_at=now() where submission_id=s.id;
 update public.submissions set state='suspended',updated_at=now() where id=s.id;end if;
 insert into public.webhook_events(id,type,payload,processed_at) values(p_event,p_state,jsonb_build_object('attempt',c.id),now()) on conflict(id) do nothing;
end;$$;

create function public.withdraw_submission(p_owner uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.submissions;begin
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.state='suspended' then raise exception 'submission_suspended';end if;
 if exists(select 1 from public.checkout_attempts where submission_id=s.id and state in ('creating','open')) then raise exception 'checkout_in_progress';end if;
 update public.directory_entries set visible=false,updated_at=now() where submission_id=s.id;
 update public.submissions set state='withdrawn',updated_at=now() where id=s.id;
end;$$;
revoke execute on function public.begin_checkout(uuid,uuid,integer,text),public.fulfill_checkout(uuid,text,text,text,text),public.revoke_payment(text,text,text),public.withdraw_submission(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_checkout(uuid,uuid,integer,text),public.fulfill_checkout(uuid,text,text,text,text),public.revoke_payment(text,text,text),public.withdraw_submission(uuid,uuid) to service_role;

alter table public.submission_revisions add constraint revision_identity unique(submission_id,revision,identity_key);
alter table public.audit_runs add constraint audit_revision foreign key(submission_id,revision,identity_key) references public.submission_revisions(submission_id,revision,identity_key) on delete cascade;
alter table public.checkout_attempts add constraint checkout_revision foreign key(submission_id,revision,identity_key) references public.submission_revisions(submission_id,revision,identity_key) on delete cascade;
alter table public.publication_events add constraint publication_revision foreign key(submission_id,revision) references public.submission_revisions(submission_id,revision) on delete cascade;
create function public.reject_revision_update() returns trigger language plpgsql set search_path='' as $$begin raise exception 'revision_snapshot_is_immutable';end;$$;
create trigger immutable_revision before update on public.submission_revisions for each row execute function public.reject_revision_update();
revoke execute on function public.reject_revision_update() from public,anon,authenticated;
