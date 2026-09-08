import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/listing';
import { appUrl } from '@/lib/server/http';
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get('code');
  if (code) {
    const { error } = await (
      await userClient()
    ).auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeNext(url.searchParams.get('next')), appUrl()),
      );
  }
  return NextResponse.redirect(new URL('/login?error=link', appUrl()));
}
