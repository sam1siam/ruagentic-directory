import { load } from 'cheerio';
import { apiJson, ProviderError, providerHold, readPage } from './http.ts';
import {
  companyDomain,
  publicUrl,
  repositoryKey,
  validEmail,
  type Candidate,
} from './policy.ts';
import type { Contact } from './store.ts';
import { object, prospeoRecord, prospeoSearch } from './contracts.ts';

type Api = typeof apiJson;
export const isFounderTitle = (title: unknown): title is string =>
  typeof title === 'string' &&
  /\bfounder\b/i.test(title) &&
  !/\b(?:former|ex[- ]|founder in residence|founder associate|founder[’']?s (?:office|assistant))/i.test(
    title,
  );
export function founderEmail(value: unknown, domain: string): value is string {
  return (
    validEmail(value) &&
    companyDomain('https://' + value.split('@')[1]) === domain &&
    !/^(?:support|hello|contact|info|team|sales|admin|office|help|helpdesk|hi|hey|inquiries|enquiries|founders?|owners?|ceo|marketing|press|billing|careers|jobs|feedback|business|partners|partnerships)(?:[._+-][^@]*)?@/i.test(
      value,
    )
  );
}
export function founderContact(
  contact: Contact | null,
  domain: string,
): contact is Contact {
  return Boolean(
    contact &&
    founderEmail(contact.email, domain) &&
    contact.fullName.trim().split(/\s+/).length >= 2 &&
    isFounderTitle(contact.role) &&
    contact.companyDomain === domain &&
    contact.evidence &&
    ['Prospeo verified founder', 'Findymail verified founder'].includes(
      contact.provider,
    ),
  );
}
export function belongsToCompany(input: unknown, domain: string) {
  const record = prospeoRecord.safeParse(input).data;
  return (
    record?.company?.domain?.toLowerCase() === domain ||
    companyDomain(record?.company?.website) === domain
  );
}
export function founderRecord(input: unknown, domain: string) {
  const record = prospeoRecord.safeParse(input).data;
  const title = record?.person?.current_job_title || '';
  return (
    belongsToCompany(record, domain) &&
    typeof record?.person?.person_id === 'string' &&
    isFounderTitle(title)
  );
}
export function verifiedFounder(
  input: unknown,
  domain: string,
  evidence: string,
): Contact | null {
  const record = prospeoRecord.safeParse(input).data;
  const p = record?.person,
    e = p?.email;
  if (
    !p ||
    !e ||
    !founderRecord(record, domain) ||
    e?.status !== 'VERIFIED' ||
    e.revealed !== true ||
    !founderEmail(e.email, domain) ||
    !p.full_name ||
    p.full_name.trim().split(/\s+/).length < 2
  )
    return null;
  return {
    email: e.email.toLowerCase(),
    firstName: p.first_name || '',
    fullName: p.full_name || '',
    companyDomain: domain,
    provider: 'Prospeo verified founder',
    evidence,
    verifiedAt: new Date().toISOString(),
    role: p.current_job_title!,
  };
}
export async function resolveHomepage(
  item: Candidate,
  deadline: number,
): Promise<Candidate> {
  if (companyDomain(item.homepage)) return item;
  if (item.registryUrl) {
    const u = new URL(item.registryUrl);
    if (
      u.hostname === 'registry.modelcontextprotocol.io' &&
      u.pathname.startsWith('/servers/')
    ) {
      const id = decodeURIComponent(u.pathname.slice('/servers/'.length));
      const result = JSON.parse(
        (
          await readPage(
            `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(id)}/versions/latest`,
            deadline,
            false,
          )
        ).text,
      );
      const server = result.server;
      if (server)
        item = {
          ...item,
          homepage: publicUrl(server.websiteUrl),
          repository: item.repository || publicUrl(server.repository?.url),
        };
    }
  }
  if (item.npmPackage && !item.repository && !companyDomain(item.homepage)) {
    const result = JSON.parse(
      (
        await readPage(
          `https://registry.npmjs.org/${encodeURIComponent(item.npmPackage)}/latest`,
          deadline,
          false,
        )
      ).text,
    );
    const repo =
      typeof result.repository === 'string'
        ? result.repository
        : result.repository?.url;
    item = {
      ...item,
      homepage: publicUrl(result.homepage),
      repository: publicUrl(repo?.replace(/^git\+/, '')),
    };
  }
  if (companyDomain(item.homepage)) return item;
  const repo = repositoryKey(item.repository);
  if (repo?.startsWith('github.com/')) {
    const path = repo.slice('github.com/'.length);
    const metadata = await apiJson(
      'https://api.github.com/repos/' + path,
      {
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {},
      },
      deadline,
    );
    const homepage = publicUrl(object(metadata).homepage);
    if (homepage && companyDomain(homepage)) return { ...item, homepage };
  }
  if (companyDomain(item.endpoint)) {
    const origin = new URL(item.endpoint!).origin;
    try {
      const page = await readPage(origin, deadline, true, 500_000),
        $ = load(page.text);
      const identity = $('title,h1')
          .text()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''),
        name = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length >= 4 && identity.includes(name))
        return { ...item, homepage: origin };
    } catch {
      /* Unproven endpoint ownership stays out of contact enrichment. */
    }
  }
  return item;
}
export async function findContact(
  item: Candidate,
  deadline: number,
  budget: () => Promise<boolean>,
  api: Api = apiJson,
): Promise<Contact | null> {
  const domain = companyDomain(item.homepage);
  if (!domain) return null;
  const prospeo = process.env.PROSPEO_API_KEY,
    findymail = process.env.FINDYMAIL_API_KEY;
  if (!prospeo || !findymail)
    throw new Error('Both founder enrichment providers must be configured');
  let prospeoFailure: unknown;
  let knownFounder:
    | { name: string; role: string; evidence: string }
    | undefined;
  const paid = async (
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ) => {
    if (!(await budget()))
      throw new Error('Daily enrichment API budget reached');
    try {
      return await api(
        url,
        { method: 'POST', headers, body: JSON.stringify(body) },
        deadline,
      );
    } catch (e) {
      if (
        e instanceof ProviderError &&
        (['NO_RESULTS', 'NO_MATCH', 'NO_VERIFIED_EMAIL'].includes(
          e.code || '',
        ) ||
          (e.provider === 'app.findymail.com' && e.status === 404))
      )
        return null;
      throw e;
    }
  };
  try {
    const result = await paid(
      'https://api.prospeo.io/search-person',
      { 'X-KEY': prospeo },
      {
        page: 1,
        filters: {
          company: { websites: { include: [domain] } },
          person_job_title: {
            include: ['Founder', 'Co-founder'],
            match_mode: 'CONTAINS',
          },
          max_person_per_company: 2,
        },
      },
    );
    const matches = result
      ? prospeoSearch
          .parse(result)
          .results.filter((r) => founderRecord(r, domain))
          .slice(0, 2)
      : [];
    for (const match of matches) {
      const person = match.person!;
      if (
        person.full_name &&
        person.full_name.trim().split(/\s+/).length >= 2
      ) {
        knownFounder = {
          name: person.full_name,
          role: person.current_job_title!,
          evidence:
            'Prospeo current founder search for ' +
            domain +
            '; person ' +
            person.person_id,
        };
      }
      const enriched = await paid(
        'https://api.prospeo.io/enrich-person',
        { 'X-KEY': prospeo },
        {
          only_verified_email: true,
          enrich_mobile: false,
          data: { person_id: person.person_id },
        },
      );
      const contact = verifiedFounder(
        enriched,
        domain,
        knownFounder?.evidence || 'Prospeo exact company founder',
      );
      if (contact) return contact;
    }
  } catch (e) {
    // Other Prospeo errors still allow the independent Findymail fallback.
    // Budget exhaustion, rate limits and account problems stop the lookup so
    // the candidate is retried later with Prospeo first, as the policy requires.
    if (/budget/.test(e instanceof Error ? e.message : '') || providerHold(e))
      throw e;
    prospeoFailure = e;
  }
  const finderHeaders = { Authorization: 'Bearer ' + findymail };
  const findEmail = async (person: {
    name: string;
    role: string;
    evidence: string;
  }) => {
    const result = object(
      object(
        await paid('https://app.findymail.com/api/search/name', finderHeaders, {
          name: person.name,
          domain,
        }),
      ).contact,
    );
    const sameName =
      typeof result.name === 'string' &&
      result.name.normalize('NFKC').trim().toLowerCase() ===
        person.name.normalize('NFKC').trim().toLowerCase();
    if (
      !sameName ||
      !founderEmail(result.email, domain) ||
      (typeof result.domain === 'string' &&
        companyDomain('https://' + result.domain) !== domain)
    )
      return null;
    return {
      email: result.email.toLowerCase(),
      firstName: person.name.split(' ')[0],
      fullName: person.name,
      role: person.role,
      companyDomain: domain,
      provider: 'Findymail verified founder',
      evidence: person.evidence,
      verifiedAt: new Date().toISOString(),
    } satisfies Contact;
  };
  if (knownFounder) {
    const contact = await findEmail(knownFounder);
    if (contact) return contact;
  }
  // Findymail must discover the founder itself when Prospeo finds no person.
  // The old generic-mailbox /api/verify path is intentionally absent.
  const employees = await paid(
    'https://app.findymail.com/api/search/employees',
    finderHeaders,
    { website: domain, job_titles: ['Founder', 'Co-founder'], count: 2 },
  );
  if (employees !== null && !Array.isArray(employees))
    throw new Error('Findymail founder search response changed');
  for (const value of (employees || []) as unknown[]) {
    const person = object(value);
    if (
      !isFounderTitle(person.jobTitle) ||
      companyDomain(person.companyWebsite) !== domain ||
      typeof person.name !== 'string' ||
      person.name.trim().split(/\s+/).length < 2
    )
      continue;
    if (person.name === knownFounder?.name) continue;
    const contact = await findEmail({
      name: person.name,
      role: person.jobTitle,
      evidence:
        'Findymail current founder at ' +
        domain +
        '; ' +
        (publicUrl(person.linkedinUrl) || person.name),
    });
    if (contact) return contact;
  }
  if (prospeoFailure) throw prospeoFailure; // Retry unresolved provider failures, not a false "no match".
  return null;
}

export type ProspeoAccount = {
  plan: string;
  remainingCredits: number | null;
  renewalDays: number | null;
};
/** Prospeo's free account check: current plan, credits left and renewal. */
export async function prospeoAccount(
  deadline: number,
  api: Api = apiJson,
): Promise<ProspeoAccount | null> {
  const key = process.env.PROSPEO_API_KEY;
  if (!key) return null;
  const body = object(
    await api(
      'https://api.prospeo.io/account-information',
      { method: 'GET', headers: { 'X-KEY': key } },
      deadline,
    ),
  );
  const record = object(body.response ?? body);
  const count = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : null;
  return {
    plan:
      typeof record.current_plan === 'string' ? record.current_plan : 'unknown',
    remainingCredits: count(record.remaining_credits),
    renewalDays: count(record.next_quota_renewal_days),
  };
}
