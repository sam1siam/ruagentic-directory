import { z } from 'zod';
import { adminClient } from '../supabase/server';
import {
  listingSchema,
  serviceIdentity,
  profileLocation,
  publicationEligible,
  type ListingInput,
} from '../listing';
import { HttpError } from './http';
import { duplicatesFor, mergeListing } from './duplicates';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
export type Submission = {
  id: string;
  owner_id: string;
  revision: number;
  payload: ListingInput;
  identity_key: string;
  state: string;
  slug: string | null;
  updated_at: string;
};
export const revisionInput = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
});
export function databaseError(error: { message: string; code?: string }) {
  const messages: Record<string, string> = {
    revision_conflict:
      'This listing changed in another tab. Reload before continuing.',
    published_identity_locked:
      'A published listing cannot be reassigned to a different website.',
    checkout_in_progress:
      'Finish or cancel the existing checkout before editing.',
    fresh_verification_required:
      'Run the Agentic Protocol checker again before publishing.',
    verified_payment_required: 'A completed payment is required.',
    submission_suspended: 'This listing is unavailable. Contact support.',
    submission_unavailable: 'This listing is unavailable.',
    confirmed_email_required: 'Confirm your email before publishing.',
  };
  if (error.code === '23505')
    throw new HttpError(
      409,
      'You already have a submission for this project. Open it from your dashboard.',
    );
  if (error.message === 'submission_not_found')
    throw new HttpError(404, 'Listing not found.');
  throw new HttpError(
    409,
    messages[error.message] ??
      'This change could not be saved. Reload and try again.',
  );
}
export async function ownedSubmission(owner: string, id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new HttpError(400, 'Invalid listing ID.');
  const { data, error } = await adminClient()
    .from('submissions')
    .select('*')
    .eq('id', id)
    .eq('owner_id', owner)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Listing not found.');
  return data as Submission;
}
export async function saveSubmission(owner: string, input: unknown) {
  const parsed = z
    .object({
      id: z.uuid().nullable().optional(),
      revision: z.number().int().positive().nullable().optional(),
      listing: listingSchema,
    })
    .strict()
    .refine(
      (v) => !v.id || Boolean(v.revision),
      'An existing listing requires its revision.',
    )
    .parse(input);
  const { data, error } = await adminClient().rpc('save_submission', {
    p_owner: owner,
    p_id: parsed.id ?? null,
    p_revision: parsed.revision ?? null,
    p_payload: parsed.listing,
    p_identity: serviceIdentity(parsed.listing),
  });
  if (error) databaseError(error);
  return data as Submission;
}
export async function auditSubmission(owner: string, input: unknown) {
  const { id, revision } = revisionInput.parse(input);
  const s = await ownedSubmission(owner, id);
  if (s.revision !== revision)
    throw new HttpError(409, 'Save your changes before running the checker.');
  let profileUrl: string;
  try {
    profileUrl = profileLocation(s.payload);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const client = new Client({ name: 'ruagentic-directory', version: '1.0.0' });
  let report: Record<string, unknown>;
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL('https://ruagentic.org/mcp')),
      { timeout: 15000 },
    );
    const result = await client.callTool(
      {
        name: 'audit_agentic_url',
        arguments: {
          url: profileUrl,
          ...(s.payload.readmeUrl ? { readmeUrl: s.payload.readmeUrl } : {}),
        },
      },
      { timeout: 55000 },
    );
    if (result.isError) throw new Error('The checker could not complete.');
    const block = result.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text')
      throw new Error('The checker returned no report.');
    report = JSON.parse(block.text);
  } finally {
    await client.close().catch(() => {});
  }
  const eligible = publicationEligible(report, profileUrl);
  const { data, error } = await adminClient()
    .from('audit_runs')
    .insert({
      submission_id: id,
      revision,
      identity_key: s.identity_key,
      profile_url: profileUrl,
      readme_url: s.payload.readmeUrl || null,
      report,
      eligible,
    })
    .select('id,report,eligible,checked_at,revision')
    .single();
  if (error) throw error;
  return data;
}
export async function publishSubmission(owner: string, input: unknown) {
  const parsed = revisionInput
    .extend({
      method: z.enum(['agentic', 'payment']),
      evidenceId: z.uuid(),
      acceptedTerms: z.literal(true),
    })
    .strict()
    .parse(input);
  const s = await ownedSubmission(owner, parsed.id);
  // Another account's listing that passed the publication checker proves
  // control of the project's domain, so it cannot be duplicated.
  const matches = await duplicatesFor(s.payload, s.slug);
  const claimed = matches.filter((m) => m.submitted && m.verified);
  if (claimed.length) {
    const { data: owners } = await adminClient()
      .from('submissions')
      .select('slug,owner_id')
      .in(
        'slug',
        claimed.map((m) => m.slug),
      );
    const other = claimed.find((m) =>
      (owners ?? []).some((o) => o.slug === m.slug && o.owner_id !== owner),
    );
    if (other)
      throw new HttpError(
        409,
        `This project is already listed by its verified owner at ruagentic.com/tools/${other.slug}. If that is you, sign in with that account; otherwise contact support.`,
      );
  }
  const { data, error } = await adminClient().rpc('publish_submission', {
    p_owner: owner,
    p_id: parsed.id,
    p_revision: parsed.revision,
    p_method: parsed.method,
    p_evidence: parsed.evidenceId,
  });
  if (error) databaseError(error);
  const merged: string[] = [];
  if (parsed.method === 'agentic')
    // A verified publication replaces imported entries for the same project;
    // listings other people paid for stay and go to the review queue.
    for (const m of matches.filter((x) => !x.submitted))
      try {
        await mergeListing(
          m.slug,
          data.slug,
          'system',
          'Replaced by the verified listing ' + data.slug,
        );
        merged.push(m.slug);
      } catch {
        /* the admin queue still shows the pair */
      }
  return {
    slug: data.slug,
    url: 'https://ruagentic.com/tools/' + data.slug,
    merged,
  };
}
