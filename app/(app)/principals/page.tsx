import Link from 'next/link';
import { Badge, Button, Card, Field, Input, PageHeader } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { rows } from '@/lib/db/data';
import { portfolio } from '@/lib/db/portfolio';
import { count } from '@/lib/calc/traced';
import { createPrincipal } from '@/app/actions/principals';

export const metadata = { title: 'Principals' };

export default async function PrincipalsPage() {
  const [principals, brands, families, skus, p] = await Promise.all([rows('principals'), rows('brands'), rows('product_families'), rows('sku_configs'), portfolio()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Principals" subtitle="Every brand owner we represent. Each one is set up through the six-step wizard." />
      <ul className="grid gap-3 md:grid-cols-2">
        {principals.map((pr) => {
          const bs = brands.filter((b) => b.principal_id === pr.id);
          const fs = families.filter((f) => bs.some((b) => b.id === f.brand_id));
          const ss = skus.filter((s) => fs.some((f) => f.id === s.family_id));
          const contrib = p.byPrincipal.find((x) => x.principal.id === pr.id)?.t;
          return (
            <li key={pr.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/principals/${pr.id}`} className="text-base font-semibold hover:underline">{pr.name}</Link>
                  <Badge>{pr.contract_type?.replace('_', ' ') ?? 'contract type tbc'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{pr.country ?? '—'} · territories {pr.territories.join(', ') || '—'} · brands {bs.map((b) => b.name).join(', ')}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div><p className="text-xs text-muted-foreground">SKUs</p><Num t={count('skus', ss.length, 'SKU configurations', `SKU configurations for ${pr.name}.`)} /></div>
                  {contrib ? <div className="text-right"><p className="text-xs text-muted-foreground">Contribution / month</p><Num t={contrib} /></div> : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Disclosure summary="Add a principal">
        <form action={createPrincipal} className="grid gap-3 sm:grid-cols-3">
          <Field label="Company"><Input name="name" required /></Field>
          <Field label="Country (ISO)"><Input name="country" maxLength={2} /></Field>
          <Field label="First brand"><Input name="brand" /></Field>
          <Field label="Contact" className="sm:col-span-2"><Input name="contact" /></Field>
          <div className="self-end"><Button type="submit">Start setup wizard</Button></div>
        </form>
      </Disclosure>
    </div>
  );
}
