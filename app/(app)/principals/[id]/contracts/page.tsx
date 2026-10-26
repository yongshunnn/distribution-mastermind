import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card, CardTitle, Empty, Field, KV, Select } from '@/components/ui';
import { Num } from '@/components/num';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { principalSetup } from '@/lib/db/principals';
import { removeFeeTerm } from '@/app/actions/principals';
import { addDocument } from '@/app/actions/partners';
import { fileUrl } from '@/lib/storage';

export default async function Contracts({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setup = await principalSetup(id);
  if (!setup) notFound();
  const [docs, idx] = await Promise.all([rows('documents'), valueIndex()]);
  const p = setup.principal;
  const mine = docs.filter((d) => d.entity_type === 'principal' && d.entity_id === id);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Contract</CardTitle>
        <dl>
          <KV label="Type">{p.contract_type?.replace('_', ' ') ?? 'To confirm'}</KV>
          <KV label="Territories">{p.territories.join(', ') || '—'}</KV>
          <KV label="Exclusivity">{p.exclusivity ?? '—'}</KV>
        </dl>
        <Link href={`/principals/${id}/setup?step=1`} className="mt-2 inline-flex min-h-11 items-center text-sm text-primary">Edit in setup step 1 →</Link>
      </Card>
      <Card>
        <CardTitle>Fee model</CardTitle>
        <p className="mb-2 text-xs text-muted-foreground">Trade-services fees: retainer, commission on sales, share of market profit — or a mix (rows are summed).</p>
        {setup.fees.length ? (
          <ul className="divide-y divide-border">
            {setup.fees.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="capitalize">{f.model.replace('_', ' ')}<span className="block text-xs normal-case text-muted-foreground">basis: {f.basis}{f.start_date ? ` · from ${f.start_date}` : ''}{f.end_date ? ` to ${f.end_date}` : ''}</span></span>
                <span className="flex items-center gap-2">
                  {f.amount ? <Num t={tracedFromValue(f.amount, idx)} /> : null}
                  <form action={removeFeeTerm}><input type="hidden" name="id" value={f.id} /><button className="min-h-11 min-w-11 text-muted-foreground" aria-label="Remove fee term">✕</button></form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No fee terms yet"><Link className="underline" href={`/principals/${id}/setup?step=1`}>Add in step 1</Link></Empty>
        )}
      </Card>
      <Card className="lg:col-span-2">
        <CardTitle>Contracts, quotes, certificates</CardTitle>
        {mine.length ? (
          <ul className="space-y-1 text-sm">{mine.map((d) => <li key={d.id}><Link className="underline" href={fileUrl(d.path)} target="_blank">{d.name}</Link> <span className="text-xs text-muted-foreground">{d.kind} · {d.uploaded_at.slice(0, 10)}</span></li>)}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        )}
        <form action={addDocument} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="entity_type" value="principal" />
          <input type="hidden" name="entity_id" value={id} />
          <Field label="Kind"><Select name="kind" defaultValue="contract"><option value="contract">Contract</option><option value="quote">Quote</option><option value="certificate">Certificate</option><option value="spec_sheet">Spec sheet</option></Select></Field>
          <input type="file" name="file" required className="min-h-11 text-sm" />
          <Button type="submit" variant="secondary">Upload</Button>
        </form>
      </Card>
    </div>
  );
}
