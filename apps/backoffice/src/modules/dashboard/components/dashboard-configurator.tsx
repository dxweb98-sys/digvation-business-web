import { DButton } from '@digvation/ui';
import { LockKeyhole, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DashboardWidgetDefinition } from '../dashboard-widget-registry';
import type { DashboardWidgetId } from '../dashboard.types';

const REQUIRED = [
  'Revenue',
  'Transactions',
  'Average transaction',
  'Quantity sold',
  "Today's transactions",
] as const;

export function DashboardConfigurator({
  widgets,
  enabled,
  defaults,
  open,
  onOpenChange,
  onSave,
}: {
  widgets: readonly DashboardWidgetDefinition[];
  enabled: readonly DashboardWidgetId[];
  defaults: readonly DashboardWidgetId[];
  open: boolean;
  onOpenChange(open: boolean): void;
  onSave(ids: DashboardWidgetId[]): void;
}) {
  const [draft, setDraft] = useState<DashboardWidgetId[]>([...enabled]);

  useEffect(() => {
    if (open) setDraft([...enabled]);
  }, [enabled, open]);

  const toggle = (id: DashboardWidgetId) =>
    setDraft((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );

  return (
    <>
      <DButton variant="secondary" onClick={() => onOpenChange(true)}>
        <SlidersHorizontal aria-hidden="true" className="mr-2 size-4" />
        Customize
      </DButton>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close dashboard customization"
            className="absolute inset-0 bg-black/25"
            onClick={() => onOpenChange(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">
                  Dashboard
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Customize dashboard
                </h2>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  Choose optional analytics. Required business KPIs always remain visible.
                </p>
              </div>
              <button
                type="button"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                  Always visible
                </p>
                <div className="mt-2 space-y-2">
                  {REQUIRED.map((label) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5"
                    >
                      <input type="checkbox" checked readOnly className="size-4 accent-[var(--color-brand)]" />
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      <LockKeyhole
                        aria-label="Required"
                        className="size-3.5 text-[var(--color-text-muted)]"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                    Pro analytics
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-brand)]"
                    onClick={() => setDraft([...defaults])}
                  >
                    <RotateCcw aria-hidden="true" className="size-3" />
                    Reset default
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {widgets.map((widget) => {
                    const checked = draft.includes(widget.id);
                    return (
                      <label
                        key={widget.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] px-3 py-3 transition-colors hover:bg-[var(--color-surface-muted)]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[var(--color-brand)]"
                          checked={checked}
                          onChange={() => toggle(widget.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{widget.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                            {widget.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
              <DButton variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </DButton>
              <DButton
                onClick={() => {
                  onSave(draft);
                  onOpenChange(false);
                }}
              >
                Save dashboard
              </DButton>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
