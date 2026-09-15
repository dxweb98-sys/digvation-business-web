import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import { DButton, DDialog, DInput, DSelect, useToast } from '@digvation-labs/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { createCashierTransactionAdapter } from '../cashier-transaction-adapter-factory';
import { cashierTransactionErrorMessage } from '../cashier-transaction-errors';
import { cashierTransactionKeys } from '../cashier-transaction-keys';
import type { ApiPage, DiscountType, Sale } from '../cashier-transaction.types';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';
import { actionBlockMessage } from '../sale-workspace-view-model';

interface SaleAdjustmentControlsProps {
  workspace: ReturnType<typeof useCashierTransactionWorkspace>;
}

function discountValueForForm(type: DiscountType | null, value: string | null): string {
  if (!type || !value) return '';
  return type === 'PERCENTAGE' ? createDecimal(value).times(100).toFixed() : value;
}

function discountValueForApi(type: DiscountType, value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  const decimal = createDecimal(trimmed);
  if (decimal.lessThanOrEqualTo(0)) return null;
  if (type === 'PERCENTAGE') {
    if (decimal.greaterThan(100)) return null;
    return decimal.dividedBy(100).toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
  }
  return trimmed;
}

function commitSaleToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sale: Sale,
): void {
  queryClient.setQueryData(cashierTransactionKeys.sale(sale.id), sale);
  queryClient.setQueryData<ApiPage<Sale>>(cashierTransactionKeys.sales(), (page) => {
    if (!page) return page;
    const index = page.items.findIndex((item) => item.id === sale.id);
    if (index < 0) return page;
    return {
      ...page,
      items: page.items.map((item) => (item.id === sale.id ? sale : item)),
    };
  });
}

