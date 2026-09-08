import { z } from 'zod';
import { listingSchema } from './listing.ts';

const sourceUrl = z.url({ protocol: /^https$/ });
const metadataSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    source: z.string().min(1),
    sourceUrl,
    observedAt: z.union([z.iso.date(), z.iso.datetime({ offset: true })]),
    publishedAt: z.union([z.literal(''), z.iso.datetime({ offset: true })]),
    imported: z.literal(true),
    submitted: z.literal(false),
    ownershipVerified: z.literal(false),
    registry: z
      .object({
        name: z.string().min(1),
        version: z.string().min(1),
        sourceUrl,
      })
      .strict()
      .optional(),
    packages: z.array(z.unknown()).optional(),
    remotes: z.array(z.unknown()).optional(),
    sources: z.array(z.unknown()).optional(),
  })
  .strict();

export function prepareCatalog(value: unknown, now = new Date().toISOString()) {
  const rows = z.array(z.record(z.string(), z.unknown())).parse(value);
  const slugs = new Set<string>();
  return rows.map((row) => {
    const metadata: Record<string, unknown> = {};
    const input = { ...row };
    for (const key of Object.keys(metadataSchema.shape)) {
      metadata[key] = input[key];
      delete input[key];
    }
    const parsed = listingSchema.parse(input);
    const provenance = metadataSchema.parse(metadata);
    if (slugs.has(provenance.slug))
      throw new Error('Duplicate imported slug: ' + provenance.slug);
    slugs.add(provenance.slug);
    return {
      slug: provenance.slug,
      data: {
        ...parsed,
        ...provenance,
        publishedAt: provenance.publishedAt || now,
      },
      visible: true,
    };
  });
}
