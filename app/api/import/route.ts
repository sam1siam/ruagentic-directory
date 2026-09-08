import { z } from 'zod';
import {
  respond,
  sameOrigin,
  signedIn,
  body,
  rateLimit,
  HttpError,
} from '@/lib/server/http';
import { importProject } from '@/lib/server/import-project';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return respond(async () => {
    sameOrigin(request);
    const user = await signedIn();
    await rateLimit('import:' + user.id, 30);
    const input = z
      .object({
        url: z.string().max(2048),
        kind: z.enum(['server', 'client', 'product']),
        sourceType: z.enum(['homepage', 'repository', 'endpoint']),
      })
      .strict()
      .parse(await body(request));
    try {
      return await importProject(input.url, input.kind, input.sourceType);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
  });
}
