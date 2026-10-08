import { ApiError } from '@digvation/business-api';
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
} from '@digvation/pos-money';
import { DAlert, DButton as Button, DDialog as Dialog, useToast } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  cashierTransactionErrorMessage,
  isSaleVersionConflict,
} from '../transaction/api/cashier-transaction-errors';
import type { PaymentCorrectionInput } from '../transaction/api/cashier-transaction.adapter';
import type { PaymentRoute, Sale } from '../transaction/model/cashier-transaction.types';
import { money, transactionNumber } from '../transaction/model/sale-display';
import { PosCurrencyInput } from '../lib/pos-controls';
import { correctionEffectiveEntries, correctionRouteInfos } from './payment-correction-draft';

/** Runtime's payment-correction refusals an operator can act on, in the operator's words. */
function correctionErrorCopy(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case 'PAYMENT_CORRECTION_NOT_NET_ZERO':
      return 'The total paid must stay the same.';
    case 'PAYMENT_CORRECTION_EXCEEDS_SOURCE':
      return 'A route cannot give away more than was recorded on it.';
    case 'PAYMENT_CORRECTION_ROUTE_INVALID':
      return 'A payment route is no longer available. Reload and choose again.';
    case 'PAYMENT_CORRECTION_SALE_VOIDED':
    case 'SALE_ALREADY_REVERSED':
      return 'This transaction can no longer have its payments corrected.';
    case 'FORBIDDEN':
    case 'PAYMENT_CORRECTION_FORBIDDEN':
      return 'You are not allowed to correct payments.';
    default:
      return null;
  }
}

/**
 * Corrects how a payment was recorded, never how much was paid. The operator edits the CORRECT
 * composition of the routes in use; the composition model (shared with Backoffice) balances two
 * routes, reports what is left to allocate across more, and derives the net-zero changes. Runtime
 * validates the derived correction again and is the only authority on the result.
 */
