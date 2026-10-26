import { Badge, Button, Card, CardTitle, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { ValueTable } from '@/components/value-table';
import { rows, settings, valueIndex, WORKSPACE_ID } from '@/lib/db/data';
import { leaf } from '@/lib/calc/traced';
import { STAGE_NAMES } from '@/lib/stages';
import { addAllowedUser, addFxRate, saveBenchmark, saveGlossary, saveSettings, saveTemplateItem } from '@/app/actions/settings';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const [cfg, idx, glossary, benchmarks, tpl, fx, users, watchouts, markets] = await Promise.all([
    settings(), valueIndex(), rows('glossary'), rows('terms_benchmarks'), rows('stage_items_template'), rows('fx_rates'), rows('allowed_users'), rows('watchouts'), rows('markets'),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Glossary, benchmarks, stage templates, FX, thresholds, score weights and users." />

      <Card>
        <CardTitle>Thresholds</CardTitle>
        <form action={saveSettings} className="grid gap-3 sm:grid-cols-3">
          <Field label="Stale after (days)"><Input name="stale_threshold_days" type="number" min={1} defaultValue={cfg.staleDays} /></Field>
          <Field label="Mainstream cluster window (± %)"><Input name="cluster_width_pct" type="number" step="0.5" defaultValue={cfg.clusterWidthPct} /></Field>
          <div className="self-end"><Button type="submit" variant="secondary">Save</Button></div>
        </form>
      </Card>

      <Card>
        <CardTitle>Score weights, finance rate and model defaults</CardTitle>
        <p className="mb-2 text-xs text-muted-foreground">Tap a value to edit. Weights are normalised, so they need not add to 100%.</p>
        <ValueTable values={idx.forEntity('workspace', WORKSPACE_ID)} idx={idx} />
      </Card>

      <Card>
        <CardTitle>Glossary (drives every explain card)</CardTitle>
        <ul className="divide-y divide-border">
          {glossary.map((g) => (
            <li key={g.id}>
              <details>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-medium">{g.label}</span> <span className="text-xs text-muted-foreground">{g.key}</span></span>
                  <span className="text-muted-foreground" aria-hidden="true">›</span>
                </summary>
                <form action={saveGlossary} className="grid gap-2 pb-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="key" value={g.key} />
                  <Field label="Label"><Input name="label" defaultValue={g.label} required /></Field>
                  <Field label="Unit"><Input name="unit" defaultValue={g.unit ?? ''} /></Field>
                  <Field label="Meaning" className="sm:col-span-2"><Textarea name="meaning" defaultValue={g.meaning} required /></Field>
                  <Field label="Formula" className="sm:col-span-2"><Input name="formula_text" defaultValue={g.formula_text ?? ''} /></Field>
                  <div><Button type="submit" variant="secondary">Save</Button></div>
                </form>
              </details>
            </li>
          ))}
        </ul>
        <Disclosure summary="Add a glossary term">
          <form action={saveGlossary} className="grid gap-2 sm:grid-cols-2">
            <Field label="Key"><Input name="key" required /></Field>
            <Field label="Label"><Input name="label" required /></Field>
            <Field label="Meaning" className="sm:col-span-2"><Textarea name="meaning" required /></Field>
            <Field label="Formula"><Input name="formula_text" /></Field>
            <Field label="Unit"><Input name="unit" /></Field>
            <div><Button type="submit">Add</Button></div>
          </form>
        </Disclosure>
      </Card>

      <Card>
        <CardTitle>Terms benchmarks</CardTitle>
        <ul className="divide-y divide-border text-sm">
          {benchmarks.map((b) => {
            const u = b.unit === 'pct' ? '%' : (b.unit ?? '');
            const src = { label: b.source ?? 'no source', url: b.source_url ?? undefined };
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{b.role} · {b.metric.replace(/_/g, ' ')} <span className="text-xs text-muted-foreground">· {markets.find((m) => m.id === b.market_id)?.name ?? 'any market'} · {b.source}</span></span>
                <span className="flex items-center gap-1">
                  {b.low != null ? <Num t={leaf('benchmark_low', u === '%' ? Number(b.low) / 100 : Number(b.low), u, { tag: b.tag, label: `${b.role} ${b.metric} — low`, source: src })} /> : null}
                  {b.low != null && b.high != null ? '–' : null}
                  {b.high != null ? <Num t={leaf('benchmark_high', u === '%' ? Number(b.high) / 100 : Number(b.high), u, { tag: b.tag, label: `${b.role} ${b.metric} — high`, source: src })} /> : null}
                  {b.text_value ? <span>{b.text_value}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <Disclosure summary="Add a benchmark">
          <form action={saveBenchmark} className="grid gap-2 sm:grid-cols-3">
            <Field label="Role"><Input name="role" required placeholder="Distributor" /></Field>
            <Field label="Metric"><Select name="metric">{['gross_margin', 'incentive', 'credit_days', 'review_cadence', 'exclusivity_rule', 'term_months'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="Market"><Select name="market_id" defaultValue=""><option value="">Any</option>{markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
            <Field label="Low"><Input name="low" inputMode="decimal" /></Field>
            <Field label="High"><Input name="high" inputMode="decimal" /></Field>
            <Field label="Unit"><Select name="unit" defaultValue="pct"><option value="pct">%</option><option value="days">days</option><option value="months">months</option><option value="">—</option></Select></Field>
            <Field label="Or text rule" className="sm:col-span-2"><Input name="text_value" /></Field>
            <Field label="Tag"><TagSelect /></Field>
            <Field label="Source"><Input name="source" /></Field>
            <Field label="Link" className="sm:col-span-2"><Input name="source_url" type="url" /></Field>
            <div><Button type="submit">Add</Button></div>
          </form>
        </Disclosure>
      </Card>

      <Card>
        <CardTitle>Stage template (new trackers start from this)</CardTitle>
        {[1, 2, 3, 4, 5, 6, 7].map((st) => (
          <div key={st} className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{st} · {STAGE_NAMES[st]}</p>
            <ul className="divide-y divide-border">
              {tpl.filter((t) => t.stage_no === st).sort((a, b) => a.sort - b.sort).map((t) => (
                <li key={t.id}>
                  <details>
                    <summary className="min-h-11 cursor-pointer list-none py-2 text-sm">{t.item}{t.required ? ' ✱' : ''}{t.watch_out ? <span className="block text-xs text-warn">Watch out: {t.watch_out}</span> : null}</summary>
                    <form action={saveTemplateItem} className="grid gap-2 pb-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="stage_no" value={t.stage_no} />
                      <input type="hidden" name="sort" value={t.sort} />
                      <Field label="Item" className="sm:col-span-2"><Input name="item" defaultValue={t.item} required /></Field>
                      <Field label="Watch-out"><Input name="watch_out" defaultValue={t.watch_out ?? ''} /></Field>
                      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked={t.required} className="size-5" /> Required</label>
                      <div><Button type="submit" variant="secondary">Save</Button></div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Disclosure summary="Add a template item">
          <form action={saveTemplateItem} className="grid gap-2 sm:grid-cols-3">
            <Field label="Stage"><Select name="stage_no">{[1, 2, 3, 4, 5, 6, 7].map((s) => <option key={s} value={s}>{s} · {STAGE_NAMES[s]}</option>)}</Select></Field>
            <Field label="Item" className="sm:col-span-2"><Input name="item" required /></Field>
            <Field label="Watch-out" className="sm:col-span-2"><Input name="watch_out" /></Field>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="required" className="size-5" /> Required</label>
            <div><Button type="submit">Add</Button></div>
          </form>
        </Disclosure>
      </Card>

      <Card>
        <CardTitle>Watch-out library</CardTitle>
        <ul className="space-y-1 text-sm">
          {watchouts.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2">
              {w.stage_no ? <Badge>S{w.stage_no}</Badge> : null}
              {w.text}
              {w.learned_from_market_id ? <span className="text-xs text-muted-foreground">· learned in {markets.find((m) => m.id === w.learned_from_market_id)?.name}</span> : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>FX rates (1 base = rate quote; reporting currency SGD)</CardTitle>
        <ul className="divide-y divide-border text-sm">
          {fx.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span>{r.base} → {r.quote} <span className="text-xs text-muted-foreground">· {r.month.slice(0, 7)} · {r.source}</span></span>
              <Num t={leaf('fx_rate', Number(r.rate), `${r.quote}/${r.base}`, { tag: r.tag, label: `${r.base} → ${r.quote}`, source: { label: r.source ?? 'fx_rates', asOf: r.month } })} />
            </li>
          ))}
        </ul>
        <Disclosure summary="Add a rate">
          <form action={addFxRate} className="grid gap-2 sm:grid-cols-3">
            <Field label="Base"><Input name="base" required maxLength={3} placeholder="MYR" /></Field>
            <Field label="Quote"><Input name="quote" required maxLength={3} placeholder="SGD" /></Field>
            <Field label="Rate"><Input name="rate" inputMode="decimal" required /></Field>
            <Field label="Month"><Input name="month" type="month" required /></Field>
            <Field label="Tag"><TagSelect defaultValue="public" /></Field>
            <Field label="Source"><Input name="source" /></Field>
            <div><Button type="submit">Add</Button></div>
          </form>
        </Disclosure>
      </Card>

      <Card>
        <CardTitle>Users (sign-in allowlist)</CardTitle>
        <ul className="space-y-1 text-sm">{users.map((u) => <li key={u.email}>{u.email} <span className="text-xs text-muted-foreground">· {u.role}</span></li>)}</ul>
        <form action={addAllowedUser} className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Email"><Input name="email" type="email" required /></Field>
          <Field label="Name"><Input name="display_name" /></Field>
          <Button type="submit" variant="secondary">Allow</Button>
        </form>
      </Card>
    </div>
  );
}
