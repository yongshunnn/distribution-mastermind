'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { parseSpreadsheet } from '@/lib/import/parse';
import { importSales, type SalesRowInput } from '@/app/actions/principals';

export function SalesImport({ principalId }: { principalId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; errors: string[] } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <a href="/api/template/sku?kind=sales" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm">Download sales template (CSV)</a>
      <label className="block rounded-xl border border-dashed border-border p-4 text-sm">
        Upload monthly sales (.csv or .xlsx)
        <input
          type="file"
          accept=".csv,.xlsx"
          className="mt-2 block w-full"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            start(async () => {
              const rows = (await parseSpreadsheet(f)) as unknown as SalesRowInput[];
              const r = await importSales(principalId, rows);
              setMsg({ ok: r.errors.length === 0, text: `Imported ${r.ok} row${r.ok === 1 ? '' : 's'}.`, errors: r.errors.slice(0, 20) });
              router.refresh();
            });
          }}
        />
      </label>
      {pending ? <p className="text-sm text-muted-foreground">Importing…</p> : null}
      {msg ? (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'}`}>
          {msg.text}
          {msg.errors.length ? <ul className="mt-1 list-disc pl-4 text-xs">{msg.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}