export function ReferencePaymentCorrectionDialog({
  sale,
  locale,
  paymentRoutes,
  onClose,
  onCorrect,
  onCorrected,
  onReload,
}: {
  sale: Sale | null;
  locale: string;
  /** The location's active payment routes, so a route not yet used can be added. */
  paymentRoutes: readonly PaymentRoute[];
  onClose: () => void;
  /** Sends the one correction command; only Runtime's Sale is ever shown afterwards. */
  onCorrect: (
    saleId: string,
    input: PaymentCorrectionInput,
    idempotencyKey: string,
  ) => Promise<Sale>;
  onCorrected: (sale: Sale) => void;
  /** Reloads the persisted Sale after it changed elsewhere. */
  onReload: (saleId: string) => Promise<Sale>;
}) {
  const { copy, label } = useOperationalLocalization();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<CorrectionDraft | null>(null);
  const [adding, setAdding] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  // One idempotency key per exact request, so a retry of the same correction never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);

  if (!sale) return null;
  const format = (amount: string) => money(amount, locale);
  const signed = (delta: string) =>
    delta.startsWith('-') ? `−${format(delta.slice(1))}` : `+${format(delta)}`;
  const infos = correctionRouteInfos(sale, paymentRoutes);
  const info = (routeId: string) => infos.find((candidate) => candidate.routeId === routeId);
  const current = draft ?? startCorrectionDraft(correctionEffectiveEntries(sale));
  const state = correctionDraftState(current);
  const remaining = unallocatedAmount(current);
  const mismatch = !createDecimal(remaining).isZero();
  const trimmedReason = reason.trim();
  const ready = state.ok && trimmedReason.length >= 3 && !conflict && !saving;
  const update = (next: CorrectionDraft) => setDraft(next);
  const baseline = startCorrectionDraft(correctionEffectiveEntries(sale));

  const save = () => {
    if (!state.ok || !ready) return;
    const request = paymentCorrectionRequest({
      expectedVersion: sale.version,
      reason: trimmedReason,
      moves: state.moves,
    });
    const signature = JSON.stringify(request);
    const key =
      attempt?.request === signature
        ? attempt.key
        : `cashier-payment-correction-${crypto.randomUUID()}`;
    setAttempt({ request: signature, key });
    setSaving(true);
    setSaveError(null);
    void onCorrect(sale.id, request, key)
      .then((updated) => {
        showToast({
          title: copy('Payment correction saved'),
          description: transactionNumber(updated, locale),
          variant: 'success',
        });
        onCorrected(updated);
      })
      .catch((error: unknown) => {
        // The typed values stay exactly as they were; only Runtime's refusal is explained.
        setSaving(false);
        const known = correctionErrorCopy(error);
        setSaveError(
          known
            ? copy(known)
            : error instanceof ApiError
              ? cashierTransactionErrorMessage(error, locale)
              : copy('The payment correction could not be saved. Try again.'),
        );
        if (isSaleVersionConflict(error)) setConflict(true);
      });
  };
  const reload = () => {
    setReloading(true);
    void onReload(sale.id)
      .then(() => {
        // The composition changed under the draft: start again from what Runtime holds.
        setDraft(null);
        setAdding(false);
        setConflict(false);
        setSaveError(null);
      })
      .catch((error: unknown) => setSaveError(cashierTransactionErrorMessage(error, locale)))
      .finally(() => setReloading(false));
  };
  const close = () => {
    if (!saving) onClose();
  };

  const currentRoutes = Object.entries(baseline.current).filter(
    ([, amount]) => !createDecimal(amount).isZero(),
  );
  const addable = addableRoutes(current, infos);
  const changes = state.ok ? state.moves : [];

  return (
    <Dialog
      open
      onClose={close}
      title={copy('Payment correction')}
      description={transactionNumber(sale, locale)}
      ariaLabel={copy('Payment correction')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={close}>
            {copy('Cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} loading={saving} onClick={save}>
            {copy('Save correction')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          {copy('Payment correction explanation')}
        </p>

        <section aria-label={copy('Recorded now')}>
          <h3 className="text-sm font-semibold">{copy('Recorded now')}</h3>
          <ul className="mt-1 divide-y divide-[var(--color-border)]">
            {currentRoutes.map(([routeId, amount]) => (
              <li key={routeId} className="flex justify-between gap-4 py-1.5 text-sm">
                <span className="min-w-0 break-words">{info(routeId)?.name ?? routeId}</span>
                <span className="shrink-0 font-semibold tabular-nums">{format(amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{copy('Total paid')}</span>
            <span className="tabular-nums">{format(current.total)}</span>
          </p>
        </section>

        <section aria-label={copy('Correct recording')}>
          <h3 className="text-sm font-semibold">{copy('Correct recording')}</h3>
          <ul className="mt-1 space-y-2">
            {current.selected.map((routeId) => {
              const route = info(routeId);
              const name = route?.name ?? routeId;
              return (
                <li key={routeId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm">
                    <span className="block break-words font-medium">{name}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {route ? label(route.method as never) : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <PosCurrencyInput
                      aria-label={name}
                      className="w-40 text-right"
                      value={current.amounts[routeId] ?? ''}
                      disabled={saving}
                      fractionDigits={0}
                      onChange={(value) => update(editCorrectionAmount(current, routeId, value))}
                    />
                    {canRemoveCorrectionRoute(current) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`${copy('Remove payment method')} ${name}`}
                        disabled={saving}
                        onClick={() => update(removeCorrectionRoute(current, routeId))}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2">
            {adding ? (
              <ul
                aria-label={copy('Add payment method')}
                className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]"
              >
                {addable.map((route) => (
                  <li key={route.routeId}>
                    <button
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
                      onClick={() => {
                        update(addCorrectionRoute(current, route.routeId));
                        setAdding(false);
                      }}
                    >
                      <span className="font-medium">{route.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {label(route.method as never)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Plus className="size-4" aria-hidden />}
                disabled={saving || addable.length === 0}
                onClick={() => setAdding(true)}
              >
                {copy('Add payment method')}
              </Button>
            )}
          </div>
          <p className="mt-2 flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>{copy('Total')}</span>
            <span className="tabular-nums">{format(current.total)}</span>
          </p>
          {mismatch ? (
            <DAlert variant="warning" role="status" className="mt-2">
              {createDecimal(remaining).isNegative()
                ? `${copy('Allocated beyond the total paid')} ${format(remaining.slice(1))}`
                : `${copy('Left to allocate')} ${format(remaining)}`}
            </DAlert>
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
                <span className="tabular-nums">{format(correctionNet(changes))}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Nothing to change yet.')}
            </p>
          )}
        </section>

        <label className="block text-sm font-medium">
          {copy('Reason')}
          <DTextarea
            className="mt-1.5 h-10 rounded-lg"
            value={reason}
            disabled={saving}
            onChange={setReason}
            placeholder={copy('Correction reason placeholder')}
          />
        </label>

        {saveError ? (
          <DAlert variant="danger" role="alert">
            {saveError}
            {conflict ? (
              <>
                {' '}
                <Button size="sm" variant="outline" loading={reloading} onClick={reload}>
                  {copy('Reload latest transaction')}
                </Button>
              </>
            ) : null}
          </DAlert>
        ) : null}
      </div>
    </Dialog>
  );
}
