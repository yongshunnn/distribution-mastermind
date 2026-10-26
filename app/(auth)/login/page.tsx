import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Distribution Mastermind</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Which play still makes money after every cost — and what it takes to get there.</p>
      {sp.error ? <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{sp.error}</p> : null}
      {isSupabaseConfigured() ? (
        <LoginForm next={sp.next ?? '/home'} />
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          <p>
            <strong>Demo mode.</strong> No Supabase project is configured, so the app runs on the built-in seed data and changes reset when
            the server restarts.
          </p>
          <Link href="/home" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground">
            Open the app
          </Link>
        </div>
      )}
    </main>
  );
}
