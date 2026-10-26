import { Card, PageHeader } from '@/components/ui';
import { SkuImport } from '@/components/sku-import';
import { SKU_TEMPLATE_COLUMNS } from '@/lib/import/columns';

export const metadata = { title: 'Import SKUs' };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ principal?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="space-y-4">
      <PageHeader back={{ href: '/catalogue', label: 'Catalogue' }} title="Import SKUs" subtitle="Upload the principal's SKU list with pricing and labels. You see new, changed and conflicting rows before anything is saved." />
      <Card><SkuImport principalId={sp.principal} /></Card>
      <Card>
        <p className="mb-2 text-sm font-medium">Template columns</p>
        <p className="text-xs break-words text-muted-foreground">{SKU_TEMPLATE_COLUMNS.join(', ')}</p>
        <p className="mt-2 text-xs text-muted-foreground">Any column starting <code>variant_attr:</code> becomes a variant axis (scent, formulation, pack_count…). size_unit is ml or l.</p>
      </Card>
    </div>
  );
}
