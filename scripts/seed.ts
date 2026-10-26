// Pushes the seed to a Supabase project with the service role (bypasses RLS). Idempotent: existing ids are kept.
// Usage: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
import { createClient } from '@supabase/supabase-js';
import { buildSeed, seedCounts } from '@/lib/seed/build';
import { KEY_COLUMN, TABLE_ORDER } from '@/lib/db/types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const d = buildSeed();
for (const t of TABLE_ORDER) {
  const rows = d[t] as unknown as Record<string, unknown>[];
  if (!rows.length) continue;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(t).upsert(rows.slice(i, i + 500), { onConflict: KEY_COLUMN[t] ?? 'id', ignoreDuplicates: true });
    if (error) {
      console.error(`${t}: ${error.message}`);
      process.exit(1);
    }
  }
}
console.table(seedCounts(d));
