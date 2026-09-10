/** Duplicate detection for listings. Two listings describe the same project
 *  when they share a project key: the homepage's service identity (its
 *  origin, or the repository path for GitHub homepages) or the normalised
 *  repository path. Keys ignore a leading "www." so mirrors of the same
 *  site match. Everything here is pure and works on stored fields only. */
import { cleanUrl, serviceIdentity } from './listing.ts';

export type IdentityInput = { homepage: string; repository?: string };

export type DuplicateCandidate = {
  slug: string;
  name: string;
  homepage: string;
  repository?: string;
  source: string;
  /** Set when the listing passed the Agentic Protocol publication checker. */
  agenticCheckedAt?: string;
  /** True for listings published from an account, false for imports. */
  submitted?: boolean;
};

export type DuplicateMatch = {
  slug: string;
  name: string;
  source: string;
  verified: boolean;
  submitted: boolean;
  reason: 'homepage' | 'repository';
};

const stripWww = (key: string) => key.replace(/^https:\/\/www\./, 'https://');

/** Normalises a repository URL to its project path, or returns null. */
export function repositoryKey(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(cleanUrl(url));
    const parts = u.pathname
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length < 2) return null;
    return stripWww(u.origin + '/' + parts.join('/').toLowerCase());
  } catch {
    return null;
  }
}

/** The keys under which a listing counts as "this project". */
export function projectKeys(input: IdentityInput) {
  const keys = new Map<string, 'homepage' | 'repository'>();
  try {
    keys.set(stripWww(serviceIdentity(input)), 'homepage');
  } catch {
    /* an unusable homepage simply contributes no key */
  }
  const repo = repositoryKey(input.repository);
  if (repo && !keys.has(repo)) keys.set(repo, 'repository');
  return keys;
}

/** Listings that describe the same project as the candidate. */
export function findDuplicates(
  candidate: IdentityInput,
  listings: DuplicateCandidate[],
  excludeSlug?: string | null,
): DuplicateMatch[] {
  const keys = projectKeys(candidate);
  if (!keys.size) return [];
  const matches: DuplicateMatch[] = [];
  for (const item of listings) {
    if (excludeSlug && item.slug === excludeSlug) continue;
    for (const [key, reason] of projectKeys(item)) {
      const hit = keys.get(key);
      if (!hit) continue;
      matches.push({
        slug: item.slug,
        name: item.name,
        source: item.source,
        verified: Boolean(item.agenticCheckedAt),
        submitted: Boolean(item.submitted),
        // Report the stronger reason: a shared homepage over a shared repo.
        reason:
          hit === 'homepage' || reason === 'homepage'
            ? 'homepage'
            : 'repository',
      });
      break;
    }
  }
  return matches;
}

export type DuplicateGroup = { key: string; items: DuplicateCandidate[] };

/** Groups of two or more listings that share a project key, for review. */
export function duplicateGroups(
  listings: DuplicateCandidate[],
): DuplicateGroup[] {
  const byKey = new Map<string, DuplicateCandidate[]>();
  for (const item of listings)
    for (const key of projectKeys(item).keys()) {
      const list = byKey.get(key) ?? [];
      if (!list.some((i) => i.slug === item.slug)) list.push(item);
      byKey.set(key, list);
    }
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();
  for (const [key, items] of byKey) {
    if (items.length < 2) continue;
    const signature = items
      .map((i) => i.slug)
      .sort()
      .join('|');
    if (seen.has(signature)) continue;
    seen.add(signature);
    groups.push({ key, items });
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

/** Stable key for a pair of slugs, used for dismissals. */
export const pairKey = (a: string, b: string) => [a, b].sort().join('|');
