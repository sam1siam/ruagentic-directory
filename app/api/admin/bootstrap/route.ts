import { z } from 'zod';
import { body, cronAuthorized, HttpError, respond } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin-policy';
export const runtime = 'nodejs';
const input = z
  .object({
    email: z.email().trim(),
    password: z.string().min(12).max(200),
  })
  .strict();
/** Creates or resets the password of an admin account without putting the
 *  password anywhere in the repository. Callable only with the CRON_SECRET:
 *  curl -X POST https://ruagentic.com/api/admin/bootstrap \
 *    -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
 *    -d '{"email":"hello@ruagentic.com","password":"..."}' */
export async function POST(request: Request) {
  return respond(async () => {
    if (!cronAuthorized(request)) throw new HttpError(401, 'Unauthorized.');
    const { email, password } = input.parse(await body(request, 4096));
    if (!isAdminEmail(email))
      throw new HttpError(403, 'That address is not in ADMIN_EMAILS.');
    const auth = adminClient().auth.admin;
    let existing: { id: string } | null = null;
    for (let page = 1; page <= 5 && !existing; page++) {
      const { data, error } = await auth.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      existing =
        data.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        ) ?? null;
      if (data.users.length < 1000) break;
    }
    if (existing) {
      const { error } = await auth.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      return { email, updated: true };
    }
    const { error } = await auth.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return { email, created: true };
  });
}
