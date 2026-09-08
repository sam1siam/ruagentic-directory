-- Unpublished (withdrawn) listings stay hidden but remain editable, checkable
-- and republishable by their owner. Only suspended listings are locked.
-- Listing reports survive the deletion of the listing they describe.

create or replace function public.publish_submission(p_owner uuid,p_id uuid,p_revision integer,p_method text,p_evidence uuid) returns public.directory_entries language plpgsql security definer set search_path='' as $$
declare s public.submissions;a public.audit_runs;c public.checkout_attempts;e public.directory_entries;event_id uuid;recipient text;checked timestamptz; begin
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.state='suspended' then raise exception 'submission_unavailable';end if;
 if s.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if exists(select 1 from public.publication_events where submission_id=s.id and revision=s.revision) then
 -- This revision was already published with verified evidence; republishing only restores
 -- visibility after an unpublish. A duplicate call for a visible entry changes nothing.
 update public.directory_entries set visible=true,updated_at=now() where submission_id=s.id and not visible returning * into e;
 if not found then select * into e from public.directory_entries where submission_id=s.id;end if;
 update public.submissions set state='published',updated_at=now() where id=s.id and state='withdrawn';
 return e;end if;
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

create or replace function public.begin_checkout(p_owner uuid,p_id uuid,p_revision integer,p_terms text) returns public.checkout_attempts language plpgsql security definer set search_path='' as $$
declare s public.submissions;c public.checkout_attempts;begin
 select * into s from public.submissions where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'submission_not_found';end if;
 if s.revision is distinct from p_revision then raise exception 'revision_conflict';end if;
 if s.state='suspended' then raise exception 'submission_unavailable';end if;
 select * into c from public.checkout_attempts where submission_id=s.id and identity_key=s.identity_key and state='paid' order by paid_at limit 1;
 if found then return c;end if;
 select * into c from public.checkout_attempts where submission_id=s.id and state in ('creating','open') for update;
 if found then return c;end if;
 insert into public.checkout_attempts(submission_id,revision,identity_key,terms_version) values(s.id,s.revision,s.identity_key,p_terms) returning * into c;return c;
end;$$;

alter table public.listing_reports drop constraint listing_reports_slug_fkey;
alter table public.listing_reports add constraint listing_reports_slug_fkey foreign key(slug) references public.directory_entries(slug) on delete set null;
