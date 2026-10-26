import { Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { TagSelect } from '@/components/forms';
import { rows } from '@/lib/db/data';
import { createPlay } from '@/app/actions/plays';

export const metadata = { title: 'New play' };

const ROUTES = ['retail_chain', 'distributor', 'full_service_distributor', 'importer_of_record', 'b2b_platform', 'co_packer', 'own_entry'];

export default async function NewPlay({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const sp = await searchParams;
  const [skus, channels, markets, segments] = await Promise.all([rows('sku_configs'), rows('channels'), rows('markets'), rows('segments')]);
  const chans = channels.filter((c) => !sp.market || c.market_id === sp.market);
  return (
    <div>
      <PageHeader back={{ href: '/plays', label: 'Plays' }} title="New play" subtitle="Pick a SKU configuration, a channel (which fixes the market) and the segment it serves. Costs come from market and channel defaults until you override them." />
      <Card>
        <form action={createPlay} className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU configuration">
            <Select name="sku_config_id" required>
              {skus.map((s) => <option key={s.id} value={s.id}>{s.sku_code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Channel">
            <Select name="channel_id" required>
              {chans.map((c) => <option key={c.id} value={c.id}>{markets.find((m) => m.id === c.market_id)?.name} · {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Segment">
            <Select name="segment_id" defaultValue="">
              <option value="">—</option>
              {segments.filter((s) => !sp.market || s.market_id === sp.market).map((s) => <option key={s.id} value={s.id}>{markets.find((m) => m.id === s.market_id)?.iso2} · {s.outlet_type}</option>)}
            </Select>
          </Field>
          <Field label="Route">
            <Select name="route_type" defaultValue="retail_chain">{ROUTES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</Select>
          </Field>
          <Field label="Name (optional)"><Input name="name" /></Field>
          <Field label="Target shelf price (market currency)"><Input name="shelf_price" inputMode="decimal" /></Field>
          <Field label="Realistic units / month"><Input name="q_realistic_month" inputMode="numeric" /></Field>
          <Field label="Entry cost (market currency)"><Input name="entry_cost" inputMode="decimal" /></Field>
          <Field label="Certificates of origin held" hint="e.g. Form D, Form E — leave blank for MFN"><Input name="coo_forms" /></Field>
          <Field label="Tag for these numbers"><TagSelect defaultValue="estimated" /></Field>
          <div className="sm:col-span-2"><Button type="submit">Create play</Button></div>
        </form>
      </Card>
    </div>
  );
}
