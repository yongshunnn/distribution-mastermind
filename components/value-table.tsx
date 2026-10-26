import { Num, TextValue } from './num';
import { TAG_LABEL } from '@/lib/calc/traced';
import { historyOf, tracedFromValue, type ValueIndex } from '@/lib/db/data';
import type { TrackedValue } from '@/lib/db/types';

/** Lists tracked values with their tag, source, freshness and history count. Tap a value to see or edit it. */
export function ValueTable({ values, idx, staleBefore }: { values: TrackedValue[]; idx: ValueIndex; staleBefore?: string }) {
  if (!values.length) return <p className="text-sm text-muted-foreground">No figures yet.</p>;
  return (
    <ul className="divide-y divide-border" data-testid="value-table">
      {values.map((v) => {
        const t = tracedFromValue(v, idx);
        const stale = Boolean(staleBefore && v.as_of && v.as_of < staleBefore && v.tag !== 'measured' && v.tag !== 'quoted');
        const edits = historyOf(idx, v).length - 1;
        return (
          <li key={v.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm">{v.label ?? v.field}</p>
              <p className="text-xs text-muted-foreground">
                {TAG_LABEL[v.tag]}
                {v.source_label ? ` · ${v.source_label}` : ''}
                {v.as_of ? ` · ${v.as_of}` : ''}
                {stale ? ' · stale' : ''}
                {edits > 0 ? ` · edited` : ''}
              </p>
            </div>
            <div className="max-w-full text-right">
              {v.value_num != null || v.value_text == null ? <Num t={{ ...t, stale }} /> : <TextValue t={t} text={v.value_text} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
