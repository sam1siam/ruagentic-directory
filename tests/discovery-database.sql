-- Transactional checks on the new private tables only. All fixture rows roll back.
begin;
do $$
declare n integer; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); k text:='discovery-test-'||gen_random_uuid()::text; failed boolean:=false;
begin
  select count(*) into n from pg_class where oid in ('public.discovery_sources'::regclass,'public.discovery_candidates'::regclass,'public.discovery_runs'::regclass,'public.discovery_outreach'::regclass) and relrowsecurity;
  assert n=4,'RLS must be enabled on every discovery table';
  assert not has_table_privilege('anon','public.discovery_outreach','select'),'Anonymous contact access';
  assert not has_table_privilege('authenticated','public.discovery_candidates','select'),'Authenticated contact access';
  assert not has_function_privilege('authenticated','public.discovery_claim_run(text,uuid)','execute'),'Client may claim a run';
  assert not has_function_privilege('anon','public.discovery_commit_source(text,jsonb,jsonb,integer)','execute'),'Anonymous source commit';
  assert has_function_privilege('service_role','public.discovery_claim_run(text,uuid)','execute'),'Worker lacks run permission';
  assert public.discovery_claim_run(k,a),'First worker should claim';
  assert not public.discovery_claim_run(k,b),'Concurrent worker should be excluded';
  update public.discovery_runs set lease_until=now()-interval '1 second' where day=k;
  assert public.discovery_claim_run(k,b),'Expired worker must be recoverable';
  update public.discovery_runs set status='completed' where day=k and owner=a;
  get diagnostics n=row_count;
  assert n=0,'Stale owner must not finish another worker';
  update public.discovery_runs set status='completed',lease_until=now()-interval '1 second' where day=k and owner=b;
  assert not public.discovery_claim_run(k,a),'Completed day must not be repeated';
  begin
    perform public.discovery_commit_source(k,'["fixture"]',jsonb_build_array(jsonb_build_object('id',k,'source_id','first','data','{}'::jsonb),jsonb_build_object('id',k||'-bad','source_id','second')),2);
  exception when not_null_violation then failed:=true;
  end;
  assert failed,'Malformed candidate should fail the whole checkpoint';
  assert not exists(select 1 from public.discovery_candidates where id=k),'Partial candidate write escaped rollback';
  assert not exists(select 1 from public.discovery_sources where source=k),'Partial checkpoint escaped rollback';
  perform public.discovery_commit_source(k,'["fixture"]',jsonb_build_array(jsonb_build_object('id',k,'source_id','first','data','{}'::jsonb)),1);
  perform public.discovery_commit_source(k,'["fixture"]',jsonb_build_array(jsonb_build_object('id',k,'source_id','first','data','{}'::jsonb)),1);
  select count(*) into n from public.discovery_candidates where id=k;
  assert n=1,'Repeating a completed snapshot duplicated a candidate';
  insert into public.discovery_outreach(project_key,company_domain,email,candidate_id,campaign_id) values(k,k||'.invalid','contact@'||k||'.invalid',k,3932154);
  failed:=false;
  begin
    insert into public.discovery_outreach(project_key,company_domain,email,candidate_id,campaign_id) values(k||'-other',k||'.invalid','second@'||k||'.invalid',k,3932154);
  exception when unique_violation then failed:=true;
  end;
  assert failed,'Company must have only one invitation reservation';
  failed:=false;
  begin
    insert into public.discovery_outreach(project_key,company_domain,email,candidate_id,campaign_id) values(k||'-other2',k||'-other.invalid','contact@'||k||'.invalid',k,3932154);
  exception when unique_violation then failed:=true;
  end;
  assert failed,'Email must have only one invitation reservation';
end $$;
rollback;
select 'Discovery RLS, run leases, atomic checkpoints, and invitation uniqueness passed; fixtures rolled back' as result;
