import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildSeed, seedCounts } from '@/lib/seed/build';
import { datasetToSql } from '@/lib/seed/sql';

const d = buildSeed();
const file = path.resolve(process.cwd(), 'supabase/seed.sql');
writeFileSync(file, datasetToSql(d));
console.log(`Wrote ${file}`);
console.table(seedCounts(d));