export function SaleAdjustmentControls({ workspace }: SaleAdjustmentControlsProps) {
  const runtime = useRuntime();
  const { authPort } = useAuth();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken?.bind(authPort)),
    [authPort, runtime],
  );
  const sale = workspace.viewModel.sale;
  const promotionsEnabled = runtime.effectiveEntitlements.capabilities.includes('PROMOTIONS');
  const monetaryAvailable = workspace.viewModel.monetaryMutation.state === 'AVAILABLE';
  const disabledMessage =
    workspace.viewModel.monetaryMutation.state === 'DISABLED'
      ? actionBlockMessage(workspace.viewModel.monetaryMutation.reason, runtime.locale)
      : null;

  useEffect(() => {
    if (!sale) return;
    const nextType = sale.orderDiscountType ?? 'PERCENTAGE';
    setDiscountType(nextType);
    setDiscountValue(discountValueForForm(nextType, sale.orderDiscountValue));
    setDiscountReason(sale.orderDiscountReason ?? '');
    setPromoCode(sale.promotionCode ?? '');
  }, [sale?.id, sale?.version]);

  if (!sale || sale.status !== 'OPEN') return null;

  const promotionAdjustments = sale.adjustments.filter((item) => item.source === 'PROMOTION');
  const manualAdjustments = sale.adjustments.filter((item) => item.source === 'MANUAL_DISCOUNT');
  const discountApiValue = discountValueForApi(discountType, discountValue);
  const canSaveDiscount =
    monetaryAvailable &&
    !workspace.isCoreMutating &&
    Boolean(discountApiValue && discountReason.trim());

  const applyPromoCode = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!promotionsEnabled || !monetaryAvailable || !code || promoBusy) return;
    setPromoBusy(true);
    try {
      const updated = await adapter.setPromotionCode(
        sale.id,
        { expectedVersion: sale.version, code },
        `cashier-promo-code-${crypto.randomUUID()}`,
      );
      commitSaleToCache(queryClient, updated);
      setPromoCode(updated.promotionCode ?? code);
      showToast({
        variant: 'success',
        title: copy('Promotion applied'),
        description: copy('The transaction total has been recalculated.'),
      });
    } catch (error) {
      try {
        const latest = await adapter.getSale(sale.id);
        commitSaleToCache(queryClient, latest);
      } catch {
        // Keep the current authoritative cache when refresh is unavailable.
      }
      showToast({
        variant: 'danger',
        title: copy('Promotion could not be applied'),
        description: cashierTransactionErrorMessage(error, runtime.locale),
      });
    } finally {
      setPromoBusy(false);
    }
  };

  const clearPromoCode = async () => {
    if (!promotionsEnabled || !monetaryAvailable || !sale.promotionCode || promoBusy) return;
    setPromoBusy(true);
    try {
      const updated = await adapter.clearPromotionCode(
        sale.id,
        sale.version,
        `cashier-promo-code-remove-${crypto.randomUUID()}`,
      );
      commitSaleToCache(queryClient, updated);
      setPromoCode('');
      showToast({
        variant: 'success',
        title: copy('Promotion removed'),
        description: copy('The transaction total has been recalculated.'),
      });
    } catch (error) {
      showToast({
        variant: 'danger',
        title: copy('Promotion could not be removed'),
        description: cashierTransactionErrorMessage(error, runtime.locale),
      });
    } finally {
      setPromoBusy(false);
    }
  };

  const saveOrderDiscount = () => {
    if (!discountApiValue || !discountReason.trim() || !canSaveDiscount) return;
    workspace.setOrderDiscount({
      type: discountType,
      value: discountApiValue,
      reason: discountReason.trim(),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-30 inline-flex h-11 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-xs font-bold text-[var(--color-text)] shadow-[0_12px_32px_rgb(15_23_42_/_0.14)] transition-all hover:border-[var(--color-brand)]/35 hover:text-[var(--color-brand)] active:scale-[.98]"
      >
        <BadgePercent className="size-4" />
        {copy('Discounts & promotions')}
      </button>

      <DDialog
        open={open}
        onClose={() => setOpen(false)}
        title={copy('Discounts & promotions')}
        description={copy('Manage transaction discounts and promo codes before payment.')}
        ariaLabel={copy('Discounts & promotions')}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
        footer={
          <div className="flex justify-end">
            <DButton variant="ghost" onClick={() => setOpen(false)}>
              {copy('Close')}
            </DButton>
          </div>
        }
      >
        <div className="space-y-4">
          {disabledMessage ? (
            <div className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              {disabledMessage}
            </div>
          ) : null}

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">{copy('Manual transaction discount')}</h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {copy('A reason is required and the server recalculates the final amount.')}
                </p>
              </div>
              {sale.orderDiscountType ? (
                <DButton
                  size="sm"
                  variant="ghost"
                  disabled={!monetaryAvailable || workspace.isCoreMutating}
                  onClick={workspace.clearOrderDiscount}
                >
                  <X className="mr-1 size-3.5" /> {copy('Remove')}
                </DButton>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DSelect
                label={copy('Discount type')}
                value={discountType}
                clearable={false}
                disabled={!monetaryAvailable || workspace.isCoreMutating}
                options={[
                  { value: 'PERCENTAGE', label: copy('Percentage') },
                  { value: 'FIXED_AMOUNT', label: copy('Fixed amount') },
                ]}
                onValueChange={(value) => setDiscountType(value as DiscountType)}
              />
              <DInput
                label={copy(discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount amount')}
                value={discountValue}
                inputMode="decimal"
                disabled={!monetaryAvailable || workspace.isCoreMutating}
                onChange={setDiscountValue}
              />
              <div className="sm:col-span-2">
                <DInput
                  label={copy('Reason')}
                  value={discountReason}
                  disabled={!monetaryAvailable || workspace.isCoreMutating}
                  onChange={setDiscountReason}
                  placeholder={copy('Example: service recovery')}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <DButton
                size="sm"
                disabled={!canSaveDiscount}
                loading={workspace.isCoreMutating}
                onClick={saveOrderDiscount}
              >
                {copy(sale.orderDiscountType ? 'Update discount' : 'Apply discount')}
              </DButton>
            </div>
          </section>

          {promotionsEnabled ? (
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">{copy('Promo code')}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {copy('Eligibility and the applied amount are validated by the server.')}
                  </p>
                </div>
                {sale.promotionCode ? (
                  <span className="rounded-full bg-[var(--color-brand)]/10 px-2 py-1 text-[10px] font-bold text-[var(--color-brand)]">
                    {sale.promotionCode}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <DInput
                    label={copy('Promo code')}
                    value={promoCode}
                    disabled={!monetaryAvailable || promoBusy}
                    onChange={(value) => setPromoCode(value.toUpperCase())}
                    placeholder="WELCOME10"
                  />
                </div>
                <DButton
                  disabled={!monetaryAvailable || promoBusy || !promoCode.trim()}
                  loading={promoBusy}
                  onClick={() => void applyPromoCode()}
                >
                  <Tag className="mr-1.5 size-3.5" /> {copy('Apply')}
                </DButton>
              </div>
              {sale.promotionCode ? (
                <div className="mt-2 flex justify-end">
                  <DButton
                    size="sm"
                    variant="ghost"
                    disabled={!monetaryAvailable || promoBusy}
                    onClick={() => void clearPromoCode()}
                  >
                    {copy('Remove promo code')}
                  </DButton>
                </div>
              ) : null}
            </section>
          ) : null}

          {sale.adjustments.length ? (
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <h3 className="text-sm font-bold">{copy('Applied discounts')}</h3>
              <div className="mt-3 space-y-2">
                {[...promotionAdjustments, ...manualAdjustments].map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)]/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{adjustment.label}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        {copy(adjustment.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')}
                        {adjustment.reason ? ` · ${adjustment.reason}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-[var(--color-brand)]">
                      −{formatMoney(adjustment.actualAmount, sale.currency, runtime.locale)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </DDialog>
    </>
  );
}
