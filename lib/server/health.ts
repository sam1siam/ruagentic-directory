import 'server-only';
import { adminClient } from '../supabase/server';
import { bundledCatalog } from './catalog';
import {
  classify,
  type Health,
  type LinkResult,
  type RegistryResult,
  type RepoResult,
} from '../health-policy';
import type { PublicListing } from '../listing';

const UA =
  'Mozilla/5.0 (compatible; RUAGENTIC-check/1.0; +https://ruagentic.com/about)';
async function probe(
  url: string,
  method: 'HEAD' | 'GET' = 'HEAD',
): Promise<LinkResult> {
  try {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });
    // Some hosts refuse HEAD; retry once with GET before calling it dead.
    if (
      method === 'HEAD' &&
      (response.status === 405 ||
        response.status === 404 ||
        response.status >= 500)
    )
      return probe(url, 'GET');
    return { url, status: response.status };
  } catch {
    return method === 'HEAD' ? probe(url, 'GET') : { url, status: 0 };
  }
}
async function github(repository: string): Promise<RepoResult | null> {
  const m = repository.match(
    /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  );
  if (!m) return null;
  try {
    const response = await fetch(
      `https://api.github.com/repos/${m[1]}/${m[2]}`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/vnd.github+json',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN }
            : {}),
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status === 404) return { found: false };
    if (!response.ok) return null; // rate limited or transient: no verdict
    const data = (await response.json()) as {
      archived?: boolean;
      pushed_at?: string;
      html_url?: string;
    };
    const renamed =
      data.html_url &&
      data.html_url.toLowerCase() !==
        repository
          .toLowerCase()
          .replace(/\.git$/, '')
          .replace(/\/$/, '')
        ? data.html_url
        : null;
    return {
      found: true,
      archived: Boolean(data.archived),
      pushedAt: data.pushed_at ?? null,
      renamedTo: renamed,
    };
  } catch {
    return null;
  }
}
async function registry(name: string): Promise<RegistryResult | null> {
  try {
    const response = await fetch(
      'https://registry.modelcontextprotocol.io/v0.1/servers/' +
        encodeURIComponent(name) +
        '/versions/latest',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) },
    );
    if (response.status === 404) return { name, found: false };
    if (!response.ok) return null;
    const data = (await response.json()) as {
      server?: { version?: string };
      version?: string;
    };
    return {
      name,
      found: true,
      version: data.server?.version ?? data.version ?? null,
    };
  } catch {
    return null;
  }
}
export type CheckRecord = Health & {
  slug: string;
  checked_at: string;
  links: Record<string, LinkResult>;
  repo: RepoResult | null;
  registry: RegistryResult | null;
};
/** Checks one listing's public facts without installing or running anything. */
export async function checkListing(item: PublicListing): Promise<CheckRecord> {
  const links: Record<string, LinkResult> = {};
  const targets: [string, string][] = [
    ['homepage', item.homepage],
    ['documentation', item.documentation],
    ['repository', item.repository],
    ['endpoint', item.endpoint],
  ];
  await Promise.all(
    targets
      .filter(([, url]) => url)
      .map(async ([key, url]) => {
        links[key] = await probe(url, key === 'endpoint' ? 'GET' : 'HEAD');
      }),
  );
  const [repo, reg] = await Promise.all([
    item.repository ? github(item.repository) : Promise.resolve(null),
    item.registry?.name ? registry(item.registry.name) : Promise.resolve(null),
  ]);
  const health = classify({
    links,
    repo,
    registry: reg,
    knownVersion: item.registry?.version,
  });
  return {
    slug: item.slug,
    checked_at: new Date().toISOString(),
    links,
    repo,
    registry: reg,
    ...health,
  };
}
async function save(record: CheckRecord) {
  const { error } = await adminClient().from('listing_checks').upsert(
    {
      slug: record.slug,
      checked_at: record.checked_at,
      status: record.status,
      issues: record.issues,
      links: record.links,
      repo: record.repo,
      registry: record.registry,
    },
    { onConflict: 'slug' },
  );
  if (error) throw error;
}
export async function checkAndSave(item: PublicListing) {
  const record = await checkListing(item);
  await save(record);
  return record;
}
/** Checks the bundled listings that were checked longest ago (never-checked
 *  first), a batch at a time, so the whole catalog cycles every few days. */
export async function runHealthBatch(limit = 40) {
  const db = adminClient();
  const items = await bundledCatalog();
  const { data, error } = await db
    .from('listing_checks')
    .select('slug,checked_at');
  if (error) throw error;
  const last = new Map(
    (data ?? []).map((r) => [r.slug as string, r.checked_at as string]),
  );
  const queue = [...items]
    .sort((a, b) =>
      (last.get(a.slug) ?? '').localeCompare(last.get(b.slug) ?? ''),
    )
    .slice(0, limit);
  const summary = { checked: 0, ok: 0, warn: 0, broken: 0 };
  const pending = [...queue];
  async function worker() {
    while (pending.length) {
      const item = pending.shift()!;
      try {
        const record = await checkAndSave(item);
        summary.checked++;
        summary[record.status]++;
      } catch {
        /* keep going; the listing stays at the front of the queue */
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { ...summary, remaining: Math.max(0, items.length - last.size) };
}
