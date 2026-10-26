import { createHash } from 'node:crypto';

/** Deterministic UUID (v5-style, SHA-1) so seed rows keep stable ids across runs. */
export function seedId(name: string): string {
  const h = createHash('sha1').update(`distribution-mastermind:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export const WORKSPACE_ID = seedId('workspace');
