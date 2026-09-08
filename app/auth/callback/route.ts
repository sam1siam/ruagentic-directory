import { userClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/server/http';
import {
  handleOAuthCallback,
  authResponseHeaders,
} from '@/lib/auth-navigation';
export async function GET(request: Request) {
  return handleOAuthCallback(request, appUrl(), async (code) => {
    const { error } = await (
      await userClient()
    ).auth.exchangeCodeForSession(code);
    return !error;
  });
}
export function HEAD() {
  return new Response(null, {
    status: 405,
    headers: { ...authResponseHeaders, Allow: 'GET' },
  });
}
