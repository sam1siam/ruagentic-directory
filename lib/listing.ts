import { z } from 'zod';
import ipaddr from 'ipaddr.js';
export const kinds = ['server', 'client', 'product'] as const;
export const categories = [
  'Developer tools',
  'AI & language models',
  'Data & intelligence',
  'Search & research',
  'Browser & web automation',
  'Automation',
  'Productivity',
  'Communication',
  'Customer support & sales',
  'Marketing & SEO',
  'Design & content',
  'Media, audio & video',
  'Infrastructure',
  'Security & identity',
  'Finance',
  'E-commerce',
  'Science & health',
  'Gaming & 3D',
  'Location & travel',
  'Other',
] as const;
export function cleanUrl(value: string) {
  const text = value.trim();
  if (!text) return '';
  const url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443') ||
    url.href.length > 2048 ||
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname.endsWith('.local') ||
    (!host.includes('.') && !host.includes(':')) ||
    (ipaddr.isValid(host) && ipaddr.process(host).range() !== 'unicast')
  )
    throw new Error(
      'Use a public HTTPS URL without a password, query string, or fragment.',
    );
  return url.href;
}
const url = z
  .string()
  .max(2048)
  .transform((value, ctx) => {
    try {
      return cleanUrl(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message:
          'Use a public HTTPS URL without query parameters or credentials.',
      });
      return z.NEVER;
    }
  });
export const listingSchema = z
  .object({
    kind: z.enum(kinds),
    name: z.string().trim().min(2).max(100),
    summary: z.string().trim().min(20).max(240),
    description: z.string().trim().min(60).max(6000),
    homepage: url.refine(Boolean, 'A homepage or repository URL is required.'),
    repository: url.default(''),
    documentation: url.default(''),
    endpoint: url.default(''),
    category: z.enum(categories),
    tags: z.array(z.string().trim().min(1).max(30)).max(8),
    pricing: z.enum([
      'free',
      'freemium',
      'paid',
      'open-source',
      'contact',
      'unknown',
    ]),
    transport: z.enum([
      'streamable-http',
      'sse',
      'stdio',
      'multiple',
      'not-applicable',
      'unknown',
    ]),
    authentication: z.enum([
      'none',
      'api-key',
      'oauth',
      'account',
      'other',
      'unknown',
      'not-applicable',
    ]),
    platforms: z.array(z.string().trim().min(1).max(40)).max(12),
    license: z.string().trim().max(80).default(''),
    setup: z.string().trim().max(6000).default(''),
    capabilities: z.array(z.string().trim().min(2).max(100)).max(20),
    profileUrl: url.default(''),
    readmeUrl: url.default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === 'server' && !value.endpoint && !value.repository)
      ctx.addIssue({
        code: 'custom',
        path: ['endpoint'],
        message:
          'Provide a remote endpoint or source repository for an MCP server.',
      });
  });
export type ListingInput = z.infer<typeof listingSchema>;
export type PublicListing = ListingInput & {
  slug: string;
  source: string;
  sourceUrl: string;
  observedAt: string;
  publishedAt: string;
  agenticCheckedAt?: string;
  ownershipVerified?: boolean;
  registry?: { name: string; version: string; sourceUrl: string };
  packages?: unknown[];
  remotes?: unknown[];
  sources?: unknown[];
  imported?: boolean;
  submitted?: boolean;
};
export const emptyListing: ListingInput = {
  kind: 'server',
  name: '',
  summary: '',
  description: '',
  homepage: '',
  repository: '',
  documentation: '',
  endpoint: '',
  category: 'Developer tools',
  tags: [],
  pricing: 'unknown',
  transport: 'unknown',
  authentication: 'unknown',
  platforms: [],
  license: '',
  setup: '',
  capabilities: [],
  profileUrl: '',
  readmeUrl: '',
};
export function serviceIdentity(input: Pick<ListingInput, 'homepage'>) {
  const u = new URL(cleanUrl(input.homepage));
  return u.hostname === 'github.com'
    ? u.origin + u.pathname.replace(/\/+$/, '').toLowerCase()
    : u.origin;
}
export function profileLocation(
  input: Pick<ListingInput, 'homepage' | 'profileUrl'>,
) {
  const home = new URL(cleanUrl(input.homepage));
  if (
    [
      'github.com',
      'raw.githubusercontent.com',
      'npmjs.com',
      'www.npmjs.com',
      'pypi.org',
    ].includes(home.hostname)
  )
    throw new Error(
      'For free verification, use your project website as the homepage and publish the Agentic Protocol files there.',
    );
  const profile = new URL(
    input.profileUrl ? cleanUrl(input.profileUrl) : '/agentic.json',
    home,
  );
  if (profile.pathname.endsWith('/')) profile.pathname += 'agentic.json';
  if (profile.origin !== home.origin)
    throw new Error(
      'Publish the profile on the same origin as the project homepage.',
    );
  return profile.href;
}
export function safeNext(value: string | null) {
  return value &&
    /^\/(?:submit|dashboard|reset-password)(?:[/?]|$)/.test(value) &&
    !value.includes('\\')
    ? value
    : '/dashboard';
}
export function publicationEligible(report: unknown, profileUrl: string) {
  const r = report as {
    valid?: boolean;
    reportVersion?: string;
    profileUrl?: string;
    publication?: { status: string };
    textIndex?: { status: string };
    readme?: { status: string };
  };
  return (
    r?.reportVersion === '3' &&
    r.valid === true &&
    r.profileUrl === profileUrl &&
    r.publication?.status === 'successful' &&
    r.textIndex?.status === 'matched' &&
    r.readme?.status === 'matched'
  );
}
export const listingPrice = {
  amount: 4999,
  currency: 'usd',
  display: 'US$49.99',
  termsVersion: '2026-09-08',
} as const;
