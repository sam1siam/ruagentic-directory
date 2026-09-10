import { apiJson, ProviderError } from './http.ts';
import { CAMPAIGN_ID, type Candidate } from './policy.ts';
import { sourceName } from './sources.ts';
import type { Contact } from './store.ts';
import { object } from './contracts.ts';

const clean = (s: string) =>
  s
    .replace(/[<>{}\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
export const importSettings = {
  ignore_global_block_list: false,
  ignore_unsubscribe_list: false,
  ignore_community_bounce_list: false,
  ignore_duplicate_leads_in_other_campaign: false,
  return_lead_ids: true,
};
export function leadPayload(item: Candidate, contact: Contact) {
  return {
    lead_list: [
      {
        email: contact.email,
        first_name: clean(contact.firstName),
        company_name: clean(item.name),
        website: item.homepage,
        company_url: item.homepage,
        custom_fields: {
          project_name: clean(item.name),
          greeting_name: clean(contact.firstName) || 'there',
          source_name: sourceName(item.source),
          source_url: item.sourceUrl,
          project_repository: item.repository || '',
          discovery_date_evidence: clean(item.dateEvidence || ''),
          contact_evidence: contact.evidence,
        },
      },
    ],
    settings: importSettings,
  };
}
export class Smartlead {
  key: string;
  deadline: number;
  api: typeof apiJson;
  constructor(key: string, deadline: number, api = apiJson) {
    this.key = key;
    this.deadline = deadline;
    this.api = api;
  }
  async request(path: string, init: RequestInit = {}) {
    if (!this.key) throw new Error('SMARTLEAD_API_KEY is not configured');
    const url = new URL('https://server.smartlead.ai/api/v1/' + path);
    url.searchParams.set('api_key', this.key);
    return this.api(url.href, init, this.deadline);
  }
  async exists(email: string) {
    try {
      const result = await this.request(
        'leads/?email=' + encodeURIComponent(email),
      );
      if (
        result === null ||
        (Array.isArray(result) && !result.length) ||
        (result && typeof result === 'object' && !Object.keys(result).length)
      )
        return false;
      // Unknown response shapes are held, never treated as proof of absence.
      if (
        object(result).id ||
        object(object(result).data).id ||
        (Array.isArray(result) && result.length)
      )
        return true;
      throw new Error('Smartlead lead lookup response changed');
    } catch (e) {
      if (e instanceof ProviderError && e.status === 404) return false;
      throw e;
    }
  }
  async import(item: Candidate, contact: Contact) {
    const result = object(
      await this.request(`campaigns/${CAMPAIGN_ID}/leads`, {
        method: 'POST',
        body: JSON.stringify(leadPayload(item, contact)),
      }),
    );
    // A request success alone does not prove an accepted lead. Retain only counters.
    const accepted = Number(
      result?.upload_count ?? result?.added_count ?? result?.success_count,
    );
    const suppressed =
      Number(result?.block_count || 0) +
      Number(result?.duplicate_count || 0) +
      Number(result?.invalid_email_count || 0) +
      Number(result?.unsubscribed_count || 0);
    if (accepted === 1) return { status: 'enrolled', accepted: 1 };
    if (suppressed > 0 || accepted === 0)
      return { status: 'suppressed', accepted: 0 };
    return { status: 'uncertain', accepted: 0 };
  }
}
