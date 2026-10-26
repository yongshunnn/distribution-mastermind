import { NextResponse, type NextRequest } from 'next/server';
import { readFile } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const f = await readFile(path.map(decodeURIComponent).join('/'));
  if (!f) return new NextResponse('Not found', { status: 404 });
  if (f.redirect) return NextResponse.redirect(f.redirect);
  return new NextResponse(new Uint8Array(f.data!), { headers: { 'Content-Type': f.type ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=300' } });
}
