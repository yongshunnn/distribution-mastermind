import { NextResponse, type NextRequest } from 'next/server';
import { SALES_TEMPLATE_COLUMNS, SKU_TEMPLATE_COLUMNS } from '@/lib/import/columns';

/** Blank import templates (spec §6). ?kind=sales for the monthly sales template. */
export function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  const cols = kind === 'sales' ? SALES_TEMPLATE_COLUMNS : SKU_TEMPLATE_COLUMNS;
  const example =
    kind === 'sales'
      ? ['KEON-DW-1L', 'SG', 'Fortune', '2026-09', '1200', '3840', 'SGD', 'principal_reported']
      : ['KEON-DW-2L', 'Dishwashing liquid', 'SG KEON', 'Lemon', 'Enzyme', '8888000000000', '2', 'l', '6', '33', '24', '30', '13', '60', '730', '3402.90', 'MY', 'NSK Trade City', 'shelf', '14.90', 'MYR', 'BM/EN', 'KEON-DW-2L.png'];
  const csv = `${cols.join(',')}\n${example.map((v) => (v.includes(',') ? `"${v}"` : v)).join(',')}\n`;
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind === 'sales' ? 'sales' : 'sku'}-import-template.csv"` },
  });
}
