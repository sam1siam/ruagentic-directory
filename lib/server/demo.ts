import 'server-only';
import { adminClient } from '../supabase/server';
import {
  auditSubmission,
  publishSubmission,
  saveSubmission,
  type Submission,
} from './submissions';
import { houseSponsor } from '../advertising';
import { serviceIdentity, type ListingInput } from '../listing';

/** Demo material for an admin's own account so the dashboard can be seen
 *  with a published listing, a draft and a sponsorship. Everything created
 *  is real or clearly marked: the published listing is RUAGENTIC's own MCP
 *  server and goes through the actual Agentic Protocol check; the draft is
 *  never public; the sponsorship is a test-mode order that never renders. */
const published: ListingInput = {
  kind: 'server',
  name: 'RUAGENTIC Directory MCP',
  summary:
    'Search the RUAGENTIC directory and read listing details from any MCP client through the hosted server at ruagentic.com/mcp.',
  description:
    'The directory’s own MCP server exposes two tools: search_directory, which searches listings by text, type and category, and get_listing, which returns the published details for one slug. It is a remote Streamable HTTP server with no authentication, backed by the same catalog as the website and the public REST API.',
  homepage: 'https://ruagentic.com',
  repository: '',
  documentation: 'https://ruagentic.com/developers',
  endpoint: 'https://ruagentic.com/mcp',
  category: 'Search & research',
  tags: ['mcp', 'directory', 'search'],
  pricing: 'free',
  transport: 'streamable-http',
  authentication: 'none',
  platforms: [],
  license: '',
  setup:
    'Add https://ruagentic.com/mcp to your MCP client as a Streamable HTTP server. No key is needed. Tools: search_directory(query, kind, category, limit) and get_listing(slug).',
  capabilities: ['Directory search', 'Listing details'],
  profileUrl: '',
  readmeUrl: '',
  agentCard: '',
  agentProtocol: '',
};
const draft: ListingInput = {
  kind: 'product',
  name: 'Agentic Protocol Generator',
  summary:
    'Generates agentic.json, agentic.txt and a README section for a website so agents can read its services and connections.',
  description:
    'Draft listing for the free generator at ruagentic.org. Fill in the remaining details, run the checker and publish for free with the Agentic Protocol files, or pay for a one-time listing.',
  homepage: 'https://ruagentic.org/generate/',
  repository: '',
  documentation: 'https://ruagentic.org/docs/',
  endpoint: '',
  category: 'Developer tools',
  tags: ['agentic protocol', 'generator'],
  pricing: 'free',
  transport: 'not-applicable',
  authentication: 'not-applicable',
  platforms: [],
  license: '',
  setup: '',
  capabilities: [
    'Profile generation',
    'Text index generation',
    'README section',
  ],
  profileUrl: '',
  readmeUrl: '',
  agentCard: '',
  agentProtocol: '',
};
export const demoSessionId = (ownerId: string) =>
  'cs_demo_' + ownerId.replace(/-/g, '').slice(0, 16);

async function existingSubmission(owner: string, identity: string) {
  const { data, error } = await adminClient()
    .from('submissions')
    .select('*')
    .eq('owner_id', owner)
    .eq('identity_key', identity)
    .maybeSingle();
  if (error) throw error;
  return (data as Submission | null) ?? null;
}
async function upsertDraft(owner: string, listing: ListingInput) {
  const identity = serviceIdentity(listing);
  const current = await existingSubmission(owner, identity);
  if (current) return current;
  return saveSubmission(owner, { listing });
}
export type DemoResult = {
  published: string;
  draft: string;
  sponsorship: string;
};
export async function createDemoData(admin: {
  id: string;
  email: string;
}): Promise<DemoResult> {
  const result: DemoResult = { published: '', draft: '', sponsorship: '' };
  // 1. The directory's own MCP server, checked for real and published free.
  const live = await upsertDraft(admin.id, published);
  if (live.state === 'published' && live.slug) {
    result.published = 'already published at /tools/' + live.slug;
  } else {
    const audit = await auditSubmission(admin.id, {
      id: live.id,
      revision: live.revision,
    });
    if (audit.eligible) {
      const done = await publishSubmission(admin.id, {
        id: live.id,
        revision: live.revision,
        method: 'agentic',
        evidenceId: audit.id,
        acceptedTerms: true,
      });
      result.published =
        'published free via the Agentic Protocol check at ' + done.url;
    } else {
      const report = audit.report as {
        checks?: { id?: string; status?: string; label?: string }[];
      };
      const failing = (report.checks ?? [])
        .filter((c) => c.status && c.status !== 'pass')
        .map((c) => c.label ?? c.id)
        .join(', ');
      result.published =
        'saved as a draft; the Agentic Protocol check did not pass (' +
        (failing || 'see the audit report') +
        ')';
    }
  }
  // 2. A draft that stays in editing.
  const d = await upsertDraft(admin.id, draft);
  result.draft = 'draft "' + draft.name + '" (' + d.state + ')';
  // 3. A test-mode sponsorship waiting in the approval queue.
  const session = demoSessionId(admin.id);
  const { error } = await adminClient()
    .from('ad_orders')
    .upsert(
      {
        stripe_session_id: session,
        stripe_subscription_id: null,
        stripe_customer_id: null,
        customer_email: admin.email,
        owner_id: admin.id,
        slug: 'astrofabric-demo',
        placement: 'both',
        product: houseSponsor.name + ' (demo)',
        tagline: houseSponsor.tagline,
        description: houseSponsor.description ?? '',
        cta: houseSponsor.cta ?? '',
        categories: 'data-intelligence,developer-tools',
        url: houseSponsor.url,
        status: 'active',
        approval: 'pending',
        livemode: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_session_id' },
    );
  if (error) throw error;
  result.sponsorship =
    'test-mode sponsorship "' +
    houseSponsor.name +
    ' (demo)" waiting for approval';
  return result;
}
export async function removeDemoData(admin: { id: string }) {
  const db = adminClient();
  const removed: string[] = [];
  for (const listing of [published, draft]) {
    const current = await existingSubmission(
      admin.id,
      serviceIdentity(listing),
    );
    if (!current) continue;
    const { error } = await db
      .from('submissions')
      .delete()
      .eq('id', current.id);
    if (error) throw error;
    removed.push(listing.name);
  }
  const { error, count } = await db
    .from('ad_orders')
    .delete({ count: 'exact' })
    .eq('stripe_session_id', demoSessionId(admin.id));
  if (error) throw error;
  if (count) removed.push('demo sponsorship');
  return removed;
}
