import { NextResponse, type NextRequest } from 'next/server';
import { buildProposal } from '@/lib/proposal';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const p = await buildProposal({ principalId: q.get('principal') ?? '', marketId: q.get('market') ?? '', role: q.get('role') ?? '', partnerId: q.get('partner') ?? undefined });
  if (!p) return new NextResponse('Not found', { status: 404 });
  const name = p.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return new NextResponse(p.markdown, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.md"` } });
}
