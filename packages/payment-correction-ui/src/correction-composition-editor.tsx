import {
  addCorrectionRoute,
  addableRoutes,
  canRemoveCorrectionRoute,
  correctionDraftState,
  correctionNet,
  createDecimal,
  editCorrectionAmount,
  removeCorrectionRoute,
  unallocatedAmount,
  type CorrectionDraft,
  type CorrectionRouteInfo,
} from '@digvation/business-money';
import { DAlert, DButton, DCard } from '@digvation/ui';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface CorrectionEditorLabels {
  recordedNow: string;
  totalPaid: string;
  correctRecording: string;
  total: string;
  addPaymentMethod: string;
  removePaymentMethod: string;
  twoRouteHint: string;
  leftToAllocate: string;
  allocatedBeyondTotal: string;
  changes: string;
  totalChanges: string;
  nothingToChange: string;
}

export interface CorrectionAmountInputProps {
  name: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export interface CorrectionCompositionEditorProps {
  /** What Runtime holds now: the read-only baseline the changes are derived from. */
  baseline: CorrectionDraft;
  /** The operator's draft of the correct composition. */
  draft: CorrectionDraft;
  routes: readonly CorrectionRouteInfo[];
  labels: CorrectionEditorLabels;
  disabled?: boolean;
  formatMoney: (amount: string) => string;
  methodLabel: (method: string | undefined) => string;
  /** Each app supplies its own Digvation currency input; the interaction model is shared. */
  renderAmountInput: (props: CorrectionAmountInputProps) => ReactNode;
  onDraftChange: (draft: CorrectionDraft) => void;
}

function Row({
  name,
  detail,
  trailing,
}: {
  name: string;
  detail?: string | undefined;
  trailing: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 text-sm">
        <span className="block break-words font-medium">{name}</span>
        {detail ? (
          <span className="block text-xs text-[var(--color-text-muted)]">{detail}</span>
        ) : null}
      </span>
      {trailing}
    </li>
  );
}

function TotalLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p
      className={`flex justify-between gap-4 border-t border-[var(--color-border)] pt-2 text-sm ${
        strong ? 'font-semibold' : 'text-[var(--color-text-muted)]'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

/**
 * The composition editor both Operational and Backoffice use: a read-only "recorded now" card, the
 * primary editable "correct recording" card (rows, add route, total and allocation feedback), and the
 * derived changes. It only presents and edits the shared draft model; Runtime stays the authority.
 */
export function CorrectionCompositionEditor({
  baseline,
  draft,
  routes,
  labels,
  disabled = false,
  formatMoney,
  methodLabel,
  renderAmountInput,
  onDraftChange,
}: CorrectionCompositionEditorProps) {
  const [adding, setAdding] = useState(false);
  const info = (routeId: string) => routes.find((candidate) => candidate.routeId === routeId);
  const nameOf = (routeId: string) => info(routeId)?.name ?? routeId;
  const signed = (delta: string) =>
    delta.startsWith('-') ? `−${formatMoney(delta.slice(1))}` : `+${formatMoney(delta)}`;

  const recorded = Object.entries(baseline.current).filter(
    ([, amount]) => !createDecimal(amount).isZero(),
  );
  const addable = addableRoutes(draft, routes);
  const remaining = unallocatedAmount(draft);
  const mismatch = !createDecimal(remaining).isZero();
  const state = correctionDraftState(draft);
  const changes = state.ok ? state.moves : [];
  const removable = canRemoveCorrectionRoute(draft);

  return (
    <>
      <section aria-label={labels.recordedNow}>
        <DCard
          variant="default"
          className="space-y-1 bg-[var(--color-surface-muted)] p-4 shadow-none"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {labels.recordedNow}
          </h3>
          <ul className="divide-y divide-[var(--color-border)]">
            {recorded.map(([routeId, amount]) => (
              <Row
                key={routeId}
                name={nameOf(routeId)}
                detail={methodLabel(info(routeId)?.method)}
                trailing={
                  <span className="shrink-0 text-sm tabular-nums">{formatMoney(amount)}</span>
                }
              />
            ))}
          </ul>
          <TotalLine label={labels.totalPaid} value={formatMoney(draft.total)} />
        </DCard>
      </section>

      <section aria-label={labels.correctRecording}>
        <DCard variant="outlined" className="space-y-1 border-[var(--color-brand)] p-4 shadow-sm">
          <h3 className="text-sm font-semibold">{labels.correctRecording}</h3>
          <ul className="divide-y divide-[var(--color-border)]">
            {draft.selected.map((routeId) => {
              const name = nameOf(routeId);
              return (
                <Row
                  key={routeId}
                  name={name}
                  detail={methodLabel(info(routeId)?.method)}
                  trailing={
                    <span className="flex shrink-0 items-center gap-1">
                      {renderAmountInput({
                        name,
                        value: draft.amounts[routeId] ?? '',
                        disabled,
                        onChange: (value) =>
                          onDraftChange(editCorrectionAmount(draft, routeId, value)),
                      })}
                      {removable ? (
                        <DButton
                          size="sm"
                          variant="ghost"
                          aria-label={`${labels.removePaymentMethod} ${name}`}
                          disabled={disabled}
                          onClick={() => onDraftChange(removeCorrectionRoute(draft, routeId))}
                        >
                          <X className="size-4" aria-hidden />
                        </DButton>
                      ) : null}
                    </span>
                  }
                />
              );
            })}
          </ul>

          {adding && addable.length ? (
            <ul
              aria-label={labels.addPaymentMethod}
              className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]"
            >
              {addable.map((route) => (
                <li key={route.routeId}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
                    onClick={() => {
                      onDraftChange(addCorrectionRoute(draft, route.routeId));
                      setAdding(false);
                    }}
                  >
                    <span className="font-medium">{route.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {methodLabel(route.method)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <DButton
              variant="outline"
              size="sm"
              fullWidth
              leftIcon={<Plus className="size-4" aria-hidden />}
              disabled={disabled || addable.length === 0}
              onClick={() => setAdding(true)}
            >
              {labels.addPaymentMethod}
            </DButton>
          )}

          {draft.selected.length === 2 ? (
            <p className="pt-1 text-xs text-[var(--color-text-muted)]">{labels.twoRouteHint}</p>
          ) : null}

          <div className="pt-2">
            <TotalLine strong label={labels.total} value={formatMoney(draft.total)} />
          </div>
          {mismatch ? (
            <DAlert variant="warning" role="status" className="mt-2">
              {createDecimal(remaining).isNegative()
                ? `${labels.allocatedBeyondTotal} ${formatMoney(remaining.slice(1))}`
                : `${labels.leftToAllocate} ${formatMoney(remaining)}`}
            </DAlert>
          ) : null}
        </DCard>
      </section>

      <section aria-label={labels.changes}>
        {changes.length ? (
          <DCard variant="default" className="space-y-1 p-4 shadow-none">
            <h3 className="text-sm font-semibold">{labels.changes}</h3>
            <ul className="divide-y divide-[var(--color-border)]">
              {changes.map((move) => (
                <Row
                  key={move.routeId}
                  name={nameOf(move.routeId)}
                  trailing={
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {signed(move.delta)}
                    </span>
                  }
                />
              ))}
            </ul>
            <TotalLine label={labels.totalChanges} value={formatMoney(correctionNet(changes))} />
          </DCard>
        ) : (
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="text-sm font-semibold">{labels.changes}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{labels.nothingToChange}</p>
          </div>
        )}
      </section>
    </>
  );
}
