import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import { DButton, DDialog, DInput, DSelect, useToast } from '@digvation-labs/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BadgePercent, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { createCashierTransactionAdapter } from '../cashier-transaction-adapter-factory';
import { cashierTransactionErrorMessage } from '../cashier-transaction-errors';
import { cashierTransactionKeys } from '../cashier-transaction-keys';
import type { ApiPage, DiscountType, Sale } from '../cashier-transaction.types';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';
import { actionBlockMessage } from '../sale-workspace-view-model';

interface SaleAdjustmentControlsProps {
  workspace: ReturnType<typeof useCashierTransactionWorkspace>;
  placement?: 'inline' | 'payment';
}

const localCopy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  'Discounts & promotions': {
    'id-ID': 'Diskon & promo',
    'en-US': 'Discounts & promotions',
  },
  'Manage transaction discounts and promo codes before payment.': {
    'id-ID': 'Atur diskon transaksi dan kode promo sebelum pembayaran.',
    'en-US': 'Manage transaction discounts and promo codes before payment.',
  },
  'Manual transaction discount': {
    'id-ID': 'Diskon transaksi manual',
    'en-US': 'Manual transaction discount',
  },
  'A reason is required and the server recalculates the final amount.': {
    'id-ID': 'Alasan wajib diisi. Nilai akhir dihitung ulang oleh server.',
    'en-US': 'A reason is required and the server recalculates the final amount.',
  },
  'Discount type': { 'id-ID': 'Jenis diskon', 'en-US': 'Discount type' },
  Percentage: { 'id-ID': 'Persentase', 'en-US': 'Percentage' },
  'Fixed amount': { 'id-ID': 'Nominal', 'en-US': 'Fixed amount' },
  'Discount (%)': { 'id-ID': 'Diskon (%)', 'en-US': 'Discount (%)' },
  'Discount amount': { 'id-ID': 'Nominal diskon', 'en-US': 'Discount amount' },
  Reason: { 'id-ID': 'Alasan', 'en-US': 'Reason' },
  'Example: service recovery': {
    'id-ID': 'Contoh: kompensasi layanan',
    'en-US': 'Example: service recovery',
  },
  'Apply discount': { 'id-ID': 'Terapkan diskon', 'en-US': 'Apply discount' },
  'Update discount': { 'id-ID': 'Perbarui diskon', 'en-US': 'Update discount' },
  'Promo code': { 'id-ID': 'Kode promo', 'en-US': 'Promo code' },
  'Eligibility and the applied amount are validated by the server.': {
    'id-ID': 'Syarat dan nilai promo divalidasi oleh server.',
    'en-US': 'Eligibility and the applied amount are validated by the server.',
  },
  'Promotion applied': { 'id-ID': 'Promo diterapkan', 'en-US': 'Promotion applied' },
  'Promotion removed': { 'id-ID': 'Promo dihapus', 'en-US': 'Promotion removed' },
  'Promotion could not be applied': {
    'id-ID': 'Promo tidak dapat diterapkan',
    'en-US': 'Promotion could not be applied',
  },
  'Promotion could not be removed': {
    'id-ID': 'Promo tidak dapat dihapus',
    'en-US': 'Promotion could not be removed',
  },
  'The transaction total has been recalculated.': {
    'id-ID': 'Total transaksi telah dihitung ulang.',
    'en-US': 'The transaction total has been recalculated.',
  },
  'Remove promo code': { 'id-ID': 'Hapus kode promo', 'en-US': 'Remove promo code' },
  'Applied discounts': { 'id-ID': 'Diskon yang diterapkan', 'en-US': 'Applied discounts' },
  'Manual discount': { 'id-ID': 'Diskon manual', 'en-US': 'Manual discount' },
  'Could not prepare transaction': {
    'id-ID': 'Transaksi belum dapat disiapkan',
    'en-US': 'Could not prepare transaction',
  },
};

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

function commitSaleToCache(queryClient: ReturnType<typeof useQueryClient>, sale: Sale): void {
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

function findPaymentPromotionCard(labels: readonly string[]): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('.pos-reference-dialog'));
  for (const dialog of dialogs.reverse()) {
    const paragraph = Array.from(dialog.querySelectorAll<HTMLParagraphElement>('p')).find((node) =>
      labels.includes(node.textContent?.trim() ?? ''),
    );
    const card = paragraph?.parentElement?.parentElement;
    if (card instanceof HTMLElement) return card;
  }
  return null;
}

