-- Discarding a listing the owner no longer wants: drafts and unpublished
-- listings only. Imports that were merged into it come back; anything with
-- a payment on record stays (unpublish instead) so payment history is kept.
create or replace function public.discard_submission(p_owner uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.submissions;
begin
  select * into s from public.submissions where id = p_id and owner_id = p_owner for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.state not in ('editing', 'withdrawn') then raise exception 'submission_not_discardable'; end if;
  if exists (select 1 from public.checkout_attempts where submission_id = s.id and state in ('creating', 'open')) then
    raise exception 'checkout_in_progress';
  end if;
  if exists (select 1 from public.checkout_attempts where submission_id = s.id and state = 'paid') then
    raise exception 'submission_has_payment';
  end if;
  if s.slug is not null then
    update public.directory_entries set visible = true, updated_at = now()
      where submission_id is null
        and slug in (select slug from public.listing_redirects where target = s.slug);
    delete from public.catalog_overrides
      where slug in (select slug from public.listing_redirects where target = s.slug);
    delete from public.listing_redirects where target = s.slug or slug = s.slug;
  end if;
  -- Cascades to revisions, audit runs, checkout attempts and the directory entry.
  delete from public.submissions where id = s.id;
end;
$$;
revoke execute on function public.discard_submission(uuid, uuid) from public, anon, authenticated;
grant execute on function public.discard_submission(uuid, uuid) to service_role;
