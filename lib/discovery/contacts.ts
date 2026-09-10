import { load } from 'cheerio';
import { setTimeout as delay } from 'node:timers/promises';
import { apiJson, ProviderError, readPage } from './http.ts';
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
    /\bfounder\b|\bowner\b/i.test(title) &&
    !/(?:former|ex[- ])\s*(?:co[- ]?)?(?:founder|owner)/i.test(title) &&
    !/\b(?:product|project|process|service) owner\b/i.test(title)
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
    !validEmail(e.email) ||
    companyDomain('https://' + e.email.split('@')[1]) !== domain
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
  };
}
/** Only published contact addresses; never generate guessed mailbox combinations. */
export function publicContacts(html: string, pageUrl: string) {
  const $ = load(html);
  const links = $('a[href^="mailto:"]')
    .toArray()
    .map((el) => {
      let email = '';
      try {
        email = decodeURIComponent(
          ($(el).attr('href') || '').slice(7).split('?')[0],
        ).trim();
      } catch {}
      const context = $(el).parent().text();
      return {
        email,
        evidence: pageUrl,
        rank: /^(hello|contact|info|team|support|sales)@/i.test(email) ? 0 : 1,
        context,
      };
    })
    .filter(
      (r) =>
        validEmail(r.email) &&
        !/(no (?:unsolicited|marketing)|do not (?:contact|email)|not for (?:sales|marketing))/i.test(
          r.context,
        ),
    );
  return [
    ...new Map(
      links
        .sort((a, b) => a.rank - b.rank)
        .map((r) => [r.email.toLowerCase(), r]),
    ).values(),
  ];
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
  let founderName = item.founderName;
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
  if (prospeo) {
    const result = await paid(
      'https://api.prospeo.io/search-person',
      { 'X-KEY': prospeo },
      {
        page: 1,
        filters: {
          company: { websites: { include: [domain] } },
          person_job_title: {
            include: ['Founder', 'Owner'],
            match_mode: 'CONTAINS',
          },
          max_person_per_company: 1,
        },
      },
    );
    const match = result
      ? prospeoSearch
          .parse(result)
          .results.find((r) => founderRecord(r, domain))
      : undefined;
    if (match?.person) {
      founderName = match.person.full_name || undefined;
      await delay(1100);
      const enriched = await paid(
        'https://api.prospeo.io/enrich-person',
        { 'X-KEY': prospeo },
        {
          only_verified_email: true,
          enrich_mobile: false,
          data: { person_id: match.person.person_id },
        },
      );
      const contact = verifiedFounder(
        enriched,
        domain,
        `Prospeo founder search for ${domain}; person ${match.person.person_id}`,
      );
      if (contact) return contact;
    }
  }
  if (findymail && founderName) {
    const result = await paid(
      'https://app.findymail.com/api/search/name',
      { Authorization: `Bearer ${findymail}` },
      { name: founderName, domain },
    );
    const email = object(object(result).contact).email;
    if (
      validEmail(email) &&
      companyDomain('https://' + email.split('@')[1]) === domain
    )
      return {
        email: email.toLowerCase(),
        firstName: founderName.split(' ')[0],
        fullName: founderName,
        companyDomain: domain,
        provider: 'Findymail verified founder',
        evidence: `Known founder ${founderName}; exact business domain ${domain}`,
        verifiedAt: new Date().toISOString(),
      };
  }
  if (!findymail) return null;
  const home = publicUrl(item.homepage)!;
  const page = await readPage(home, deadline, true, 500_000),
    $ = load(page.text);
  const pages = [{ url: home, text: page.text }];
  const contactUrl = $('a[href]')
    .toArray()
    .map((el) => ({ href: $(el).attr('href')!, label: $(el).text().trim() }))
    .filter((r) => /^(contact|contact us|get in touch)$/i.test(r.label))
    .map((r) => {
      try {
        return publicUrl(new URL(r.href, home).href);
      } catch {
        return undefined;
      }
    })
    .find((u) => u && new URL(u).origin === new URL(home).origin);
  if (contactUrl && contactUrl !== home) {
    try {
      pages.push(await readPage(contactUrl, deadline, true, 500_000));
    } catch {
      /* Homepage's published contact can still be verified. */
    }
  }
  const contacts = pages.flatMap((p) => publicContacts(p.text, p.url));
  for (const candidate of contacts.slice(0, 2)) {
    const result = object(
      await paid(
        'https://app.findymail.com/api/verify',
        { Authorization: `Bearer ${findymail}` },
        { email: candidate.email },
      ),
    );
    if (
      result?.verified === true &&
      typeof result.email === 'string' &&
      result.email.toLowerCase() === candidate.email.toLowerCase()
    )
      return {
        email: candidate.email.toLowerCase(),
        firstName: '',
        fullName: '',
        companyDomain: domain,
        provider: 'Published business contact, Findymail verified',
        evidence: candidate.evidence,
        verifiedAt: new Date().toISOString(),
      };
  }
  return null;
}
