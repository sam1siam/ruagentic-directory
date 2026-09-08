'use client';
import { browserClient } from '@/lib/supabase/browser';
import { Button } from './ui/button';
export default function SignOut() {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await browserClient().auth.signOut();
        window.location.assign('/');
      }}
    >
      Sign out
    </Button>
  );
}
