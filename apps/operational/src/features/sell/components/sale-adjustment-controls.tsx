import { useAuth } from '@digvation/pos-auth';
import { createDecimal, formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import { DAlert, DButton, DDialog, DInput, DSelect, useToast } from '@digvation-labs/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BadgePercent, CheckCircle2, Tag, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { createCashierTransactionAdapter } from '../cashier-transaction-adapter-factory';
import { cashierTransactionErrorMessage } from '../cashier-transaction-errors';
import { cashierTransactionKeys } from '../cashier-transaction-keys';
import type { ApiPage, DiscountType, Sale, SaleAdjustment } from '../cashier-transaction.types';
import type { useCashierTransactionWorkspace } from '../use-cashier-transaction-workspace';
import { checkoutAdjustmentRows } from '../sale-presentation';
import { actionBlockMessage } from '../sale-workspace-view-model';

interface SaleAdjustmentControlsProps {
  workspace: ReturnType<typeof useCashierTransactionWorkspace>;
  /** `payment` renders the applied-adjustment card inside the checkout dialog. */
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
  'Manual discount': { 'id-ID': 'Diskon manual', 'en-US': 'Manual discount' },
  'Could not prepare transaction': {
    'id-ID': 'Transaksi belum dapat disiapkan',
    'en-US': 'Could not prepare transaction',
  },
  'Automatic promotion': { 'id-ID': 'Promo otomatis', 'en-US': 'Automatic promotion' },
  'Code applied to this transaction': {
    'id-ID': 'Kode diterapkan ke transaksi ini',
    'en-US': 'Code applied to this transaction',
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

export function SaleAdjustmentControls({
  workspace,
  placement = 'inline',
}: SaleAdjustmentControlsProps) {
  const runtime = useRuntime();
  const { authPort, session } = useAuth();
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
  const [promoError, setPromoError] = useState<string | null>(null);

  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken?.bind(authPort)),
    [authPort, runtime],
  );
  const sale = workspace.viewModel.sale;
  const promotionsEnabled = session.access.capabilities.includes('PROMOTIONS');
  const monetaryAvailable = workspace.viewModel.monetaryMutation.state === 'AVAILABLE';
  const disabledMessage =
    workspace.viewModel.monetaryMutation.state === 'DISABLED'
      ? actionBlockMessage(workspace.viewModel.monetaryMutation.reason, runtime.locale)
      : null;

  if ((!sale && workspace.cart.lines.length === 0) || (sale && sale.status !== 'OPEN')) return null;

  const adjustments = sale ? checkoutAdjustmentRows(sale) : [];
  const promotionAdjustments = adjustments.filter((item) => item.source === 'PROMOTION');
  const manualAdjustments = adjustments.filter((item) => item.source === 'MANUAL_DISCOUNT');
  const appliedAdjustments = [...promotionAdjustments, ...manualAdjustments];
  const money = (amount: string) => formatMoney(amount, sale?.currency ?? 'IDR', runtime.locale);

  const adjustmentTitle = (adjustment: SaleAdjustment) =>
    adjustment.source === 'PROMOTION'
      ? adjustment.label || (sale?.promotionCode ?? text('Automatic promotion'))
      : adjustment.label || text('Manual discount');
  const adjustmentSource = (adjustment: SaleAdjustment) =>
    adjustment.source === 'PROMOTION'
      ? sale?.promotionCode && adjustment.promotionId
        ? `${copy('Promotion')} · ${sale.promotionCode}`
        : copy('Promotion')
      : [
          text('Manual discount'),
          adjustment.reason !== adjustmentTitle(adjustment) ? adjustment.reason : null,
        ]
          .filter(Boolean)
          .join(' · ');

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
    setPromoCode('');
    setPromoError(null);
  };

  const prepareAndOpen = async () => {
    if (sale) {
      setPreparing(true);
      try {
        const refreshed = promotionsEnabled
          ? await adapter.refreshPromotionEligibility(
              sale.id,
              sale.version,
              `cashier-promotion-refresh-${crypto.randomUUID()}`,
            )
          : sale;
        commitSaleToCache(queryClient, refreshed);
        populateForm(refreshed);
        setOpen(true);
      } catch (error) {
        await refreshAfterFailure(sale.id);
        showToast({
          variant: 'danger',
          title: text('Could not prepare transaction'),
          description: cashierTransactionErrorMessage(error, runtime.locale),
        });
      } finally {
        setPreparing(false);
      }
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

  const refreshAfterFailure = async (saleId: string) => {
    try {
      commitSaleToCache(queryClient, await adapter.getSale(saleId));
    } catch {
      // Keep the current authoritative cache when refresh is unavailable.
    }
  };

  const applyPromoCode = async () => {
    if (!sale) return;
    const code = promoCode.trim().toUpperCase();
    if (!promotionsEnabled || !monetaryAvailable || !code || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const updated = await adapter.setPromotionCode(
        sale.id,
        { expectedVersion: sale.version, code },
        `cashier-promo-code-${crypto.randomUUID()}`,
      );
      commitSaleToCache(queryClient, updated);
      setPromoCode('');
      showToast({
        variant: 'success',
        title: text('Promotion applied'),
        description: text('The transaction total has been recalculated.'),
      });
    } catch (error) {
      await refreshAfterFailure(sale.id);
      setPromoError(cashierTransactionErrorMessage(error, runtime.locale));
    } finally {
      setPromoBusy(false);
    }
  };

  const clearPromoCode = async () => {
    if (!sale) return;
    if (!promotionsEnabled || !monetaryAvailable || !sale.promotionCode || promoBusy) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const updated = await adapter.clearPromotionCode(
        sale.id,
        sale.version,
        `cashier-promo-code-remove-${crypto.randomUUID()}`,
      );
      commitSaleToCache(queryClient, updated);
      showToast({
        variant: 'success',
        title: text('Promotion removed'),
        description: text('The transaction total has been recalculated.'),
      });
    } catch (error) {
      await refreshAfterFailure(sale.id);
      showToast({
        variant: 'danger',
        title: text('Promotion could not be removed'),
        description: cashierTransactionErrorMessage(error, runtime.locale),
      });
    } finally {
      setPromoBusy(false);
    }
  };

  const saveOrderDiscount = async () => {
    if (!discountApiValue || !discountReason.trim() || !canSaveDiscount) return;
    try {
      await workspace.setOrderDiscount({
        type: discountType,
        value: discountApiValue,
        reason: discountReason.trim(),
      });
    } catch {
      // The sale core controller reports the failure; keep the form available for correction.
    }
  };

  const appliedList = (
    <ul className="space-y-2">
      {appliedAdjustments.map((adjustment) => {
        const removable =
          adjustment.scope === 'TRANSACTION' &&
          (adjustment.source === 'MANUAL_DISCOUNT'
            ? Boolean(sale?.orderDiscountType)
            : Boolean(sale?.promotionCode && adjustment.promotionId));
        return (
          <li
            key={adjustment.id}
            className="pos-adjustment-enter flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-success)]/20 bg-[var(--color-success)]/[.06] px-3 py-2"
          >
            <CheckCircle2
              className="size-4 shrink-0 text-[var(--color-success)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--color-text)]">
                {adjustmentTitle(adjustment)}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                {adjustmentSource(adjustment)}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-danger)]">
              −{money(adjustment.actualAmount)}
            </span>
            {open && removable ? (
              <DButton
                size="icon"
                variant="ghost"
                aria-label={`${copy('Remove')} ${adjustmentTitle(adjustment)}`}
                disabled={!monetaryAvailable || workspace.isCoreMutating || promoBusy}
                onClick={() =>
                  adjustment.source === 'PROMOTION'
                    ? void clearPromoCode()
                    : workspace.clearOrderDiscount()
                }
              >
                <X className="size-3.5" />
              </DButton>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  const trigger = (
    <DButton
      size="sm"
      variant={placement === 'payment' ? 'outline' : 'primary'}
      disabled={preparing}
      loading={preparing}
      leftIcon={<BadgePercent className="size-4" />}
      onClick={() => void prepareAndOpen()}
    >
      {placement === 'payment'
        ? copy(appliedAdjustments.length ? 'Manage adjustments' : 'Add adjustment')
        : text('Discounts & promotions')}
    </DButton>
  );

  return (
    <>
      {placement === 'payment' ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">{copy('Promotions & discounts')}</p>
            {trigger}
          </div>
          <div className="mt-3">
            {appliedAdjustments.length ? (
              appliedList
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('No promotion or discount applied yet.')}
              </p>
            )}
          </div>
        </section>
      ) : (
        trigger
      )}

      {sale ? (
        <DDialog
          open={open}
          onClose={() => setOpen(false)}
          title={text('Discounts & promotions')}
          description={text('Manage transaction discounts and promo codes before payment.')}
          ariaLabel={text('Discounts & promotions')}
          className="w-full"
          footer={
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {copy('Total after adjustments')}
                </p>
                <p
                  key={`${sale.version}:${sale.totalAmount}`}
                  className="pos-value-updated text-base font-bold tabular-nums"
                >
                  {money(sale.totalAmount)}
                </p>
              </div>
              <DButton variant="ghost" onClick={() => setOpen(false)}>
                {copy('Close')}
              </DButton>
            </div>
          }
        >
          <div className="pos-dialog-stack">
            {disabledMessage ? <DAlert variant="neutral">{disabledMessage}</DAlert> : null}

            {appliedAdjustments.length ? (
              <section>
                <h3 className="mb-2 text-sm font-semibold">{copy('Applied adjustments')}</h3>
                {appliedList}
              </section>
            ) : null}

            {promotionsEnabled ? (
              <section>
                <h3 className="text-sm font-semibold">{text('Promo code')}</h3>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {text('Eligibility and the applied amount are validated by the server.')}
                </p>
                {sale.promotionCode ? (
                  <div className="pos-adjustment-enter mt-3 flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[.06] px-3 py-2.5">
                    <Tag className="size-4 shrink-0 text-[var(--color-brand)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold text-[var(--color-brand)]">
                        {sale.promotionCode}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {text('Code applied to this transaction')}
                      </p>
                    </div>
                    <DButton
                      size="sm"
                      variant="ghost"
                      disabled={!monetaryAvailable || promoBusy}
                      loading={promoBusy}
                      onClick={() => void clearPromoCode()}
                    >
                      {text('Remove promo code')}
                    </DButton>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <DInput
                          aria-label={text('Promo code')}
                          value={promoCode}
                          disabled={!monetaryAvailable || promoBusy}
                          onChange={(value) => {
                            setPromoCode(value.toUpperCase());
                            if (promoError) setPromoError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void applyPromoCode();
                          }}
                          placeholder="WELCOME10"
                          autoCapitalize="characters"
                          spellCheck={false}
                        />
                      </div>
                      <DButton
                        disabled={!monetaryAvailable || promoBusy || !promoCode.trim()}
                        loading={promoBusy}
                        leftIcon={<Tag className="size-3.5" />}
                        onClick={() => void applyPromoCode()}
                      >
                        {copy('Apply')}
                      </DButton>
                    </div>
                    {promoError ? (
                      <DAlert variant="danger" role="alert" className="mt-3">
                        <span className="font-semibold">
                          {text('Promotion could not be applied')}
                        </span>
                        <span className="block text-xs">{promoError}</span>
                      </DAlert>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold">{text('Manual transaction discount')}</h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {text('A reason is required and the server recalculates the final amount.')}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  variant="outline"
                  disabled={!canSaveDiscount}
                  loading={workspace.isCoreMutating}
                  onClick={saveOrderDiscount}
                >
                  {text(sale.orderDiscountType ? 'Update discount' : 'Apply discount')}
                </DButton>
              </div>
            </section>
          </div>
        </DDialog>
      ) : null}
    </>
  );
}
