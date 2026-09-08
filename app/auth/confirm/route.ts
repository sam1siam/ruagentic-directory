import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/listing';
import { appUrl } from '@/lib/server/http';
export async function GET(request: Request) {
  const url = new URL(request.url),
    token = url.searchParams.get('token_hash'),
    type = url.searchParams.get('type');
  if (
    token &&
    ['signup', 'recovery', 'email_change', 'email'].includes(type ?? '')
  ) {
    const { error } = await (
      await userClient()
    ).auth.verifyOtp({
      token_hash: token,
      type: type as 'signup' | 'recovery' | 'email_change' | 'email',
    });
    if (!error)
      return NextResponse.redirect(
        new URL(
          type === 'recovery'
            ? '/reset-password'
            : safeNext(url.searchParams.get('next')),
          appUrl(),
        ),
      );
  }
  return NextResponse.redirect(new URL('/login?error=link', appUrl()));
}
