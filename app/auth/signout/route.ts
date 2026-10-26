import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
