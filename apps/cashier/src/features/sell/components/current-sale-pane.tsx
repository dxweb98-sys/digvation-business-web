import { formatMoney } from '@digvation/pos-money';
import { DButton, DSkeleton } from '@digvation/ui';
import {
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  CircleAlert,
  Plus,
  ShoppingBag,
  UserRound,
} from 'lucide-react';

import type { SaleLine } from '../cashier-transaction.types';
import { actionBlockMessage, type SaleWorkspaceViewModel } from '../sale-workspace-view-model';
import { SaleLineRow } from './sale-line-row';

interface CurrentSalePaneProps {
  viewModel: SaleWorkspaceViewModel;
  locale: string;
  currency: string;
  isLoading?: boolean;
  onQuantityChange: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  onManageLine: (line: SaleLine) => void;
  onContinue: () => void;
  onNewSale: () => void;
  onOpenSales: () => void;
}

function workspaceMessage(viewModel: SaleWorkspaceViewModel): string | null {
  switch (viewModel.primaryMode) {
    case 'PAYMENT_PENDING_ATTENTION':
      return 'Payment is pending. Monetary changes are locked while safe operational work can continue.';
    case 'PAID_WORK_REMAINING':
      return 'Payment complete. Service work still needs attention before this Sale can finalize.';
    case 'READY_TO_FINALIZE':
      return 'Payment and operational requirements are ready for finalization.';
    case 'CONFLICT_REVIEW':
      return 'Review the latest backend Sale state before continuing.';
    case 'FINALIZED':
      return 'This Sale is finalized and immutable.';
    case 'VOIDED':
      return 'This Sale is voided and terminal.';
    case 'EMPTY':
    case 'OPEN_ACTIVE':
      return null;
  }
}

export function CurrentSalePane({
  viewModel,
  locale,
  currency,
  isLoading = false,
  onQuantityChange,
  onRemove,
  onManageLine,
  onContinue,
  onNewSale,
  onOpenSales,
}: CurrentSalePaneProps) {
  const sale = viewModel.sale;

  if (!sale) {
    if (isLoading) {
      return (
        <section
          aria-label="Current Sale"
          aria-busy="true"
          className="flex h-full min-h-0 flex-col rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]"
        >
          <DSkeleton className="h-3 w-20" />
          <DSkeleton className="mt-4 h-5 w-32" />
          <DSkeleton className="mt-6 h-14 w-full" />
          <div className="mt-4 flex-1 space-y-3 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)]/50 p-3">
            <DSkeleton className="h-20 w-full" />
            <DSkeleton className="h-20 w-full" />
          </div>
          <DSkeleton className="mt-4 h-10 w-full" />
        </section>
      );
    }

    return (
      <section
        aria-label="Current Sale"
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
      >
        <div className="border-b border-[var(--color-border)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            Cart
          </p>
          <h2 className="mt-1 text-base font-bold">New Sale</h2>
          <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-brand)]/15 bg-[var(--color-brand)]/5 px-3 py-2 text-xs">
            <UserRound className="size-3.5 shrink-0 text-[var(--color-brand)]" />
            <span className="font-semibold">Walk-in customer</span>
            <span className="text-[var(--color-text-muted)]">
              Customer attachment is not available.
            </span>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-5 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <ShoppingBag className="size-5" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Ready for a new Sale</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-muted)]">
            Choose an item. The Sale will be created only when the first item is actually added.
          </p>
        </div>
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney('0.0000', currency, locale)}</span>
          </div>
          <DButton variant="secondary" className="mt-3 w-full" onClick={onOpenSales}>
            <ArrowRightLeft className="mr-2 size-4" /> Open Sales
          </DButton>
        </div>
      </section>
    );
  }

  const disabledMessage =
    viewModel.monetaryMutation.state === 'DISABLED'
      ? actionBlockMessage(viewModel.monetaryMutation.reason)
      : null;
  const statusMessage = workspaceMessage(viewModel);
  const isTerminal = sale.status !== 'OPEN';

  return (
    <section
      aria-label="Current Sale"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
    >
      <div className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
              Cart
            </p>
            <h2 className="mt-1 truncate text-base font-bold">Current order</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {viewModel.activeLines.length} items Â· {sale.status}
            </p>
          </div>
          <DButton variant="ghost" onClick={onOpenSales} className="px-3" aria-label="Open Sales">
            <ArrowRightLeft className="size-4" />
          </DButton>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-brand)]/15 bg-[var(--color-brand)]/5 px-3 py-2 text-xs">
          <UserRound className="size-3.5 shrink-0 text-[var(--color-brand)]" />
          <span className="font-semibold">Walk-in customer</span>
          <span className="text-[var(--color-text-muted)]">
            Customer attachment is not available for this Sale.
          </span>
        </div>

        {statusMessage ? (
          <div
            className={`mt-4 flex gap-2 rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold ${
              viewModel.primaryMode === 'READY_TO_FINALIZE'
                ? 'bg-[var(--color-accent-mint)]/45'
                : viewModel.primaryMode === 'PAID_WORK_REMAINING'
                  ? 'bg-[var(--color-accent-sky)]/40'
                  : 'bg-[var(--color-accent-yellow)]/40'
            }`}
          >
            {viewModel.primaryMode === 'READY_TO_FINALIZE' ? (
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
        ) : null}

        {disabledMessage && !statusMessage ? (
          <div className="mt-4 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)]">
            {disabledMessage}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[var(--color-surface-muted)]/30 p-3">
        {viewModel.activeLines.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
            <ShoppingBag className="mx-auto size-5 text-[var(--color-text-muted)]" />
            <p className="mt-3 text-sm font-semibold">This OPEN Sale has no active lines</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              This can happen when Sale creation succeeded but the first line did not commit.
            </p>
          </div>
        ) : (
          viewModel.activeLines.map((line) => (
            <SaleLineRow
              key={line.id}
              line={line}
              locale={locale}
              availability={viewModel.monetaryMutation}
              onQuantityChange={onQuantityChange}
              onRemove={onRemove}
              onManage={onManageLine}
            />
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
            <dt>Gross</dt>
            <dd className="tabular-nums">{formatMoney(sale.grossAmount, sale.currency, locale)}</dd>
          </div>
          {sale.discountAmount !== '0.0000' ? (
            <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
              <dt>Discount</dt>
              <dd className="tabular-nums">
                âˆ’{formatMoney(sale.discountAmount, sale.currency, locale)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
            <dt>Tax</dt>
            <dd className="tabular-nums">{formatMoney(sale.taxAmount, sale.currency, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(sale.totalAmount, sale.currency, locale)}</dd>
          </div>
        </dl>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-2.5 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              Items
            </p>
            <p className="mt-1 text-xs font-bold tabular-nums">{viewModel.activeLines.length}</p>
          </div>
          <div className="border-x border-[var(--color-border)] px-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              Discount
            </p>
            <p className="mt-1 text-xs font-bold tabular-nums">
              {formatMoney(sale.discountAmount, sale.currency, locale)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              Tax
            </p>
            <p className="mt-1 text-xs font-bold tabular-nums">
              {formatMoney(sale.taxAmount, sale.currency, locale)}
            </p>
          </div>
        </div>

        <DButton className="mt-3 w-full" onClick={onContinue}>
          {isTerminal ? 'View Sale Completion' : 'Continue'}
          <ArrowRight className="ml-2 size-4" />
        </DButton>
        {!isTerminal ? (
          <DButton variant="secondary" className="mt-2 w-full" onClick={onNewSale}>
            <Plus className="mr-2 size-4" /> New Sale
          </DButton>
        ) : null}
      </div>
    </section>
  );
}
