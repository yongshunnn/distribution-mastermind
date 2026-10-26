import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { TRIAL_COOKIE } from '@/lib/trial';

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) await (await supabaseServer()).auth.signOut();
  const res = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  res.cookies.delete(TRIAL_COOKIE);
  return res;
}
