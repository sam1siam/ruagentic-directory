import { createBrowserClient } from '@supabase/ssr';
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      'Account services are being configured. Please try again shortly.',
    );
  return createBrowserClient(url, key, {
    cookieOptions: {
      sameSite: 'lax',
      secure:
        typeof window === 'undefined' || window.location.protocol === 'https:',
    },
  });
}
