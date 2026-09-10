import {
  respond,
  sameOrigin,
  signedIn,
  body,
  rateLimit,
} from '@/lib/server/http';
import { saveSubmission } from '@/lib/server/submissions';
import { duplicatesFor } from '@/lib/server/duplicates';
import { adminClient } from '@/lib/supabase/server';
export async function GET() {
  return respond(async () => {
    const user = await signedIn();
    const { data, error } = await adminClient()
      .from('submissions')
      .select('id,payload,revision,state,slug,updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return { submissions: data };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('save:' + user.id, 100);
    const submission = await saveSubmission(
      user.id,
      await body(request, 131072),
    );
    return {
      submission,
      duplicates: await duplicatesFor(submission.payload, submission.slug),
    };
  });
}
