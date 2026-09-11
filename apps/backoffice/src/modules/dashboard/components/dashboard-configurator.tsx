import { DButton, DCard } from '@digvation/ui';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';

import type { DashboardWidgetDefinition } from '../dashboard-widget-registry';
import type { DashboardWidgetId } from '../dashboard.types';

export function DashboardConfigurator({
  widgets,
  enabled,
  open,
  onOpenChange,
  onToggle,
  onReset,
}: {
  widgets: readonly DashboardWidgetDefinition[];
  enabled: readonly DashboardWidgetId[];
  open: boolean;
  onOpenChange(open: boolean): void;
  onToggle(id: DashboardWidgetId): void;
  onReset(): void;
}) {
  return (
    <div className="relative">
      <DButton
        variant="secondary"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <SlidersHorizontal aria-hidden="true" className="mr-2 size-4" />
        Configure dashboard
      </DButton>

      {open ? (
        <DCard
          variant="elevated"
          className="absolute right-0 z-30 mt-2 w-[min(92vw,390px)] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Dashboard widgets</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                Required KPI and today&apos;s transactions always stay visible. Choose the extra analytics that matter to you.
              </p>
            </div>
            <DButton variant="secondary" onClick={onReset}>
              <RotateCcw aria-hidden="true" className="mr-2 size-4" />
              Reset
            </DButton>
          </div>

          <div className="mt-4 space-y-2">
            {widgets.map((widget) => {
              const checked = enabled.includes(widget.id);
              return (
                <label
                  key={widget.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[var(--color-brand)]"
                    checked={checked}
                    onChange={() => onToggle(widget.id)}
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

          <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-muted)]">
            This preference is presentation-only and never expands your product, permission, or location access.
          </p>
        </DCard>
      ) : null}
    </div>
  );
}
