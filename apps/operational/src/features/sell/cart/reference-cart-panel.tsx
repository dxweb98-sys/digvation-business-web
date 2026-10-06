import { createDecimal } from '@digvation/pos-money';
import { DBadge as Badge, DButton as Button } from '@digvation-labs/ui';
import {
  ChevronDown,
  CreditCard,
  Info,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from 'lucide-react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { CartDisplayLine } from './cart-draft';
import { lineDiscountPercentage } from '../transaction/model/sale-presentation';
import type { SaleCustomer } from '../transaction/model/cashier-transaction.types';
import { CartLineBreakdown } from './cart-line-breakdown';
import { money, quantity, isPositiveDecimal } from '../transaction/model/sale-display';
import { customerDisplayDetail, customerStatus } from '../customer/model/sale-customer-display';
import { pointQuantity } from '../transaction/model/sale-points';

export function ReferenceCartPanel({
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
  isCheckoutPreparing = false,
}: {
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
  /** The checkout destination is being prepared; the button stays busy until it opens. */
  isCheckoutPreparing?: boolean;
}) {
  const { copy } = useOperationalLocalization();
  const status = customerStatus(customer);
  const hasDiscount = !createDecimal(discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(taxAmount).equals(createDecimal('0'));
  const increment = (line: CartDisplayLine, direction: 'up' | 'down') => {
    const next =
      direction === 'up'
        ? createDecimal(line.quantity).plus(createDecimal('1'))
        : createDecimal(line.quantity).minus(createDecimal('1'));
    if (next.lessThan(createDecimal('1'))) return;
    // A local line that carries additions never gains a unit by copying: the new unit is
    // configured in the editor, so a required addition cannot be satisfied silently.
    if (direction === 'up' && line.editable && (line.additions?.length || line.units?.length)) {
      onEdit(line, { addUnit: true });
      return;
    }
    onQuantity(line, next.toFixed(4));
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
      <div className="shrink-0 space-y-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <button
          type="button"
          aria-label={copy('Choose customer')}
          onClick={onChooseCustomer}
          className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 px-3 py-2.5 text-left transition-colors hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand)]/5"
        >
          <div className="grid size-8 place-items-center rounded-xl bg-[var(--color-background)] text-[var(--color-text-muted)]">
            <User className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-semibold">
                {customer ? customer.name : copy('Choose customer')}
              </p>
              {status ? (
                <Badge variant={status.variant} className="shrink-0 px-2 py-0 text-[10px]">
                  {copy(status.label)}
                </Badge>
              ) : null}
              {customer?.type === 'MEMBER' && memberNumber ? (
                <Badge variant="outline" className="shrink-0 px-2 py-0 text-[10px]">
                  {memberNumber}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {customer?.type === 'MEMBER' && isPointBalanceLoading
                ? copy('Loading loyalty points…')
                : customer?.type === 'MEMBER' && pointBalance !== null
                  ? `${copy('Loyalty points')}: ${pointQuantity(pointBalance, locale)}`
                  : (customerDisplayDetail(customer) ??
                    copy('Name and WhatsApp number are both required.'))}
            </p>
          </div>
          <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
        </button>
      </div>
      <div
        className={`min-h-0 border-y border-[var(--color-border)] bg-[var(--color-surface-muted)]/20 ${lines.length ? 'flex-1 overflow-y-auto' : 'shrink-0'}`}
      >
        {lines.length ? (
          <div className="space-y-2 overflow-y-auto p-3">
            {lines.map((line) => {
              const discountPercentage = lineDiscountPercentage(line);
              return (
                <div
                  key={line.id}
                  className="pos-cart-line-enter rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {line.itemNameSnapshot}
                      </p>
                      <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {money(line.effectiveUnitPrice, locale)}
                        {line.variantNameSnapshot ? `, ${line.variantNameSnapshot}` : ''}
                        {line.promotion ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`${copy('Promotion')}: ${line.promotion.name}`}
                            title={[
                              line.promotion.name,
                              line.promotion.effectiveFrom
                                ? `${copy('Start')}: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(line.promotion.effectiveFrom))}`
                                : null,
                              line.promotion.effectiveUntil
                                ? `${copy('End')}: ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(line.promotion.effectiveUntil))}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                            className="ml-1 inline-flex size-4 align-text-bottom text-[var(--color-text-muted)]"
                          >
                            <Info className="size-3" />
                          </Button>
                        ) : null}
                        {line.itemTypeSnapshot === 'SERVICE' ? (
                          <span className="ml-1 font-semibold text-cyan-700">
                            {copy('Service')}
                          </span>
                        ) : null}
                      </div>
                      {line.soldByName ? (
                        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                          {copy('Sold by')} {line.soldByName}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {line.editable ? (
                        <button
                          type="button"
                          aria-label={`${copy('Edit item')} ${line.itemNameSnapshot}`}
                          onClick={() => onEdit(line)}
                          className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
                        onClick={() => onRemove(line)}
                        className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <CartLineBreakdown
                    line={line}
                    heading={copy('Additional items')}
                    baseLabel={copy('Item price')}
                    unitLabel={(index) => `${copy('Unit')} ${index}`}
                    format={(amount) => money(amount, locale)}
                    formatQuantity={quantity}
                    performedByLabel={copy('Performed by')}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-grid grid-cols-[36px_48px_36px] items-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] shadow-[inset_0_1px_0_rgb(15_23_42_/_0.02)]">
                      <button
                        type="button"
                        aria-label={`${copy('Decrease quantity')} ${line.itemNameSnapshot}`}
                        onClick={() => increment(line, 'down')}
                        disabled={createDecimal(line.quantity).lessThanOrEqualTo(
                          createDecimal('1'),
                        )}
                        className="flex h-9 items-center justify-center border-r border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <output
                        aria-label={`${copy('Quantity')} ${line.itemNameSnapshot}`}
                        className="flex h-9 w-12 items-center justify-center text-xs font-bold tabular-nums text-[var(--color-text)]"
                      >
                        {quantity(line.quantity)}
                      </output>
                      <button
                        type="button"
                        aria-label={`${copy('Increase quantity')} ${line.itemNameSnapshot}`}
                        onClick={() => increment(line, 'up')}
                        className="flex h-9 items-center justify-center border-l border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] active:bg-[var(--color-surface-muted)]"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-brand)]">
                      {money(line.totalAmount, locale)}
                    </p>
                  </div>
                  {isPositiveDecimal(line.lineDiscountAmount) ? (
                    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-[var(--color-text-muted)]">
                        {copy('Item discount')}
                        {discountPercentage ? ` (${discountPercentage}%)` : ''}
                      </span>
                      <span className="font-semibold text-[var(--color-danger)]">
                        −{money(line.lineDiscountAmount, locale)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <ShoppingBag className="size-[22px]" />
            </div>
            <p className="text-sm font-semibold">{copy('Cart is empty')}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Select products or services from the catalog.')}
            </p>
          </div>
        )}
      </div>
      <div className="shrink-0 bg-[var(--color-background)] p-4">
        <div className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">
              {copy(isEstimate ? 'Estimated subtotal' : 'Subtotal')}
            </span>
            <span className="font-medium">{money(gross, locale)}</span>
          </div>
          {hasDiscount ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">{discountLabel}</span>
              <span className="font-medium text-[var(--color-danger)]">
                −{money(discountAmount, locale)}
              </span>
            </div>
          ) : null}
          {hasTax || isTaxPreviewLoading || isTaxPreviewUnavailable ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
              <span className="font-medium">
                {isTaxPreviewLoading
                  ? copy('Calculating…')
                  : isTaxPreviewUnavailable
                    ? copy('Not available')
                    : money(taxAmount, locale)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
            <span className="text-sm font-bold">
              {copy(isEstimate ? 'Estimated total' : 'Total')}
            </span>
            <span
              key={total}
              className="pos-value-updated text-lg font-bold tabular-nums text-[var(--color-brand)]"
            >
              {money(total, locale)}
            </span>
          </div>
          {isEstimate && lines.length ? (
            <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
              {copy('Tax and promotions are finalized when the transaction is created.')}
            </p>
          ) : null}
          <Button
            fullWidth
            disabled={!lines.length}
            loading={isCheckoutPreparing}
            onClick={onCheckout}
            leftIcon={<CreditCard className="size-3.5" />}
          >
            {copy('Checkout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
