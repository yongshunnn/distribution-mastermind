import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, CardTitle, Empty } from '@/components/ui';
import { Num } from '@/components/num';
import { rows } from '@/lib/db/data';
import { missingFields, principalSetup } from '@/lib/db/principals';
import { buildAllPlays, playTitle } from '@/lib/db/plays';
import { sgdContribution } from '@/lib/db/portfolio';

const STEP_NAMES = ['Principal & brand', 'Production', 'Products & configurations', 'Current distribution', 'Sales numbers', 'Costs'];

export default async function PrincipalOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setup = await principalSetup(id);
  if (!setup) notFound();
  const [plays, snaps] = await Promise.all([buildAllPlays(), rows('setup_snapshots')]);
  const missing = missingFields(setup);
  const mine = plays.filter((p) => p.principalId === id);
  const history = snaps.filter((s) => s.principal_id === id).sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1)).slice(0, 8);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Setup progress</CardTitle>
        <ol className="space-y-2">
          {STEP_NAMES.map((n, i) => (
            <li key={n}>
              <Link href={`/principals/${id}/setup?step=${i + 1}`} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-border px-3 hover:border-primary">
                <span className="text-sm">{i + 1}. {n}</span>
                {missing[i + 1].length ? <Badge tone="warn">missing: {missing[i + 1].slice(0, 2).join(', ')}{missing[i + 1].length > 2 ? '…' : ''}</Badge> : <Badge tone="ok">complete</Badge>}
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <CardTitle>Plays</CardTitle>
        {mine.length ? (
          <>
            <p className="mb-2 text-sm">Total <Num t={sgdContribution(mine, setup.principal.name)} /></p>
            <ul className="divide-y divide-border">
              {mine.map((p) => (
                <li key={p.play.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/plays/${p.play.id}`} className="text-sm hover:underline">{playTitle(p)} <span className="text-xs text-muted-foreground">· {p.market.name}</span></Link>
                  <Num t={p.econ.perMonth} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty title="No plays yet"><Link className="underline" href="/plays/new">Create one</Link></Empty>
        )}
      </Card>
      <Card>
        <CardTitle>Brand</CardTitle>
        {setup.brands.map((b) => (
          <div key={b.id} className="text-sm">
            <p className="font-medium">{b.name}</p>
            {b.origin_claim ? <p className="text-muted-foreground">{b.origin_claim}</p> : null}
            {b.story ? <p className="mt-1">{b.story}</p> : null}
          </div>
        ))}
        {setup.principal.notes ? <p className="mt-2 text-sm text-muted-foreground">{setup.principal.notes}</p> : null}
      </Card>
      <Card>
        <CardTitle>Setup history</CardTitle>
        <p className="mb-2 text-xs text-muted-foreground">Every wizard save stores a dated snapshot.</p>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-2">
              <span>{h.step ? `Step ${h.step} · ${STEP_NAMES[h.step - 1]}` : 'Seed'}</span>
              <span className="text-xs text-muted-foreground">{h.taken_at.slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