export function SaleAdjustmentControls({
  workspace,
  placement = 'inline',
}: SaleAdjustmentControlsProps) {
  const runtime = useRuntime();
  const { authPort } = useAuth();
  const { copy, locale } = useOperationalLocalization();
  const text = (value: string) => localCopy[value]?.[locale] ?? copy(value);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [paymentPromoTarget, setPaymentPromoTarget] = useState<HTMLElement | null>(null);

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
    if (placement !== 'payment') {
      setPaymentPromoTarget(null);
      return undefined;
    }

    let hiddenStatus: HTMLElement | null = null;
    const syncTarget = () => {
      if (hiddenStatus) hiddenStatus.hidden = false;
      hiddenStatus = null;
      const card = findPaymentPromotionCard([copy('Promotion'), 'Promo', 'Promotion']);
      if (card) {
        const row = card.firstElementChild;
        const status = row?.querySelector('span');
        if (status instanceof HTMLElement) {
          status.hidden = true;
          hiddenStatus = status;
        }
      }
      setPaymentPromoTarget((current) => (current === card ? current : card));
    };

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (hiddenStatus) hiddenStatus.hidden = false;
    };
  }, [copy, placement]);

  if ((!sale && workspace.cart.lines.length === 0) || (sale && sale.status !== 'OPEN')) return null;

  const adjustments = sale?.adjustments ?? [];
  const promotionAdjustments = adjustments.filter((item) => item.source === 'PROMOTION');
  const manualAdjustments = adjustments.filter((item) => item.source === 'MANUAL_DISCOUNT');
  const discountApiValue = discountValueForApi(discountType, discountValue);
  const canSaveDiscount =
    Boolean(sale) &&
    monetaryAvailable &&
    !workspace.isCoreMutating &&
    Boolean(discountApiValue && discountReason.trim());

  const populateForm = (currentSale: Sale) => {
    const nextType = currentSale.orderDiscountType ?? 'PERCENTAGE';
    setDiscountType(nextType);
    setDiscountValue(discountValueForForm(nextType, currentSale.orderDiscountValue));
    setDiscountReason(currentSale.orderDiscountReason ?? '');
    setPromoCode(currentSale.promotionCode ?? '');
  };

  const prepareAndOpen = async () => {
    if (sale) {
      populateForm(sale);
      setOpen(true);
      return;
    }
    if (!workspace.cart.isLocalDraft || preparing) return;
    setPreparing(true);
    try {
      const committed = await workspace.commitDraft();
      populateForm(committed);
      setOpen(true);
    } catch (error) {
      showToast({
        variant: 'danger',
        title: text('Could not prepare transaction'),
        description: cashierTransactionErrorMessage(error, runtime.locale),
      });
    } finally {
      setPreparing(false);
    }
  };

  const applyPromoCode = async () => {
    if (!sale) return;
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
        title: text('Promotion applied'),
        description: text('The transaction total has been recalculated.'),
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
        title: text('Promotion could not be applied'),
        description: cashierTransactionErrorMessage(error, runtime.locale),
      });
    } finally {
      setPromoBusy(false);
    }
  };

  const clearPromoCode = async () => {
    if (!sale) return;
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
        title: text('Promotion removed'),
        description: text('The transaction total has been recalculated.'),
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
        title: text('Promotion could not be removed'),
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

  const trigger = (
    <DButton
      size="sm"
      variant="secondary"
      fullWidth={placement === 'payment'}
      disabled={preparing}
      loading={preparing}
      onClick={() => void prepareAndOpen()}
    >
      <BadgePercent className="mr-1.5 size-4" />
      {text('Discounts & promotions')}
    </DButton>
  );

  return (
    <>
      {placement === 'payment'
        ? paymentPromoTarget
          ? createPortal(<div className="mt-3">{trigger}</div>, paymentPromoTarget)
          : null
        : trigger}

      {sale ? (
        <DDialog
          open={open}
          onClose={() => setOpen(false)}
          title={text('Discounts & promotions')}
          description={text('Manage transaction discounts and promo codes before payment.')}
          ariaLabel={text('Discounts & promotions')}
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
                  <h3 className="text-sm font-bold">{text('Manual transaction discount')}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {text('A reason is required and the server recalculates the final amount.')}
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
                  label={text('Discount type')}
                  value={discountType}
                  clearable={false}
                  disabled={!monetaryAvailable || workspace.isCoreMutating}
                  options={[
                    { value: 'PERCENTAGE', label: text('Percentage') },
                    { value: 'FIXED_AMOUNT', label: text('Fixed amount') },
                  ]}
                  onValueChange={(value) => setDiscountType(value as DiscountType)}
                />
                <DInput
                  label={text(discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount amount')}
                  value={discountValue}
                  inputMode="decimal"
                  disabled={!monetaryAvailable || workspace.isCoreMutating}
                  onChange={setDiscountValue}
                />
                <div className="sm:col-span-2">
                  <DInput
                    label={text('Reason')}
                    value={discountReason}
                    disabled={!monetaryAvailable || workspace.isCoreMutating}
                    onChange={setDiscountReason}
                    placeholder={text('Example: service recovery')}
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
                  {text(sale.orderDiscountType ? 'Update discount' : 'Apply discount')}
                </DButton>
              </div>
            </section>

            {promotionsEnabled ? (
              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">{text('Promo code')}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {text('Eligibility and the applied amount are validated by the server.')}
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
                      label={text('Promo code')}
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
                      {text('Remove promo code')}
                    </DButton>
                  </div>
                ) : null}
              </section>
            ) : null}

            {adjustments.length ? (
              <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <h3 className="text-sm font-bold">{text('Applied discounts')}</h3>
                <div className="mt-3 space-y-2">
                  {[...promotionAdjustments, ...manualAdjustments].map((adjustment) => (
                    <div
                      key={adjustment.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)]/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{adjustment.label}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {text(
                            adjustment.source === 'PROMOTION' ? 'Promotion' : 'Manual discount',
                          )}
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
      ) : null}
    </>
  );
}
