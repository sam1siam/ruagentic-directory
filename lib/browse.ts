import type { PublicListing } from './listing';
import type { CatalogListing } from '@/components/directory-browser';
/** The subset of a listing the browser needs; keeps client payloads small. */
export const toBrowserListing = ({
  slug,
  name,
  kind,
  summary,
  category,
  homepage,
  tags,
  source,
  observedAt,
}: PublicListing): CatalogListing => ({
  slug,
  name,
  kind,
  summary,
  category,
  homepage,
  tags,
  source,
  observedAt,
});
