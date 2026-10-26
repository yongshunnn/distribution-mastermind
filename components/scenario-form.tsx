import { Button, Field, Input } from './ui';
import { saveScenario } from '@/app/actions/scenarios';

export function ScenarioForm({ plays, initial }: { plays: { id: string; label: string }[]; initial?: { id: string; name: string; play_ids: string[]; limits: Record<string, number | null | undefined> } }) {
  const lim = initial?.limits ?? {};
  return (
    <form action={saveScenario} className="grid gap-3 sm:grid-cols-2">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field label="Name" className="sm:col-span-2"><Input name="name" required defaultValue={initial?.name ?? 'Next 12 months'} /></Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-medium text-muted-foreground">Plays</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {plays.map((p) => (
            <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="play_ids" value={p.id} defaultChecked={initial ? initial.play_ids.includes(p.id) : true} className="size-5" /> {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Capital cap (SGD) — entry cost + working capital"><Input name="capital" inputMode="decimal" defaultValue={lim.capital ?? ''} /></Field>
      <Field label="Working-capital limit (SGD)"><Input name="wc_limit" inputMode="decimal" defaultValue={lim.wc_limit ?? ''} /></Field>
      <Field label="People available (FTE)"><Input name="people" inputMode="decimal" defaultValue={lim.people ?? ''} /></Field>
      <Field label="Warehouse pallets available"><Input name="pallets" inputMode="numeric" defaultValue={lim.pallets ?? ''} /></Field>
      <div className="sm:col-span-2"><Button type="submit">Save and run</Button></div>
    </form>
  );
}
