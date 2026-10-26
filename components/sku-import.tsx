'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { unzipSync } from 'fflate';
import { parseSpreadsheet } from '@/lib/import/parse';
import { applySkuImport, previewSkuImport, uploadLabel } from '@/app/actions/catalogue';
import type { DiffRow } from '@/lib/import/sku';
import { count } from '@/lib/calc/traced';
import { Num } from './num';

const KIND_STYLE: Record<DiffRow['kind'], string> = {
  new: 'bg-ok-bg text-ok', changed: 'bg-accent text-primary', conflict: 'bg-danger-bg text-danger', unchanged: 'bg-muted text-muted-foreground', invalid: 'bg-danger-bg text-danger',
};

/** SKU bulk import with a preview diff before anything is written (spec §6). */
export function SkuImport({ principalId }: { principalId?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [diff, setDiff] = useState<DiffRow[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const counts = diff ? (['new', 'changed', 'conflict', 'invalid', 'unchanged'] as const).map((k) => [k, diff.filter((d) => d.kind === k).length] as const) : [];

  return (
    <div className="space-y-4" data-testid="sku-import">
      <div className="flex flex-wrap gap-2">
        <a href="/api/template/sku" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm">Download blank template (CSV)</a>
      </div>
      <label className="block rounded-xl border border-dashed border-border p-4 text-sm">
        <span className="font-medium">1. Choose the SKU list (.csv or .xlsx)</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          className="mt-2 block w-full"
          data-testid="sku-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setError(null);
            setResult(null);
            start(async () => {
              try {
                const parsed = await parseSpreadsheet(f);
                setRows(parsed);
                setDiff(await previewSkuImport(parsed));
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not read the file');
              }
            });
          }}
        />
      </label>
      {pending && !diff ? <p className="text-sm text-muted-foreground">Reading…</p> : null}
      {error ? <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
      {diff ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">2. Preview — nothing is saved yet</p>
          <ul className="flex flex-wrap gap-2 text-xs" data-testid="diff-counts">
            {counts.map(([k, c]) => (
              <li key={k} className={`rounded-full px-2 py-1 ${KIND_STYLE[k]}`} data-kind={k} data-count={c}>
                {k}: <Num t={count(`import_${k}`, c, `${k} rows`, `Rows classified as ${k} in this upload.`)} />
              </li>
            ))}
          </ul>
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
            {diff.map((d) => (
              <li key={`${d.line}-${d.sku_code}`} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.sku_code} <span className="text-xs text-muted-foreground">line {String(d.line)}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${KIND_STYLE[d.kind]}`}>{d.kind}</span>
                </div>
                {d.changes.length ? (
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {d.changes.map((c) => <li key={c.field}>{c.field}: {c.from} → <span className="text-foreground">{c.to}</span></li>)}
                  </ul>
                ) : null}
                {d.problems.length ? <ul className="mt-1 text-xs text-danger">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending || !diff.some((d) => d.kind === 'new' || d.kind === 'changed')}
            onClick={() =>
              start(async () => {
                const r = await applySkuImport(rows ?? [], principalId);
                setResult(`Created ${r.created}, updated ${r.updated}, skipped ${r.skipped} (conflicts, invalid or unchanged rows).`);
                setDiff(null);
                router.refresh();
              })
            }
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            3. Apply new and changed rows
          </button>
        </div>
      ) : null}
      {result ? <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok" role="status">{result}</p> : null}

      <label className="block rounded-xl border border-dashed border-border p-4 text-sm">
        <span className="font-medium">Label artwork (.zip)</span>
        <span className="block text-xs text-muted-foreground">File names must match sku_code, e.g. KEON-DW-1L.png</span>
        <input
          type="file"
          accept=".zip"
          className="mt-2 block w-full"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            start(async () => {
              const files = unzipSync(new Uint8Array(await f.arrayBuffer()));
              const out: string[] = [];
              for (const [name, data] of Object.entries(files)) {
                const base = name.split('/').pop() ?? name;
                if (!base || base.startsWith('.') || data.length === 0) continue;
                const code = base.replace(/\.[^.]+$/, '');
                const ext = base.split('.').pop()?.toLowerCase() ?? '';
                const type = ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
                const fd = new FormData();
                fd.append('sku_code', code);
                fd.append('file', new File([data.slice().buffer as ArrayBuffer], base, { type }));
                const r = await uploadLabel(fd);
                out.push(r.ok ? `✓ ${code}` : `✕ ${code}: ${r.error}`);
              }
              setLabels(out);
              router.refresh();
            });
          }}
        />
      </label>
      {labels.length ? <ul className="text-xs">{labels.map((l) => <li key={l}>{l}</li>)}</ul> : null}
    </div>
  );
}
