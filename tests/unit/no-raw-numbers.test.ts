// Spec §7.2: never render a raw number in JSX — every number goes through <Num>.
// This guard fails if number formatting or raw Traced values appear outside the explain layer.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const ALLOWED = new Set(['components/num.tsx', 'components/explain-card.tsx', 'lib/format.ts']);
const PATTERNS: [RegExp, string][] = [
  [/\.toFixed\(/, 'toFixed'],
  [/\.toLocaleString\(/, 'toLocaleString'],
  [/Intl\.NumberFormat/, 'Intl.NumberFormat'],
  [/\bformat(Value|Plain|Traced|Delta)\(/, 'format helper'],
  [/\{\s*[\w.?!]+\.(value|value_num)\s*\}/, 'raw {x.value} in JSX'],
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' || f.startsWith('.') ? [] : files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

describe('no raw numbers in UI code', () => {
  const targets = [...files(path.join(ROOT, 'app')), ...files(path.join(ROOT, 'components'))];
  it('scans UI files', () => expect(targets.length).toBeGreaterThan(20));
  for (const f of targets) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    it(rel, () => {
      const src = readFileSync(f, 'utf8');
      const hits = PATTERNS.filter(([re]) => re.test(src)).map(([, name]) => name);
      expect(hits, `${rel} formats numbers outside <Num>: ${hits.join(', ')}`).toEqual([]);
    });
  }
});
