import { Button, Card, Field, PageHeader, Select } from '@/components/ui';
import { Num } from '@/components/num';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { leaf } from '@/lib/calc/traced';

export const metadata = { title: 'Compare SKUs' };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const [skus, families, packs, prices, idx] = await Promise.all([rows('sku_configs'), rows('product_families'), rows('pack_levels'), rows('sku_prices'), valueIndex()]);
  const a = skus.find((s) => s.id === sp.a) ?? skus[0];
  const b = skus.find((s) => s.id === sp.b) ?? skus[1];
  const facts = (s: (typeof skus)[number] | undefined) => {
    if (!s) return null;
    const fam = families.find((f) => f.id === s.family_id);
    const carton = packs.find((p) => p.sku_config_id === s.id && p.level === 'carton');
    const pallet = packs.find((p) => p.sku_config_id === s.id && p.level === 'pallet');
    const exw = prices.find((p) => p.sku_config_id === s.id && p.price_type === 'supplier_exw');
    const exwV = exw && idx.get('sku_price', exw.id, 'price');
    const ml = Number((s.variant_attrs as Record<string, unknown>).size_ml ?? 0);
    const src = { label: `${s.sku_code} pack levels` };
    const vol = carton?.l_cm ? (Number(carton.l_cm) * Number(carton.w_cm) * Number(carton.h_cm)) / 1e6 / Number(carton.units_per_level) : null;
    return {
      Family: fam?.name ?? '—',
      'HS code': String(s.overrides.hs_code ?? fam?.hs_code ?? '—'),
      Formulation: String(s.overrides.base_formulation ?? fam?.base_formulation ?? '—'),
      ...Object.fromEntries(Object.entries(s.variant_attrs).map(([k, v]) => [k, k === 'size_ml' ? leaf('size_ml', Number(v), 'ml', { tag: 'measured', label: 'Size', source: src }) : String(v)])),
      'Units / carton': carton ? leaf('upc', Number(carton.units_per_level), 'units', { tag: 'measured', label: 'Units per carton', source: src }) : '—',
      'Units / pallet': pallet ? leaf('upp', Number(pallet.units_per_level), 'units', { tag: 'measured', label: 'Units per pallet', source: src }) : '—',
      'Volume / unit': vol ? leaf('volume_per_unit_m3', vol, 'm³', { tag: 'measured', source: src }) : '—',
      'Supplier price': exwV ? tracedFromValue(exwV, idx) : '—',
      'Supplier price / L': exwV && ml ? leaf('price_per_litre', Number(exwV.value_num) / (ml / 1000), `${exw!.currency}/L`, { tag: exwV.tag, label: 'Supplier price per litre', source: { label: 'supplier price ÷ size' } }) : '—',
    } as Record<string, string | ReturnType<typeof leaf>>;
  };
  const fa = facts(a);
  const fb = facts(b);
  const keys = [...new Set([...Object.keys(fa ?? {}), ...Object.keys(fb ?? {})])];
  return (
    <div className="space-y-4">
      <PageHeader back={{ href: '/catalogue', label: 'Catalogue' }} title="Compare two configurations" />
      <form method="get" className="grid gap-2 sm:grid-cols-3">
        <Field label="A"><Select name="a" defaultValue={a?.id}>{skus.map((s) => <option key={s.id} value={s.id}>{s.sku_code}</option>)}</Select></Field>
        <Field label="B"><Select name="b" defaultValue={b?.id}>{skus.map((s) => <option key={s.id} value={s.id}>{s.sku_code}</option>)}</Select></Field>
        <div className="self-end"><Button type="submit" variant="secondary">Compare</Button></div>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Attribute</th><th>{a?.sku_code}</th><th>{b?.sku_code}</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const va = fa?.[k];
              const vb = fb?.[k];
              const differs = JSON.stringify(typeof va === 'object' ? va.value : va) !== JSON.stringify(typeof vb === 'object' ? vb.value : vb);
              return (
                <tr key={k} className={`border-t border-border ${differs ? 'bg-accent/50' : ''}`}>
                  <td className="py-2 text-muted-foreground">{k}</td>
                  <td>{va === undefined ? '—' : typeof va === 'object' ? <Num t={va} /> : va}</td>
                  <td>{vb === undefined ? '—' : typeof vb === 'object' ? <Num t={vb} /> : vb}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
