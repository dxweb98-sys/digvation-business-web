import { ShoppingBag, X } from 'lucide-react';
import { useEffect } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { CartDisplayLine } from './cart-draft';
import type { SaleCustomer } from '../transaction/model/cashier-transaction.types';
import { money } from '../transaction/model/sale-display';
import { ReferenceCartPanel } from './reference-cart-panel';

export function ReferenceFloatingCart({
  open,
  onOpenChange,
  lines,
  total,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  isEstimate,
  isTaxPreviewLoading,
  isTaxPreviewUnavailable,
  locale,
  customer,
  memberNumber,
  pointBalance,
  isPointBalanceLoading,
  onChooseCustomer,
  onQuantity,
  onEdit,
  onRemove,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  lines: readonly CartDisplayLine[];
  total: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  isEstimate: boolean;
  isTaxPreviewLoading: boolean;
  isTaxPreviewUnavailable: boolean;
  locale: string;
  customer: SaleCustomer | null;
  memberNumber: string | null;
  pointBalance: string | null;
  isPointBalanceLoading: boolean;
  onChooseCustomer: () => void;
  onQuantity: (line: CartDisplayLine, quantity: string) => void;
  onEdit: (line: CartDisplayLine, options?: { addUnit?: boolean }) => void;
  onRemove: (line: CartDisplayLine) => void;
  onCheckout: () => void;
}) {
  const { copy } = useOperationalLocalization();
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      onOpenChange(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onOpenChange, open]);
  const panel = (
    <ReferenceCartPanel
      lines={lines}
      total={total}
      gross={gross}
      discountAmount={discountAmount}
      discountLabel={discountLabel}
      taxAmount={taxAmount}
      taxLabel={taxLabel}
      isEstimate={isEstimate}
      isTaxPreviewLoading={isTaxPreviewLoading}
      isTaxPreviewUnavailable={isTaxPreviewUnavailable}
      locale={locale}
      customer={customer}
      memberNumber={memberNumber}
      pointBalance={pointBalance}
      isPointBalanceLoading={isPointBalanceLoading}
      onChooseCustomer={onChooseCustomer}
      onQuantity={onQuantity}
      onEdit={onEdit}
      onRemove={onRemove}
      onCheckout={onCheckout}
    />
  );
  const countLabel = lines.length
    ? `${lines.length} ${copy('items selected')}`
    : copy('No items selected');
  return (
    <>
      <button
        type="button"
        aria-label={copy('Close active cart')}
        onClick={() => onOpenChange(false)}
        className={`operational-cart-backdrop fixed inset-0 z-40 bg-transparent ${open ? '' : 'pointer-events-none'}`}
      />
      <button
        type="button"
        aria-label={copy('Cart')}
        onClick={() => onOpenChange(!open)}
        className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-2xl bg-[var(--color-brand)] px-4 py-3 text-white shadow-[0_16px_40px_rgb(37_99_235_/_0.28)] transition-all hover:shadow-[0_18px_48px_rgb(37_99_235_/_0.35)] active:scale-[.97] ${open ? 'md:pointer-events-none md:scale-95 md:opacity-0' : ''}`}
      >
        <div className="relative">
          <ShoppingBag className="size-5" />
          {lines.length ? (
            <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[var(--color-brand)] shadow">
              {lines.length}
            </span>
          ) : null}
        </div>
        <div className="operational-cart-button-label text-left">
          <p className="text-xs font-bold leading-none">{copy('Cart')}</p>
          <p className="mt-1 text-[11px] opacity-90">{money(total, locale)}</p>
        </div>
      </button>
      <div
        role="dialog"
        aria-label={copy('Cart')}
        className={`operational-cart-panel fixed bottom-6 right-6 z-50 max-h-[calc(100dvh-48px)] w-[420px] max-w-[calc(100vw-48px)] origin-bottom-right flex-col overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_24px_70px_rgb(15_23_42_/_0.22)] transition-all duration-200 ease-out ${open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0'}`}
      >
        <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">{copy('Cart')}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{countLabel}</p>
            </div>
            <button
              type="button"
              aria-label={copy('Close')}
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        </div>
        {panel}
      </div>
      <div
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        role="dialog"
        aria-label={copy('Cart')}
        className={`fixed inset-x-0 bottom-0 z-50 h-[86dvh] overflow-hidden rounded-t-[28px] border-t border-[var(--color-border)] bg-[var(--color-background)] shadow-[0_-24px_80px_rgb(15_23_42_/_0.25)] transition-transform duration-300 ease-out md:hidden ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{copy('Cart')}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{countLabel}</p>
              </div>
              <button
                type="button"
                aria-label={copy('Close')}
                onClick={() => onOpenChange(false)}
                className="rounded-xl p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              >
                <X className="size-[18px]" />
              </button>
            </div>
          </div>
          {panel}
        </div>
      </div>
    </>
  );
}
