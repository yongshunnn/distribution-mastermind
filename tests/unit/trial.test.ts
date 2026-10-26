import { afterEach, describe, expect, it } from 'vitest';
import { isTrialEnabled, signTrial, verifyTrial } from '@/lib/trial';
import { buildSeed } from '@/lib/seed/build';
import { addTrialExtras } from '@/lib/seed/trial';

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe('trial mode', () => {
  it('signs and verifies the trial cookie; tampering fails', async () => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    const c = await signTrial('yongshun@staffgo.sg');
    expect(await verifyTrial(c)).toBe('yongshun@staffgo.sg');
    expect(await verifyTrial(c.replace(/.$/, (x) => (x === 'a' ? 'b' : 'a')))).toBeNull();
    const [, sig] = c.split('.');
    expect(await verifyTrial(`${btoa('attacker@x.com').replace(/=+$/, '')}.${sig}`)).toBeNull();
  });

  it('TRIAL_MODE=off turns it off everywhere, and production needs a secret', async () => {
    process.env.CRON_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    const c = await signTrial('a@b.co');
    process.env.TRIAL_MODE = 'off';
    expect(isTrialEnabled()).toBe(false);
    expect(await verifyTrial(c)).toBeNull();
    delete process.env.TRIAL_MODE;
    delete process.env.CRON_SECRET;
    delete process.env.TRIAL_SECRET;
    expect(isTrialEnabled()).toBe(false);
  });

  it('sample extras are fictional, tagged placeholder and sourced', () => {
    const base = buildSeed();
    const d = addTrialExtras(buildSeed());
    expect(d.shelf_observations.length).toBeGreaterThan(base.shelf_observations.length);
    expect(d.partners.length).toBe(base.partners.length + 2);
    const added = d.tracked_values.filter((v) => !base.tracked_values.some((b) => b.id === v.id));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((v) => v.tag === 'placeholder' && v.source_label === 'Trial sample (fictional)')).toBe(true);
    // The starter seed itself is untouched.
    expect(buildSeed().shelf_observations).toHaveLength(0);
  });
});
