// Reusable server-rendered forms (plain form actions; HTML validation keeps them phone-friendly).
import type { ReactNode } from 'react';
import { addValue } from '@/app/actions/markets';
import { Button, Field, Input, Select } from './ui';
import { EDIT_TAGS } from '@/lib/validation/schemas';
import { TAG_LABEL } from '@/lib/calc/traced';

export function Disclosure({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-xl border border-border bg-card" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
        {summary}
        <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}

export function TagSelect({ name = 'tag', defaultValue = 'estimated' }: { name?: string; defaultValue?: string }) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      {EDIT_TAGS.map((t) => (
        <option key={t} value={t}>
          {TAG_LABEL[t]}
        </option>
      ))}
    </Select>
  );
}

export function AddValueForm({ entityType, entityId, title = 'Add a figure' }: { entityType: string; entityId: string; title?: string }) {
  return (
    <Disclosure summary={title}>
      <form action={addValue} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <Field label="Label" className="sm:col-span-2">
          <Input name="label" required placeholder="e.g. Mydin store count" />
        </Field>
        <Field label="Number">
          <Input name="value_num" inputMode="decimal" />
        </Field>
        <Field label="Unit" hint="pct for %, MYR/unit, outlets, days…">
          <Input name="unit" />
        </Field>
        <Field label="Or text" className="sm:col-span-2">
          <Input name="value_text" />
        </Field>
        <Field label="Tag">
          <TagSelect />
        </Field>
        <Field label="As of">
          <Input name="as_of" type="date" />
        </Field>
        <Field label="Source">
          <Input name="source_label" />
        </Field>
        <Field label="Source link">
          <Input name="source_url" type="url" />
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <Input name="note" />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit">Save figure</Button>
        </div>
      </form>
    </Disclosure>
  );
}
