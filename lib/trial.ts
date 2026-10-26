// Trial mode: explore the platform on a separate sample copy of the data, without touching the live database.
// On by default; set TRIAL_MODE=off to disable it for everyone. The trial cookie is HMAC-signed, so it
// cannot be forged; it needs a server secret (TRIAL_SECRET, else CRON_SECRET) to work at all.
export const TRIAL_COOKIE = 'dm_trial';
export const TRIAL_MAX_AGE = 60 * 60 * 24 * 7;

function secret(): string | null {
  return process.env.TRIAL_SECRET || process.env.CRON_SECRET || null;
}

export function isTrialEnabled(): boolean {
  if (process.env.TRIAL_MODE === 'off') return false;
  // Needs a signing secret in production; local demo mode (no Supabase) works without one.
  return Boolean(secret()) || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret() ?? 'local-demo'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cookie value: base64url(email).signature */
export async function signTrial(email: string): Promise<string> {
  const payload = btoa(email).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the trial email if the cookie is valid and trial mode is enabled. */
export async function verifyTrial(cookie: string | undefined | null): Promise<string | null> {
  if (!cookie || !isTrialEnabled()) return null;
  const [payload, sig] = cookie.split('.');
  if (!payload || !sig || (await hmac(payload)) !== sig) return null;
  try {
    return atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    return null;
  }
}
