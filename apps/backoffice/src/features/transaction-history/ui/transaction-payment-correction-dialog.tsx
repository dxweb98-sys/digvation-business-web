import {
  addCorrectionRoute,
  addableRoutes,
  canRemoveCorrectionRoute,
  correctionDraftState,
  correctionNet,
  createDecimal,
  editCorrectionAmount,
  paymentCorrectionRequest,
  removeCorrectionRoute,
  startCorrectionDraft,
  unallocatedAmount,
  type CorrectionDraft,
  type CorrectionRouteInfo,
} from '@digvation/business-money';
import { DButton, DCurrencyInput, DDialog, DInfoNote, DSelect, DTextarea } from '@digvation/ui';
import { X } from 'lucide-react';
import { useState } from 'react';

import type {
  CorrectionRoute,
  PaymentCorrectionRequest,
  Sale,
} from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { PAYMENT_METHOD_LABELS } from '../model/transaction-summary';

/**
 * Corrects how a payment was recorded, never how much was paid. It is the same composition editor
 * Operational uses (one shared model): the correct composition of the routes in use is edited, two
 * routes balance each other, more routes report what is left to allocate, and the net-zero changes
 * are derived. Runtime validates routes, capacity and the sum again and stays the authority.
 */
export function TransactionPaymentCorrectionDialog({
  open,
  sale,
  routes,
  onClose,
  onCorrect,
}: {
  open: boolean;
  sale: Sale;
  /** Active payment routes of the Sale's location. */
  routes: readonly CorrectionRoute[];
  onClose: () => void;
  /** Resolves `null` on success, else the message to show. */
  onCorrect: (request: PaymentCorrectionRequest, idempotencyKey: string) => Promise<string | null>;
}) {
  const { copy, formatMoney } = useTransactionHistoryLocalization();
  const entries = (sale.paymentComposition?.entries ?? []).filter(
    (entry) => entry.paymentRouteId !== null,
  );
  const baseline = startCorrectionDraft(
    entries.map((entry) => ({ routeId: entry.paymentRouteId!, amount: entry.effectiveAmount })),
  );
  const infos: CorrectionRouteInfo[] = [
    ...new Map<string, CorrectionRouteInfo>([
      ...entries.map(
        (entry) =>
          [
            entry.paymentRouteId!,
            {
              routeId: entry.paymentRouteId!,
              name: entry.financialAccountName ?? entry.method,
              method: entry.method,
            },
          ] as const,
      ),
      ...routes.map(
        (route) =>
          [
            route.id,
            { routeId: route.id, name: route.financialAccountName, method: route.paymentMethod },
          ] as const,
      ),
    ]).values(),
  ];
  const info = (routeId: string) => infos.find((candidate) => candidate.routeId === routeId);
  const methodLabel = (method: string | undefined) =>
    method ? copy(PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS]) : '';
  const money = (amount: string) => formatMoney(amount, sale.currency);
  const signed = (delta: string) =>
    delta.startsWith('-') ? `−${money(delta.slice(1))}` : `+${money(delta)}`;

  const [typed, setTyped] = useState<CorrectionDraft | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  const draft = typed ?? baseline;
  const state = correctionDraftState(draft);
  const remaining = unallocatedAmount(draft);
  const mismatch = !createDecimal(remaining).isZero();
  const valid = state.ok && reason.trim().length >= 3;
  const addable = addableRoutes(draft, infos);
  const changes = state.ok ? state.moves : [];
  const heldNow = Object.entries(baseline.current).filter(
    ([, amount]) => !createDecimal(amount).isZero(),
  );

  const submit = async () => {
    if (!state.ok || !valid || saving) return;
    const request = paymentCorrectionRequest({
      expectedVersion: sale.version,
      reason,
      moves: state.moves,
    });
    const signature = JSON.stringify(request);
    const key =
      attempt?.request === signature
        ? attempt.key
        : `backoffice-payment-correction-${crypto.randomUUID()}`;
    setAttempt({ request: signature, key });
    setSaving(true);
    setError(await onCorrect(request, key));
    setSaving(false);
  };

  return (
    <DDialog
      open={open}
      onClose={() => !saving && onClose()}
      title={copy('Payment correction')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void submit()} disabled={!valid || saving} loading={saving}>
            {copy('Save correction')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <DInfoNote>{copy('Payment correction explanation')}</DInfoNote>

        <section aria-label={copy('Recorded now')}>
          <h3 className="text-sm font-semibold">{copy('Recorded now')}</h3>
          <ul className="mt-1 divide-y divide-[var(--color-border)]">
            {heldNow.map(([routeId, amount]) => (
              <li key={routeId} className="flex justify-between gap-4 py-1.5 text-sm">
                <span className="min-w-0 break-words">{info(routeId)?.name ?? routeId}</span>
                <span className="shrink-0 font-semibold tabular-nums">{money(amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{copy('Total paid')}</span>
            <span className="tabular-nums">{money(draft.total)}</span>
          </p>
        </section>

        <section aria-label={copy('Correct recording')}>
          <h3 className="text-sm font-semibold">{copy('Correct recording')}</h3>
          <ul className="mt-1 space-y-2">
            {draft.selected.map((routeId) => {
              const route = info(routeId);
              const name = route?.name ?? routeId;
              return (
                <li key={routeId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm">
                    <span className="block break-words font-medium">{name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {methodLabel(route?.method)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <DCurrencyInput
                      aria-label={name}
                      className="w-40"
                      value={draft.amounts[routeId] ?? ''}
                      disabled={saving}
                      onValueChange={(value) => {
                        setTyped(editCorrectionAmount(draft, routeId, value));
                        setError(null);
                      }}
                    />
                    {canRemoveCorrectionRoute(draft) ? (
                      <DButton
                        size="sm"
                        variant="ghost"
                        aria-label={`${copy('Remove payment method')} ${name}`}
                        disabled={saving}
                        onClick={() => setTyped(removeCorrectionRoute(draft, routeId))}
                      >
                        <X className="size-4" aria-hidden />
                      </DButton>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {addable.length ? (
            <div className="mt-2">
              <DSelect
                value=""
                placeholder={`+ ${copy('Add payment method')}`}
                aria-label={copy('Add payment method')}
                options={addable.map((route) => ({
                  value: route.routeId,
                  label: `${route.name} · ${methodLabel(route.method)}`,
                }))}
                disabled={saving}
                onChange={(value) => {
                  const routeId = String(value ?? '');
                  if (routeId) setTyped(addCorrectionRoute(draft, routeId));
                }}
              />
            </div>
          ) : null}
          <p className="mt-2 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{copy('Total')}</span>
            <span className="tabular-nums">{money(draft.total)}</span>
          </p>
          {mismatch ? (
            <DInfoNote variant="warning" className="mt-2">
              {createDecimal(remaining).isNegative()
                ? `${copy('Allocated beyond the total paid')} ${money(remaining.slice(1))}`
                : `${copy('Left to allocate')} ${money(remaining)}`}
            </DInfoNote>
          ) : null}
        </section>

        <section aria-label={copy('Correction changes')}>
          <h3 className="text-sm font-semibold">{copy('Correction changes')}</h3>
          {changes.length ? (
            <>
              <ul className="mt-1 divide-y divide-[var(--color-border)]">
                {changes.map((move) => (
                  <li key={move.routeId} className="flex justify-between gap-4 py-1.5 text-sm">
                    <span className="min-w-0 break-words">{info(move.routeId)?.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {signed(move.delta)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>{copy('Total changes')}</span>
                <span className="tabular-nums">{money(correctionNet(changes))}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Nothing to change yet.')}
            </p>
          )}
        </section>

        <DTextarea
          label={copy('Correction reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setError(null);
          }}
          placeholder={copy('For example, the payment amount was entered wrongly')}
          error={error ?? undefined}
          disabled={saving}
        />
      </div>
    </DDialog>
  );
}
