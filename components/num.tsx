'use client';

import { useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import type { Traced } from '@/lib/calc/traced';
import { formatTraced } from '@/lib/format';
import { ExplainCard } from './explain-card';

function useSheetMode(): boolean {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px), (pointer: coarse)');
    const on = () => setSheet(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return sheet;
}

interface NumProps {
  t: Traced;
  className?: string;
  /** Hide the unit suffix (e.g. in dense tables with a unit header). */
  bare?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-xl font-semibold', xl: 'text-3xl font-semibold' };

/**
 * The only way to render a number (spec §7.2). Desktop: hover/click opens a popover.
 * Phone: tap opens a bottom sheet. A dot shows the value's tag; placeholders get a dashed underline.
 */
export function Num({ t, className, bare, size }: NumProps) {
  const sheet = useSheetMode();
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = formatTraced(t);
  const negative = !t.na && t.value < 0 && t.unit !== '%';

  const trigger = (
    <button
      type="button"
      className={`num ${size ? sizes[size] : ''} ${negative ? 'text-danger' : ''} ${className ?? ''}`}
      data-explain={t.key}
      data-tag={t.tag}
      aria-haspopup="dialog"
      aria-label={`${t.label ?? t.key}: ${f.text}${f.suffix ?? ''}. Show explanation`}
      onPointerEnter={(e) => {
        if (sheet || e.pointerType !== 'mouse') return;
        hoverTimer.current = setTimeout(() => setOpen(true), 250);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
      }}
      onClick={() => setOpen(true)}
    >
      <span className="num-value">{f.text}</span>
      {!bare && f.suffix ? <span className="text-[0.75em] font-normal text-muted-foreground">{f.suffix}</span> : null}
      <span className="tag-dot" data-tag={t.tag} aria-hidden="true" />
      {t.stale ? <span className="sr-only">(stale)</span> : null}
    </button>
  );

  if (sheet) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            className="sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
            aria-describedby={undefined}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
            <Dialog.Title className="sr-only">{t.label ?? t.key}</Dialog.Title>
            <ExplainCard t={t} onClose={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={setOpen}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          role="dialog"
          aria-label={t.label ?? t.key}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card p-4 text-foreground shadow-xl"
        >
          <ExplainCard t={t} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A text fact (e.g. "TradeNet permit before arrival") with the same source card. */
export function TextValue({ t, text }: { t: Traced; text: string }) {
  const sheet = useSheetMode();
  const [open, setOpen] = useState(false);
  const trigger = (
    <button type="button" className="text-left text-sm hover:bg-accent rounded" data-explain={t.key} data-tag={t.tag} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {text} <span className="tag-dot ml-1" data-tag={t.tag} aria-hidden="true" />
    </button>
  );
  if (sheet)
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content aria-describedby={undefined} className="sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl">
            <Dialog.Title className="sr-only">{t.label}</Dialog.Title>
            <ExplainCard t={{ ...t, text }} onClose={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content role="dialog" sideOffset={6} collisionPadding={12} className="z-50 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl">
          <ExplainCard t={{ ...t, text }} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
