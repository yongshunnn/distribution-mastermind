import { marked } from 'marked';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { buildProposal } from '@/lib/proposal';
import { PrintButton } from './print-button';

export const metadata = { title: 'Proposal' };

export default async function ProposalPage({ searchParams }: { searchParams: Promise<{ principal?: string; market?: string; role?: string; partner?: string }> }) {
  const sp = await searchParams;
  const p = await buildProposal({ principalId: sp.principal ?? '', marketId: sp.market ?? '', role: sp.role ?? '', partnerId: sp.partner });
  if (!p) notFound();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const html = await marked.parse(p.markdown);
  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Proposal"
          subtitle="Edit the source data (brand story, evidence, role template, benchmarks) and this regenerates."
          actions={
            <>
              <a href={`/api/proposal?${qs}`} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm">Download .md</a>
              <PrintButton />
            </>
          }
        />
      </div>
      <article className="proposal max-w-3xl rounded-xl border border-border bg-card p-5 print:border-0 print:p-0" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
