import { DButton, DInput } from '@digvation-labs/ui';
import { CheckCircle2, Pencil, Sparkles, Trash2 } from 'lucide-react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { pointQuantity } from '../transaction/model/sale-points';
import type { PaymentLoyaltyEditor } from './use-payment-loyalty-editor';

type Format = (amount: string) => string;

/** Member loyalty points: the point balance, the points editor, and the applied redemption. */
export function PaymentLoyaltySection({
  loyalty,
  loyaltyPoints,
  onLoyaltyPointsChange,
  loyaltyPointBalance,
  isLoyaltyBalanceLoading,
  isLoyaltyMutating,
  canRedeemLoyalty,
  locale,
  format,
}: {
  loyalty: PaymentLoyaltyEditor;
  loyaltyPoints: string;
  onLoyaltyPointsChange: (value: string) => void;
  loyaltyPointBalance: string | null;
  isLoyaltyBalanceLoading: boolean;
  isLoyaltyMutating: boolean;
  canRedeemLoyalty: boolean;
  locale: string;
  format: Format;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <section className="pos-pay-section pos-pay-section--secondary">
      <div className="pos-pay-section__head items-start">
        <div className="min-w-0">
          <p className="pos-pay-section__title">
            <Sparkles className="size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            {copy('Loyalty points')}
          </p>
          <p className="mt-1 pl-6 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy(
              'Use member points for this transaction. Points are consumed only when the sale is finalized.',
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="pos-pay-eyebrow">{copy('Point balance')}</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-warning)]">
            {isLoyaltyBalanceLoading ? '…' : `${pointQuantity(loyaltyPointBalance, locale)} PTS`}
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        {!loyalty.hasRedemption && canRedeemLoyalty && !loyalty.editorOpen ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Available balance')}: {pointQuantity(loyaltyPointBalance, locale)}{' '}
                {copy('points')}
              </p>
              <DButton
                type="button"
                size="sm"
                variant="outline"
                disabled={!loyalty.pointBalancePositive || isLoyaltyMutating}
                onClick={loyalty.start}
              >
                {copy('Use loyalty points')}
              </DButton>
            </div>
          </div>
        ) : null}

        {loyalty.editorOpen && canRedeemLoyalty ? (
          <div className="rounded-xl bg-[var(--color-surface)] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold">{copy('Points to use')}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Available balance')}: {pointQuantity(loyaltyPointBalance, locale)}{' '}
                {copy('points')}
              </p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
              <DInput
                value={loyaltyPoints}
                onChange={(value) => onLoyaltyPointsChange(value.replace(/\D/g, ''))}
                inputMode="numeric"
                disabled={isLoyaltyMutating}
                placeholder="0"
                autoFocus
              />
              <DButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={!loyalty.pointBalancePositive || isLoyaltyMutating}
                onClick={() => onLoyaltyPointsChange(loyalty.wholePointBalance!)}
              >
                {copy('Fill all')}
              </DButton>
              <DButton
                type="button"
                size="sm"
                disabled={!loyalty.canSubmit}
                loading={isLoyaltyMutating}
                onClick={() => void loyalty.apply()}
              >
                {copy('Apply')}
              </DButton>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-success)]">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                {copy('Points are only consumed after the transaction is finalized.')}
              </p>
              <DButton
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoyaltyMutating}
                onClick={loyalty.cancel}
              >
                {copy('Cancel')}
              </DButton>
            </div>
          </div>
        ) : loyalty.hasRedemption ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success)]/[.06] px-3 py-2.5">
            <CheckCircle2
              className="size-4 shrink-0 text-[var(--color-success)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{copy('Loyalty redemption')}</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                {pointQuantity(loyalty.redeemedPoints, locale)} {copy('points used')}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-danger)]">
              −{format(loyalty.redeemedAmount!)}
            </span>
            {canRedeemLoyalty ? (
              <div className="flex shrink-0 items-center gap-1">
                <DButton
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={copy('Edit')}
                  disabled={isLoyaltyMutating}
                  onClick={loyalty.edit}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </DButton>
                <DButton
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={copy('Remove')}
                  disabled={isLoyaltyMutating}
                  loading={isLoyaltyMutating}
                  onClick={loyalty.remove}
                >
                  <Trash2 className="size-4 text-[var(--color-danger)]" aria-hidden="true" />
                </DButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
