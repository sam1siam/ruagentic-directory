import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  CUTOFF,
  digest,
  isNew,
  type Candidate,
  type Snapshot,
  type Source,
} from './policy.ts';
const makeClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
export type SourceState = {
  source: Source;
  initialized_at: string | null;
  seen_keys: string[];
  last_success_at: string | null;
};
export type CandidateRow = {
  id: string;
  source: Source;
  data: Candidate;
  status: string;
  reason: string | null;
  contact: Contact | null;
  attempts: number;
};
export type Contact = {
  email: string;
  firstName: string;
  fullName: string;
  companyDomain: string;
  provider: string;
  evidence: string;
  verifiedAt: string;
};
export function discoveryStore() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Discovery database is not configured');
  return new DiscoveryStore(makeClient(url, key));
}
export class DiscoveryStore {
  readonly db: ReturnType<typeof makeClient>;
  constructor(db: ReturnType<typeof makeClient>) {
    this.db = db;
  }
  async claim(day: string) {
    const owner = randomUUID();
    const { data, error } = await this.db.rpc('discovery_claim_run', {
      p_day: day,
      p_owner: owner,
    });
    if (error)
      throw new Error(
        'Discovery migration is not applied or run storage is unavailable',
      );
    return data ? owner : null;
  }
  async finish(
    day: string,
    owner: string,
    report: unknown,
    status = 'completed',
  ) {
    const { error } = await this.db
      .from('discovery_runs')
      .update({
        status,
        report,
        finished_at: new Date().toISOString(),
        lease_until: new Date().toISOString(),
      })
      .eq('day', day)
      .eq('owner', owner);
    if (error) throw new Error('Could not save discovery report');
  }
  async source(source: Source): Promise<SourceState> {
    const { data, error } = await this.db
      .from('discovery_sources')
      .select('source,initialized_at,seen_keys,last_success_at')
      .eq('source', source)
      .maybeSingle();
    if (error) throw new Error('Could not read source checkpoint');
    return (
      (data as SourceState) || {
        source,
        initialized_at: null,
        seen_keys: [],
        last_success_at: null,
      }
    );
  }
  async sourceError(source: Source, message: string) {
    const { error } = await this.db
      .from('discovery_sources')
      .upsert(
        { source, last_error: message.slice(0, 200) },
        { onConflict: 'source' },
      );
    if (error) throw new Error('Could not save source error');
  }
  async commit(snapshot: Snapshot, state: SourceState, now: string) {
    if (!snapshot.complete)
      throw new Error('Incomplete snapshots must not advance checkpoints');
    const seen = new Set(state.seen_keys),
      candidates = snapshot.items.filter((i) =>
        isNew(i, seen, Boolean(state.initialized_at), now),
      );
    for (const item of snapshot.items) seen.add(digest(item.id));
    const { error } = await this.db.rpc('discovery_commit_source', {
      p_source: snapshot.source,
      p_seen: [...seen],
      p_count: snapshot.items.length,
      p_candidates: candidates.map((item) => ({
        id: digest(`${item.source}:${item.id}`),
        source_id: item.id,
        published_at: item.publishedAt || null,
        data: {
          ...item,
          dateEvidence:
            item.dateEvidence ||
            `Absent from complete ${state.last_success_at} source snapshot; first observed ${now}; cutoff ${CUTOFF}`,
        },
      })),
    });
    if (error) throw new Error('Could not commit discovery snapshot');
    return {
      observed: snapshot.items.length,
      newCandidates: candidates.length,
      baseline: !state.initialized_at,
    };
  }
  async pending(limit: number) {
    const { data, error } = await this.db
      .from('discovery_candidates')
      .select('*')
      .in('status', ['pending', 'retry', 'contact_ready'])
      .or('attempts.lt.3,status.eq.contact_ready')
      .order('first_seen_at')
      .limit(limit);
    if (error) throw new Error('Could not load candidates');
    return (data || []) as CandidateRow[];
  }
  async update(id: string, values: Record<string, unknown>) {
    const { error } = await this.db
      .from('discovery_candidates')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error('Could not save candidate progress');
  }
  async budget(kind: string, day: string, limit: number) {
    const { data, error } = await this.db.rpc('consume_rate_limit', {
      p_key: digest(`discovery:${kind}:${day}`),
      p_limit: limit,
      p_seconds: 172800,
    });
    if (error) throw new Error('Daily budget could not be checked');
    return Boolean(data);
  }
  async outreach() {
    const rows: {
      project_key: string;
      company_domain: string;
      email: string;
      status: string;
    }[] = [];
    for (let offset = 0; offset < 100000; offset += 500) {
      const { data, error } = await this.db
        .from('discovery_outreach')
        .select('project_key,company_domain,email,status')
        .order('project_key')
        .range(offset, offset + 499);
      if (error) throw new Error('Could not check invitation deduplication');
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
    throw new Error('Outreach ledger exceeded pagination limit');
  }
  async reserve(
    id: string,
    projectKey: string,
    contact: Contact,
    campaignId: number,
  ) {
    const { error } = await this.db.from('discovery_outreach').insert({
      project_key: projectKey,
      company_domain: contact.companyDomain,
      email: contact.email.toLowerCase(),
      candidate_id: id,
      campaign_id: campaignId,
    });
    if (error?.code === '23505') return false;
    if (error) throw new Error('Could not reserve invitation');
    return true;
  }
  async completeOutreach(id: string, status: string, result: unknown) {
    const { error } = await this.db
      .from('discovery_outreach')
      .update({
        status,
        provider_result: result,
        updated_at: new Date().toISOString(),
      })
      .eq('candidate_id', id);
    if (error) throw new Error('Could not record Smartlead outcome');
  }
}
