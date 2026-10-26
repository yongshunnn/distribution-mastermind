'use client';

import { createContext, useActionState, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { TAG_LABEL, type Traced } from '@/lib/calc/traced';
import { formatDelta, formatPlain, formatTraced } from '@/lib/format';
import { saveTrackedValue, type ActionState } from '@/app/actions/values';
import { EDIT_TAGS } from '@/lib/validation/schemas';

type GlossaryMap = Record<string, { label: string; meaning: string; formula?: string }>;
const GlossaryContext = createContext<GlossaryMap>({});

export function GlossaryProvider({ value, children }: { value: GlossaryMap; children: ReactNode }) {
  return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

export function TagDot({ tag }: { tag: Traced['tag'] }) {
  return <span className="tag-dot" data-tag={tag} aria-hidden="true" />;
}

export function TagLabel({ tag }: { tag: Traced['tag'] }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
      <TagDot tag={tag} />
      {TAG_LABEL[tag]}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-3">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function Value({ t, className }: { t: Traced; className?: string }) {
  if (t.text) return <span className={`text-base font-medium ${className ?? ''}`}>{t.text}</span>;
  const f = formatTraced(t);
  return (
    <span className={`whitespace-nowrap ${className ?? ''}`}>
      {f.text}
      {f.suffix ? <span className="ml-0.5 text-[0.75em] font-normal text-muted-foreground">{f.suffix}</span> : null}
    </span>
  );
}

/** The explanation shown for any number (spec §7.2). Breakdown rows drill down to raw inputs. */
export function ExplainCard({ t: root, onClose }: { t: Traced; onClose?: () => void }) {
  const [stack, setStack] = useState<Traced[]>([root]);
  const [editing, setEditing] = useState(false);
  const glossary = useContext(GlossaryContext);
  const t = stack[stack.length - 1];
  const g = glossary[t.key];
  const label = t.label ?? g?.label ?? t.key;
  // Glossary (editable in Settings) wins for engine keys; seeded data fields fall back to their own meaning.
  const meaning = g?.meaning ?? t.meaning;
  const components = [...(t.components ?? [])].filter((c) => c.unit !== 'flag' || c.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  useEffect(() => setEditing(false), [t]);

  return (
    <div className="space-y-3" data-testid="explain-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {stack.length > 1 ? (
            <button type="button" className="mb-1 min-h-11 text-sm text-primary" onClick={() => setStack((s) => s.slice(0, -1))}>
              ← {stack[stack.length - 2].label ?? 'Back'}
            </button>
          ) : null}
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">
            <Value t={t} />
          </p>
          {t.na ? <p className="text-sm text-warn">{t.na}</p> : null}
          {t.alt ? <p className="text-xs text-muted-foreground">≈ {formatPlain(t.alt.value, t.alt.unit)}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <TagLabel tag={t.tag} />
          {t.stale ? <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs text-warn">Stale</span> : null}
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:bg-muted">
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <Section title="Meaning">{meaning}</Section>

      {t.formula ? (
        <Section title="Formula">
          <code className="block rounded bg-muted px-2 py-1 text-xs break-words whitespace-pre-wrap">{t.formula}</code>
        </Section>
      ) : null}

      {components.length ? (
        <Section title="Breakdown (largest first)">
          <ul className="divide-y divide-border">
            {components.map((c, i) => (
              <li key={`${c.key}-${i}`}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-1 text-left hover:bg-muted"
                  onClick={() => setStack((s) => [...s, c])}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="tag-dot" data-tag={c.tag} aria-hidden="true" />
                    <span className="truncate">{c.label ?? c.key}</span>
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Value t={c} />
                    <span aria-hidden="true" className="text-muted-foreground">›</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Source & freshness">
        {t.source ? (
          <p>
            {t.source.url ? (
              <a href={t.source.url} target="_blank" rel="noreferrer" className="text-primary underline">
                {t.source.label}
              </a>
            ) : (
              t.source.label
            )}
            {t.source.asOf ? <span className="text-muted-foreground"> · as of {t.source.asOf}</span> : null}
          </p>
        ) : components.length ? (
          <p className="text-muted-foreground">Computed — inherits the weakest tag of its inputs ({TAG_LABEL[t.tag].toLowerCase()}).</p>
        ) : (
          <p className="text-muted-foreground">No source recorded.</p>
        )}
        {t.stale ? <p className="text-warn">Older than the freshness threshold in Settings — re-check.</p> : null}
        {t.note ? <p className="mt-1 text-muted-foreground">{t.note}</p> : null}
        {t.history && t.history.length > 1 ? (
          <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {t.history.map((h, i) => (
              <li key={i}>
                {i === 0 ? 'Seed' : 'Edit'}: {h.value == null ? (h.text ?? 'empty') : formatPlain(h.value, t.ref?.unit === 'pct' ? 'pct' : t.unit)} · {TAG_LABEL[h.tag]}
                {h.source ? `, ${h.source}` : ''} · {h.at.slice(0, 10)}
              </li>
            ))}
          </ol>
        ) : null}
      </Section>

      {t.sensitivity && t.sensitivity.length ? (
        <Section title="Most sensitive input">
          <ul className="space-y-0.5">
            {t.sensitivity.slice(0, 3).map((s) => (
              <li key={s.inputKey} className="flex justify-between gap-2">
                <span>+10% {s.label ?? s.inputKey}</span>
                <span className="tabular-nums">{formatDelta(s.deltaFor10pct, t.unit)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {t.levers && t.levers.length ? (
        <Section title="What would need to move">
          <ul className="space-y-1">
            {t.levers.map((l) => (
              <li key={l.inputKey}>
                {l.label}: {formatPlain(l.from, l.unit)} → <strong>{formatPlain(l.to, l.unit)}</strong>{' '}
                <span className="text-muted-foreground">({formatDelta(l.to - l.from, l.unit)})</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">Each lever alone, others held constant.</p>
        </Section>
      ) : null}

      {t.compare && t.compare.length ? (
        <Section title="Compare">
          <ul className="space-y-0.5">
            {t.compare.map((c) => (
              <li key={c.label} className="flex justify-between gap-2">
                <span>{c.label}</span>
                <span className="tabular-nums">{formatPlain(c.value, t.unit)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {t.ref ? (
        <section className="border-t border-border pt-3">
          {editing ? (
            <EditValueForm t={t} onDone={() => setEditing(false)} />
          ) : (
            <button type="button" className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted" onClick={() => setEditing(true)}>
              Edit value
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

export function EditValueForm({ t, onDone }: { t: Traced; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveTrackedValue, null);
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onDone?.();
    }
  }, [state, router, onDone]);
  if (!t.ref) return null;
  const isText = t.ref.raw == null && t.ref.text != null;
  const unit = t.ref.unit ?? '';
  return (
    <form action={action} className="space-y-2" data-testid="edit-value-form">
      <input type="hidden" name="entity_type" value={t.ref.entityType} />
      <input type="hidden" name="entity_id" value={t.ref.entityId} />
      <input type="hidden" name="field" value={t.ref.field} />
      <input type="hidden" name="unit" value={unit} />
      {isText ? (
        <label className="block text-xs text-muted-foreground">
          Value
          <textarea name="value_text" defaultValue={t.ref.text ?? ''} className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-base" />
        </label>
      ) : (
        <label className="block text-xs text-muted-foreground">
          Value {unit ? `(${unit === 'pct' ? '%' : unit})` : ''}
          <input name="value_num" inputMode="decimal" defaultValue={t.ref.raw ?? ''} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" />
        </label>
      )}
      <label className="block text-xs text-muted-foreground">
        Tag
        <select name="tag" defaultValue="quoted" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base">
          {EDIT_TAGS.map((x) => (
            <option key={x} value={x}>
              {TAG_LABEL[x]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        Source (who / what)
        <input name="source_label" placeholder="e.g. NSK quote, 12 Nov" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">
          As of
          <input name="as_of" type="date" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-2 text-base" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Link
          <input name="source_url" type="url" placeholder="https://" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-2 text-base" />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Note
        <input name="note" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" />
      </label>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          {pending ? 'Saving…' : 'Save'}
        </button>
        {onDone ? (
          <button type="button" onClick={onDone} className="min-h-11 rounded-lg px-4 text-sm">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
