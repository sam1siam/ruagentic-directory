/** Server side of duplicate handling: matching a submission against the
 *  public catalog, the admin review queue, merging (hide + redirect) and
 *  dismissals. Merges never delete anything; a merged listing's address keeps
 *  working through listing_redirects. */
import { cache } from 'react';
import { adminClient, configured } from '../supabase/server';
import { catalog } from './catalog';
import {
  duplicateGroups,
  findDuplicates,
  pairKey,
  type DuplicateGroup,
  type DuplicateMatch,
} from '../duplicates';
import type { ListingInput } from '../listing';

/** Public listings that describe the same project as the payload. */
export async function duplicatesFor(
  payload: Pick<ListingInput, 'homepage' | 'repository'>,
  excludeSlug?: string | null,
): Promise<DuplicateMatch[]> {
  return findDuplicates(payload, await catalog(), excludeSlug);
}

export const dismissedPairs = cache(async (): Promise<Set<string>> => {
  if (!configured()) return new Set();
  try {
    const { data } = await adminClient()
      .from('duplicate_dismissals')
      .select('pair')
      .limit(5000);
    return new Set((data ?? []).map((r) => r.pair as string));
  } catch {
    return new Set();
  }
});

/** Groups with at least one pair the admin has not dismissed. */
export async function openDuplicateGroups(): Promise<DuplicateGroup[]> {
  const [items, dismissed] = await Promise.all([catalog(), dismissedPairs()]);
  return duplicateGroups(items).filter((group) => {
    for (let i = 0; i < group.items.length; i++)
      for (let j = i + 1; j < group.items.length; j++)
        if (!dismissed.has(pairKey(group.items[i]!.slug, group.items[j]!.slug)))
          return true;
    return false;
  });
}

/** True when the duplicates migration has been applied. */
export async function duplicateTablesReady() {
  if (!configured()) return false;
  const { error } = await adminClient()
    .from('listing_redirects')
    .select('slug')
    .limit(1);
  return !error;
}

/** Hides `loser` everywhere and redirects its address to `winner`. A
 *  submitted loser is suspended so its owner's dashboard says so. */
export async function mergeListing(
  loser: string,
  winner: string,
  actor: string,
  note: string,
) {
  if (loser === winner) return;
  const db = adminClient();
  const now = new Date().toISOString();
  const redirect = await db
    .from('listing_redirects')
    .upsert(
      { slug: loser, target: winner, note, created_by: actor },
      { onConflict: 'slug' },
    );
  if (redirect.error) throw redirect.error;
  const hidden = await db
    .from('directory_entries')
    .update({ visible: false, updated_at: now })
    .eq('slug', loser);
  if (hidden.error) throw hidden.error;
  const override = await db
    .from('catalog_overrides')
    .upsert(
      { slug: loser, hidden: true, note, updated_by: actor, updated_at: now },
      { onConflict: 'slug' },
    );
  if (override.error) throw override.error;
  await db
    .from('submissions')
    .update({ state: 'suspended', updated_at: now })
    .eq('slug', loser)
    .eq('state', 'published');
  // Anything that already pointed at the loser now points at the winner.
  await db
    .from('listing_redirects')
    .update({ target: winner })
    .eq('target', loser);
  await db.from('admin_actions').insert({
    actor,
    action: 'listing.merge',
    target: loser + ' -> ' + winner,
    note,
  });
}

/** Records that these listings are different projects. */
export async function dismissDuplicates(
  slugs: string[],
  actor: string,
  note: string,
) {
  const db = adminClient();
  const rows = [];
  for (let i = 0; i < slugs.length; i++)
    for (let j = i + 1; j < slugs.length; j++)
      rows.push({
        pair: pairKey(slugs[i]!, slugs[j]!),
        note,
        created_by: actor,
      });
  if (!rows.length) return;
  const { error } = await db
    .from('duplicate_dismissals')
    .upsert(rows, { onConflict: 'pair' });
  if (error) throw error;
  await db.from('admin_actions').insert({
    actor,
    action: 'duplicates.keep',
    target: slugs.join(', '),
    note,
  });
}
