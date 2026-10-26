import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { resetMemoryStore } from '@/lib/db/store';

/** Test hook: restores the in-memory seed. Only in demo mode and only when DM_ALLOW_RESET=1. */
export async function POST() {
  if (isSupabaseConfigured() || process.env.DM_ALLOW_RESET !== '1') return new NextResponse('Not found', { status: 404 });
  resetMemoryStore();
  return NextResponse.json({ ok: true });
}
