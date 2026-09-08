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
  const retry = new URL('/login', appUrl());
  retry.searchParams.set('error', 'link');
  retry.searchParams.set('next', safeNext(url.searchParams.get('next')));
  return NextResponse.redirect(retry);
}
