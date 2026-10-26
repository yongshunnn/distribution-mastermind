import Link from 'next/link';
import { SECONDARY_LINKS } from './links';
import { isSupabaseConfigured } from '@/lib/env';
import { getStore } from '@/lib/db/store';
import { isTrialEnabled } from '@/lib/trial';
import { TrialSwitchOn } from '@/components/trial';
import { exitTrial } from '@/app/actions/trial';

export const metadata = { title: 'More' };

export default async function MorePage() {
  const store = await getStore();
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">More</h1>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {SECONDARY_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-14 items-center justify-between px-4">
              <span>
                <span className="block text-sm font-medium">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </span>
              <span aria-hidden="true" className="text-muted-foreground">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {store.mode === 'trial' ? (
          <form action={exitTrial}>
            <button className="min-h-11 w-full rounded-lg border border-primary text-sm font-medium text-primary">Exit trial mode</button>
          </form>
        ) : store.mode === 'supabase' && isTrialEnabled() ? (
          <TrialSwitchOn />
        ) : null}
      </div>
      {isSupabaseConfigured() && store.mode === 'supabase' ? (
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="min-h-11 w-full rounded-lg border border-border text-sm">Sign out</button>
        </form>
      ) : null}
    </div>
  );
}
