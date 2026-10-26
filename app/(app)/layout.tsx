import Link from 'next/link';
import { BottomNav, SideNav } from '@/components/nav';
import { GlossaryProvider } from '@/components/explain-card';
import { glossaryMap } from '@/lib/db/data';
import { getStore } from '@/lib/db/store';
import { isSupabaseConfigured } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await getStore();
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    email = await store.userEmail();
    const { data: member } = await (await supabaseServer()).rpc('is_member');
    if (!member) {
      return (
        <main className="mx-auto max-w-sm px-4 py-16 text-sm">
          <h1 className="text-xl font-semibold">Not on the team allowlist</h1>
          <p className="mt-2 text-muted-foreground">{email ?? 'This account'} is signed in but is not a workspace member. Ask the owner to add the email to allowed_users.</p>
          <form action="/auth/signout" method="post" className="mt-4">
            <button className="min-h-11 rounded-lg border border-border px-4">Sign out</button>
          </form>
        </main>
      );
    }
  }
  const glossary = await glossaryMap();
  return (
    <GlossaryProvider value={glossary}>
      {store.mode === 'memory' ? (
        <div className="bg-warn-bg px-4 py-1.5 text-center text-xs text-warn" role="status">
          Demo mode — seed data in memory; edits reset when the server restarts. Configure Supabase to persist.
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-7xl gap-6 md:px-6">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col py-6 md:flex">
          <Link href="/home" className="mb-6 px-3 text-base font-semibold tracking-tight">
            Distribution<br />Mastermind
          </Link>
          <SideNav />
          <div className="mt-auto px-3 text-xs text-muted-foreground">
            {email ? (
              <form action="/auth/signout" method="post" className="space-y-1">
                <p className="truncate">{email}</p>
                <button className="underline">Sign out</button>
              </form>
            ) : null}
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-x-clip px-4 pt-4 pb-24 md:px-0 md:pt-6 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </GlossaryProvider>
  );
}
