import { NextResponse, type NextRequest } from 'next/server';
import { JOBS } from '@/lib/pull/jobs';
import { supabaseService } from '@/lib/supabase/server';

/** Vercel Cron entry point. Protected by CRON_SECRET (sent by Vercel as a Bearer token). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return new NextResponse('Unknown job', { status: 404 });
  const svc = supabaseService();
  if (!svc) return NextResponse.json({ ok: false, error: 'Supabase service role not configured' }, { status: 500 });
  try {
    const result = await run(svc);
    console.log(`[cron:${job}]`, JSON.stringify(result));
    return NextResponse.json({ ok: true, job, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, job, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
