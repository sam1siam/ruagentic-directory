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
  // A GitHub search result already carries the repository's own homepage.
  if (item.source === 'github') return item;
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
  reader: typeof readPage = readPage,
): Promise<Contact | null> {
  const domain = companyDomain(item.homepage);
  if (!domain) return null;
  const prospeo = process.env.PROSPEO_API_KEY,
    findymail = process.env.FINDYMAIL_API_KEY;
  if (!prospeo)
    throw new Error('Prospeo founder enrichment must be configured');
  let prospeoFailure: unknown;
  const nameKey = (name: string) => name.normalize('NFKC').trim().toLowerCase();
  const knownFounders = new Map<
    string,
    { name: string; role: string; evidence: string }
  >();
  const founderEvidence = (personId: string) =>
    `Prospeo current founder search for ${domain}; person ${personId}`;
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
        knownFounders.set(nameKey(person.full_name), {
          name: person.full_name,
          role: person.current_job_title!,
          evidence: founderEvidence(person.person_id!),
        });
      }
    }
    for (const match of matches) {
      const person = match.person!;
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
        founderEvidence(person.person_id!),
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
  if (!findymail) {
    if (prospeoFailure) throw prospeoFailure;
    return null;
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
      nameKey(result.name) === nameKey(person.name);
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
  for (const founder of knownFounders.values()) {
    const contact = await findEmail(founder);
    if (contact) return contact;
  }
  // Search for another founder when the known founders have no verified email.
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
    if (knownFounders.has(nameKey(person.name))) continue;
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
  // No founder email: a hello@ or support@ address published on the company's
  // own site, verified by Findymail, is the fallback. Addresses are never guessed.
  const home = publicUrl(item.homepage);
  if (!home) return null;
  const pages: { url: string; text: string }[] = [];
  try {
    const page = await reader(home, deadline, true, 500_000);
    pages.push({ url: page.url, text: page.text });
    const $ = load(page.text);
    const contactUrl = $('a[href]')
      .toArray()
      .map((el) => ({
        href: $(el).attr('href') ?? '',
        label: $(el).text().trim(),
      }))
      .filter((link) =>
        /^(contact|contact us|get in touch|support|help)$/i.test(link.label),
      )
      .map((link) => {
        try {
          return publicUrl(new URL(link.href, page.url).href);
        } catch {
          return undefined;
        }
      })
      .find((url) => {
        if (!url || url === publicUrl(page.url)) return false;
        const host = new URL(url).hostname;
        return host === domain || host.endsWith('.' + domain);
      });
    if (contactUrl)
      try {
        const contactPage = await reader(contactUrl, deadline, true, 500_000);
        pages.push({ url: contactPage.url, text: contactPage.text });
      } catch {
        /* the homepage's own address can still be used */
      }
  } catch {
    return null; // an unreadable site offers no published address
  }
  const seen = new Set<string>();
  const published = pages
    .flatMap((page) => publishedContacts(page.text, page.url, domain))
    .filter((c) => !seen.has(c.email) && seen.add(c.email))
    .sort(
      (a, b) =>
        PUBLISHED_MAILBOXES.indexOf(a.email.split('@')[0]!) -
        PUBLISHED_MAILBOXES.indexOf(b.email.split('@')[0]!),
    );
  for (const candidate of published.slice(0, 2)) {
    const result = object(
      await paid('https://app.findymail.com/api/verify', finderHeaders, {
        email: candidate.email,
      }),
    );
    if (
      result.verified === true &&
      typeof result.email === 'string' &&
      result.email.toLowerCase() === candidate.email
    )
      return {
        email: candidate.email,
        firstName: '',
        fullName: '',
        companyDomain: domain,
        provider: 'Published business contact, Findymail verified',
        evidence: candidate.evidence,
        verifiedAt: new Date().toISOString(),
        role: candidate.email.startsWith('support@')
          ? 'Support mailbox'
          : 'General mailbox',
      };
  }
  return null;
}
const PUBLISHED_MAILBOXES = ['hello', 'support'];
/** hello@ and support@ addresses on the company's own domain that a page
 *  publishes, as mailto links or plain text, hello@ first. A page that
 *  refuses marketing or unsolicited contact yields nothing. */
export function publishedContacts(
  html: string,
  pageUrl: string,
  domain: string,
) {
  const $ = load(html);
  const text = $('body').length ? $('body').text() : $.root().text();
  if (
    /\bno\s+(?:unsolicited|marketing|sales)\b|\b(?:do\s+not|don[’']t)\s+(?:contact|e-?mail)\b|\bnot\s+for\s+(?:sales|marketing)\b/i.test(
      text,
    )
  )
    return [];
  const addresses = [
    ...$('a[href^="mailto:"]')
      .toArray()
      .map((el) => {
        try {
          return decodeURIComponent(
            ($(el).attr('href') ?? '').slice(7).split('?')[0]!,
          );
        } catch {
          return '';
        }
      }),
    // Read the whole mailbox before filtering its local part. A word boundary
    // would incorrectly turn jane+hello@example.com into hello@example.com.
    ...(text.match(
      /[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
    ) ?? []),
  ].map((email) => email.trim().toLowerCase());
  return [...new Set(addresses)]
    .filter(
      (email) =>
        validEmail(email) &&
        PUBLISHED_MAILBOXES.includes(email.split('@')[0]!) &&
        companyDomain('https://' + email.split('@')[1]) === domain,
    )
    .sort(
      (a, b) =>
        PUBLISHED_MAILBOXES.indexOf(a.split('@')[0]!) -
        PUBLISHED_MAILBOXES.indexOf(b.split('@')[0]!),
    )
    .map((email) => ({ email, evidence: pageUrl }));
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
