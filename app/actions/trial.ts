'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isSupabaseConfigured } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { resetTrialStore, trialUser } from '@/lib/db/store';
import { isTrialEnabled, signTrial, TRIAL_COOKIE, TRIAL_MAX_AGE } from '@/lib/trial';

export interface TrialState {
  ok: boolean;
  error?: string;
}

/** Turns trial mode on for this browser. Signed-in members go straight in; otherwise the email must be on the allowlist. */
export async function startTrial(_prev: TrialState | null, form: FormData): Promise<TrialState> {
  if (!isTrialEnabled()) return { ok: false, error: 'Trial mode is switched off for this workspace.' };
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    email = data.user?.email ?? null;
    if (!email) {
      const parsed = z.string().trim().email().safeParse(form.get('email'));
      if (!parsed.success) return { ok: false, error: 'Enter your work email.' };
      const { data: allowed, error } = await sb.rpc('is_email_allowed', { p_email: parsed.data });
      if (error) return { ok: false, error: 'Could not check the allowlist. Try again.' };
      if (!allowed) return { ok: false, error: 'This email is not on the team allowlist.' };
      email = parsed.data;
    }
  } else {
    email = String(form.get('email') ?? '').trim() || 'trial@local';
  }
  (await cookies()).set(TRIAL_COOKIE, await signTrial(email), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TRIAL_MAX_AGE,
  });
  redirect('/home');
}

/** Turns trial mode off for this browser (back to live data, or to sign-in). */
export async function exitTrial() {
  (await cookies()).delete(TRIAL_COOKIE);
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const { data } = await (await supabaseServer()).auth.getUser();
    signedIn = Boolean(data.user);
  }
  redirect(signedIn ? '/home' : '/login');
}

/** Puts the sample data back the way it started. */
export async function resetTrial() {
  if (!(await trialUser())) return;
  resetTrialStore();
  revalidatePath('/', 'layout');
}
