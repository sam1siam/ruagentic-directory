import { userClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/server/http';
import { handleConfirmation } from '@/lib/auth-confirmation';

async function confirm(request: Request) {
  return handleConfirmation(request, appUrl(), async (input) => {
    const { error } = await (await userClient()).auth.verifyOtp(input);
    return !error;
  });
}

export { confirm as GET, confirm as HEAD, confirm as POST };
