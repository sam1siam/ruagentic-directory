import { respond, sameOrigin, signedIn } from '@/lib/server/http';
import { ownedSubmission, databaseError } from '@/lib/server/submissions';
import { adminClient } from '@/lib/supabase/server';
import { invalidateCatalog } from '@/lib/server/catalog-cache';
/** Removes a draft or unpublished listing from the owner's account for
 *  good. Published listings are unpublished first; anything with a payment
 *  on record is refused so payment history stays. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn(),
      { id } = await params;
    await ownedSubmission(user.id, id);
    const { error } = await adminClient().rpc('discard_submission', {
      p_owner: user.id,
      p_id: id,
    });
    if (error) databaseError(error);
    invalidateCatalog();
    return { discarded: true };
  });
}
