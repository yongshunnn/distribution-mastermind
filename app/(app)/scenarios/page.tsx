import Link from 'next/link';
import { Card, CardTitle, Empty, PageHeader } from '@/components/ui';
import { ScenarioForm } from '@/components/scenario-form';
import { rows } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';

export const metadata = { title: 'Scenarios' };

export default async function ScenariosPage() {
  const [scenarios, plays] = await Promise.all([rows('scenarios'), buildAllPlays()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Scenarios" subtitle="Pick plays, set limits on capital, working capital, people and warehouse space, and get a ranked plan with the monthly cash need." />
      {scenarios.length ? (
        <ul className="space-y-2">
          {scenarios.map((s) => (
            <li key={s.id}><Link href={`/scenarios/${s.id}`} className="flex min-h-12 items-center rounded-xl border border-border bg-card px-4 font-medium hover:border-primary">{s.name}</Link></li>
          ))}
        </ul>
      ) : (
        <Empty title="No scenarios yet" />
      )}
      <Card>
        <CardTitle>New scenario</CardTitle>
        <ScenarioForm plays={plays.map((p) => ({ id: p.play.id, label: `${playTitle(p)} · ${p.market.name}` }))} />
      </Card>
    </div>
  );
}
