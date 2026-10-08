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
import { DAlert, DButton } from '@digvation/ui';
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
  /** Visible heading of the changes section; the region keeps `changes` as its name. */
  changesTitle: string;
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
  /** Surface density: Operational is comfortable, Backoffice (audit-oriented) is compact. */
  density?: 'comfortable' | 'compact';
  formatMoney: (amount: string) => string;
  methodLabel: (method: string | undefined) => string;
  /** Each app supplies its own Digvation currency input; the interaction model is shared. */
  renderAmountInput: (props: CorrectionAmountInputProps) => ReactNode;
  onDraftChange: (draft: CorrectionDraft) => void;
}

const rowPad = (density: 'comfortable' | 'compact') =>
  density === 'compact' ? 'py-1.5' : 'py-2.5';

function Row({
  name,
  detail,
  trailing,
  muted = false,
  pad,
}: {
  name: string;
  detail?: string | undefined;
  trailing: ReactNode;
  muted?: boolean;
  pad: string;
}) {
  return (
    <li className={`flex items-center justify-between gap-3 ${pad}`}>
      <span className="min-w-0 text-sm">
        <span
          className={`block break-words ${muted ? 'text-[var(--color-text-muted)]' : 'font-medium'}`}
        >
          {name}
        </span>
        {detail && detail !== name ? (
          <span className="block text-xs text-[var(--color-text-muted)]">{detail}</span>
        ) : null}
      </span>
      {trailing}
    </li>
  );
}

function TotalLine({
  label,
  value,
  strong = false,
  pad,
}: {
  label: string;
  value: string;
  strong?: boolean;
  pad: string;
}) {
  return (
    <p
      className={`flex justify-between gap-4 border-t border-[var(--color-border)] text-sm ${pad} ${
        strong ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

/**
 * The composition editor both Operational and Backoffice use. It owns the behavior (the shared
 * draft model: balancing, add, remove, derived changes) and a three-step reading order: what is
 * recorded now (quiet reference), what it should be (the task, marked by a brand rule rather than a
 * box), and what will be recorded (a result that stays one quiet line until something changes).
 * Runtime stays the authority.
 */
export function CorrectionCompositionEditor({
  baseline,
  draft,
  routes,
  labels,
  disabled = false,
  density = 'comfortable',
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
  const pad = rowPad(density);
  const gap = density === 'compact' ? 'space-y-4' : 'space-y-5';

  return (
    <div className={gap}>
      {/* 1. What was recorded: reference information, quiet, nothing to operate. */}
      <section
        aria-label={labels.recordedNow}
        className="rounded-xl bg-[var(--color-surface-muted)] px-4 py-3"
      >
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)]">
          {labels.recordedNow}
        </h3>
        <ul className="mt-1 divide-y divide-[var(--color-border)]">
          {recorded.map(([routeId, amount]) => (
            <Row
              key={routeId}
              pad="py-2"
              name={nameOf(routeId)}
              detail={methodLabel(info(routeId)?.method)}
              muted
              trailing={
                <span className="shrink-0 text-sm tabular-nums text-[var(--color-text-muted)]">
                  {formatMoney(amount)}
                </span>
              }
            />
          ))}
        </ul>
        <TotalLine pad="pt-2" label={labels.totalPaid} value={formatMoney(draft.total)} />
      </section>

      {/* 2. What it should be: the task. A brand rule marks it; no box around the controls. */}
      <section
        aria-label={labels.correctRecording}
        className="border-l-[3px] border-l-[color:var(--color-brand)] pl-4"
      >
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {labels.correctRecording}
        </h3>
        <ul className="mt-1 divide-y divide-[var(--color-border)]">
          {draft.selected.map((routeId) => {
            const name = nameOf(routeId);
            return (
              <Row
                key={routeId}
                pad={pad}
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

        <div className="border-t border-[var(--color-border)] py-1.5">
          {adding && addable.length ? (
            <ul
              aria-label={labels.addPaymentMethod}
              className="my-1 divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)]"
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
              variant="ghost"
              size="sm"
              className="-ml-2 text-[var(--color-brand)]"
              leftIcon={<Plus className="size-4" aria-hidden />}
              disabled={disabled || addable.length === 0}
              onClick={() => setAdding(true)}
            >
              {labels.addPaymentMethod}
            </DButton>
          )}
          {draft.selected.length === 2 ? (
            <p className="text-xs text-[var(--color-text-muted)]">{labels.twoRouteHint}</p>
          ) : null}
        </div>

        <TotalLine strong pad="pt-2.5" label={labels.total} value={formatMoney(draft.total)} />
        {mismatch ? (
          <DAlert variant="warning" role="status" className="mt-2">
            {createDecimal(remaining).isNegative()
              ? `${labels.allocatedBeyondTotal} ${formatMoney(remaining.slice(1))}`
              : `${labels.leftToAllocate} ${formatMoney(remaining)}`}
          </DAlert>
        ) : null}
      </section>

      {/* 3. What will be recorded: a result. One quiet line until something actually changes. */}
      <section aria-label={labels.changes}>
        {changes.length ? (
          <div className="rounded-xl border border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              {labels.changesTitle}
            </h3>
            <ul className="mt-1 divide-y divide-[var(--color-border)]">
              {changes.map((move) => (
                <Row
                  key={move.routeId}
                  pad="py-2"
                  name={nameOf(move.routeId)}
                  trailing={
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {signed(move.delta)}
                    </span>
                  }
                />
              ))}
            </ul>
            <TotalLine
              pad="pt-2"
              label={labels.totalChanges}
              value={formatMoney(correctionNet(changes))}
            />
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3 px-1 text-sm text-[var(--color-text-muted)]">
            <h3 className="font-medium">{labels.changesTitle}</h3>
            <p>{labels.nothingToChange}</p>
          </div>
        )}
      </section>
    </div>
  );
}
