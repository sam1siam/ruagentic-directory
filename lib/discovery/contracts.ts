import { z } from 'zod';

const text = z.string().nullish();
export const clineCatalog = z.object({
  entries: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string(),
      name: z.string().min(1),
      description: text,
      tagline: text,
      repo: text,
      homepage: text,
      website: text,
      install: z.object({ args: z.array(z.unknown()).nullish() }).nullish(),
    }),
  ),
});
export const dockerCatalog = z.object({
  registry: z.record(
    z.string(),
    z.object({
      title: text,
      description: text,
      upstream: text,
      source: text,
      homepage: text,
      dateAdded: text,
      remote: z.object({ url: text }).nullish(),
    }),
  ),
});
export const liteCatalog = z.object({
  servers: z.array(
    z.object({
      name: z.string().min(1),
      title: text,
      description: text,
      url: text,
      repository: text,
      homepage: text,
      registry_url: text,
      command: text,
      args: z.array(z.unknown()).nullish(),
    }),
  ),
});
const officialMeta = z.object({
  status: text,
  publishedAt: text,
  isLatest: z.boolean().optional(),
});
export const registryCatalog = z.object({
  servers: z.array(
    z.object({
      server: z.object({
        name: z.string().min(1),
        title: text,
        description: text,
        websiteUrl: text,
        repository: z.object({ url: text }).nullish(),
        remotes: z.array(z.object({ url: text })).nullish(),
      }),
      _meta: z
        .object({ 'io.modelcontextprotocol.registry/official': officialMeta })
        .optional(),
    }),
  ),
  metadata: z.object({ nextCursor: text }).optional(),
});
export const prospeoRecord = z.object({
  company: z.object({ domain: text, website: text }).nullish(),
  person: z
    .object({
      person_id: text,
      current_job_title: text,
      first_name: text,
      full_name: text,
      email: z
        .object({ status: text, revealed: z.boolean().nullish(), email: text })
        .nullish(),
    })
    .nullish(),
});
export const prospeoSearch = z.object({ results: z.array(prospeoRecord) });
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
