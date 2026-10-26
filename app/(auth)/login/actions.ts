'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export interface LoginState {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function sendMagicLink(_prev: LoginState | null, form: FormData): Promise<LoginState> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Demo mode — no login needed.' };
  const email = z.string().trim().email().safeParse(form.get('email'));
  if (!email.success) return { ok: false, error: 'Enter a valid email address.' };
  const sb = await supabaseServer();
  // Internal tool: only allowlisted emails get a link (spec §15.6).
  const { data: allowed, error: rpcError } = await sb.rpc('is_email_allowed', { p_email: email.data });
  if (rpcError) return { ok: false, error: 'Could not check the allowlist. Try again.' };
  if (!allowed) return { ok: false, error: 'This email is not on the team allowlist. Ask the owner to add you.' };
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const next = String(form.get('next') ?? '/home');
  const { error } = await sb.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith('/') ? next : '/home')}`, shouldCreateUser: true },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `Check ${email.data} for a sign-in link.` };
}
