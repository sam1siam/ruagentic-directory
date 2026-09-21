import 'server-only';
import { revalidateTag } from 'next/cache';

export const catalogCacheTag = 'public-catalog';
export const catalogCacheSeconds = 300;

/** Expire every catalog batch after a write, including visibility changes.
 * Works in both server actions and publication/payment/cron route handlers. */
export function invalidateCatalog() {
  revalidateTag(catalogCacheTag, { expire: 0 });
}
