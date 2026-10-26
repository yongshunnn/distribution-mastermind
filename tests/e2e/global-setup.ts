import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0].use.baseURL;
  const r = await fetch(`${base}/api/demo/reset`, { method: 'POST' });
  if (!r.ok) throw new Error(`Demo reset failed (${r.status}). Start the server with DM_ALLOW_RESET=1 and no Supabase env.`);
}
