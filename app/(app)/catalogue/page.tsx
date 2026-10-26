import Link from 'next/link';
import { Badge, Button, ButtonLink, Card, Empty, Field, Input, PageHeader, Select } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { leaf } from '@/lib/calc/traced';
import { addFamily, addSku, savePack, saveSkuOverride, updateFamily } from '@/app/actions/catalogue';

export const metadata = { title: 'Catalogue' };

export default async function CataloguePage() {
  const [brands, families, skus, packs, prices, idx, principals] = await Promise.all([
    rows('brands'), rows('product_families'), rows('sku_configs'), rows('pack_levels'), rows('sku_prices'), valueIndex(), rows('principals'),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalogue"
        subtitle="Family → SKU configuration → pack levels. SKUs store only what differs from their family."
        actions={<><ButtonLink href="/catalogue/compare">Compare two</ButtonLink><ButtonLink href="/catalogue/import" variant="primary">Import SKUs</ButtonLink></>}
      />
      {families.length === 0 ? <Empty title="No products yet">Import a SKU list or add a family below.</Empty> : null}
      {families.map((f) => {
        const brand = brands.find((b) => b.id === f.brand_id);
        const fs = skus.filter((s) => s.family_id === f.id);
        return (
          <Card key={f.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{f.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {brand?.name} · {principals.find((p) => p.id === brand?.principal_id)?.name} · HS {f.hs_code ?? '—'} · {f.category ?? 'no category'}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {f.base_formulation ? <Badge>{f.base_formulation}</Badge> : null}
                  {f.certifications.map((c) => <Badge key={c} tone="ok">{c}</Badge>)}
                </p>
              </div>
            </div>
            <Disclosure summary="Edit shared attributes (applies to every SKU in the family)">
              <form action={updateFamily} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={f.id} />
                <Field label="Name"><Input name="name" defaultValue={f.name} required /></Field>
                <Field label="Category"><Input name="category" defaultValue={f.category ?? ''} /></Field>
                <Field label="Base formulation"><Input name="base_formulation" defaultValue={f.base_formulation ?? ''} /></Field>
                <Field label="HS code"><Input name="hs_code" defaultValue={f.hs_code ?? ''} /></Field>
                <Field label="Certifications (comma-separated)" className="sm:col-span-2"><Input name="certifications" defaultValue={f.certifications.join(', ')} /></Field>
                <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save for all SKUs</Button></div>
              </form>
            </Disclosure>
            <ul className="mt-3 space-y-3">
              {fs.map((s) => {
                const sp = packs.filter((p) => p.sku_config_id === s.id);
                const exw = prices.find((p) => p.sku_config_id === s.id && (p.price_type === 'supplier_exw' || p.price_type === 'fob'));
                const exwV = exw && idx.get('sku_price', exw.id, 'price');
                const attrs = s.variant_attrs as Record<string, unknown>;
                return (
                  <li key={s.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{s.sku_code}</span> <span className="text-sm text-muted-foreground">{s.name}</span>
                      </span>
                      {exwV ? <Num t={tracedFromValue(exwV, idx)} /> : <span className="text-xs text-muted-foreground">no supplier price</span>}
                    </div>
                    <p className="mt-1 flex flex-wrap gap-1 text-xs">
                      {Object.entries(attrs).map(([k, v]) => <Badge key={k}>{k}: {typeof v === 'number' ? <Num t={leaf(k, v, k === 'size_ml' ? 'ml' : '', { tag: 'measured', label: k, source: { label: `${s.sku_code} variant attributes` } })} /> : String(v)}</Badge>)}
                      {Object.entries(s.overrides).map(([k, v]) => <Badge key={k} tone="info">override {k}: {String(v)}</Badge>)}
                    </p>
                    <div className="mt-2 -mx-3 overflow-x-auto px-3">
                      <table className="w-full min-w-[28rem] text-left text-xs">
                        <thead className="text-muted-foreground"><tr><th className="py-1">Level</th><th>Units</th><th>L×W×H cm</th><th>kg</th><th></th></tr></thead>
                        <tbody>
                          {(['each', 'carton', 'pallet'] as const).map((lvl) => {
                            const p = sp.find((x) => x.level === lvl);
                            const src = { label: `${s.sku_code} pack levels` };
                            return (
                              <tr key={lvl} className="border-t border-border">
                                <td className="py-1 capitalize">{lvl}</td>
                                <td>{p ? <Num t={leaf('units_per_level', Number(p.units_per_level), 'units', { tag: 'measured', label: `Units per ${lvl}`, source: src })} /> : '—'}</td>
                                <td>{p?.l_cm ? <Num t={leaf('dims', (Number(p.l_cm) * Number(p.w_cm) * Number(p.h_cm)) / 1e6, 'm³', { tag: 'measured', label: `${lvl} volume`, source: src, note: `${p.l_cm} × ${p.w_cm} × ${p.h_cm} cm` })} /> : '—'}</td>
                                <td>{p?.gross_kg ? <Num t={leaf('gross_kg', Number(p.gross_kg), 'kg', { tag: 'measured', label: `${lvl} gross weight`, source: src })} /> : '—'}</td>
                                <td>
                                  <details>
                                    <summary className="min-h-11 cursor-pointer py-2 text-primary">edit</summary>
                                    <form action={savePack} className="grid grid-cols-2 gap-2 py-2">
                                      {p ? <input type="hidden" name="id" value={p.id} /> : <><input type="hidden" name="sku_config_id" value={s.id} /><input type="hidden" name="level" value={lvl} /></>}
                                      <Input name="units_per_level" aria-label="Units" placeholder="units" defaultValue={p?.units_per_level ?? ''} />
                                      <Input name="gross_kg" aria-label="kg" placeholder="kg" defaultValue={p?.gross_kg ?? ''} />
                                      <Input name="l_cm" aria-label="Length cm" placeholder="L cm" defaultValue={p?.l_cm ?? ''} />
                                      <Input name="w_cm" aria-label="Width cm" placeholder="W cm" defaultValue={p?.w_cm ?? ''} />
                                      <Input name="h_cm" aria-label="Height cm" placeholder="H cm" defaultValue={p?.h_cm ?? ''} />
                                      <Button type="submit" variant="secondary">Save</Button>
                                    </form>
                                  </details>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <details className="mt-1">
                      <summary className="min-h-11 cursor-pointer py-2 text-xs text-primary">Override a family attribute for this SKU</summary>
                      <form action={saveSkuOverride} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <Field label="Attribute"><Select name="key"><option value="hs_code">HS code</option><option value="base_formulation">Formulation</option><option value="certifications">Certifications</option></Select></Field>
                        <Field label="Value (blank removes)"><Input name="value" /></Field>
                        <Button type="submit" variant="secondary">Save</Button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
            <Disclosure summary="Add a SKU configuration">
              <form action={addSku} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="family_id" value={f.id} />
                <Field label="SKU code"><Input name="sku_code" required /></Field>
                <Field label="Name"><Input name="name" /></Field>
                <Field label="Size (ml)"><Input name="size_ml" inputMode="numeric" /></Field>
                <Field label="Scent"><Input name="scent" /></Field>
                <Field label="Barcode"><Input name="barcode" /></Field>
                <Field label="Shelf life (days)"><Input name="shelf_life_days" inputMode="numeric" /></Field>
                <Field label="Units per carton"><Input name="units_per_carton" inputMode="numeric" /></Field>
                <Field label="Cartons per pallet"><Input name="cartons_per_pallet" inputMode="numeric" /></Field>
                <Field label="Carton kg"><Input name="carton_kg" inputMode="decimal" /></Field>
                <Field label="Carton L cm"><Input name="carton_l_cm" inputMode="decimal" /></Field>
                <Field label="Carton W cm"><Input name="carton_w_cm" inputMode="decimal" /></Field>
                <Field label="Carton H cm"><Input name="carton_h_cm" inputMode="decimal" /></Field>
                <div className="sm:col-span-3"><Button type="submit">Add SKU</Button></div>
              </form>
            </Disclosure>
          </Card>
        );
      })}
      <Disclosure summary="Add a product family">
        <form action={addFamily} className="grid gap-3 sm:grid-cols-2">
          <Field label="Brand"><Select name="brand_id" required>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field label="Name"><Input name="name" required /></Field>
          <Field label="Category"><Input name="category" placeholder="dishwashing" /></Field>
          <Field label="HS code"><Input name="hs_code" /></Field>
          <Field label="Base formulation"><Input name="base_formulation" /></Field>
          <Field label="Certifications"><Input name="certifications" /></Field>
          <div className="sm:col-span-2"><Button type="submit">Add family</Button></div>
        </form>
      </Disclosure>
      <p className="text-xs text-muted-foreground">Prices per market and channel live on each <Link className="underline" href="/plays">play</Link> and in principal setup step 4.</p>
    </div>
  );
}
