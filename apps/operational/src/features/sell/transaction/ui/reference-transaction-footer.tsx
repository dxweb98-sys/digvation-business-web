import { DButton } from '@digvation-labs/ui';
import { CheckCircle2, Printer } from 'lucide-react';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { Sale } from '../model/cashier-transaction.types';

export type ReceiptPaper = '58' | '80';

/** Receipt-preview footer: paper width, close, optional delivery action and print. */
export function ReferenceReceiptFooter({
  sale,
  receiptPaper,
  onReceiptPaperChange,
  deliveryAvailable,
  receiptDeliveryLabel,
  onClose,
  onSendReceipt,
}: {
  sale: Sale;
  receiptPaper: ReceiptPaper;
  onReceiptPaperChange: (paper: ReceiptPaper) => void;
  deliveryAvailable: boolean;
  receiptDeliveryLabel: string;
  onClose: () => void;
  onSendReceipt?: ((sale: Sale) => void) | undefined;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span id="pos-receipt-paper-label" className="text-xs text-[var(--color-text-muted)]">
          {copy('Paper width')}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="pos-receipt-paper-label"
          className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
        >
          {(['58', '80'] as const).map((paper) => (
            <button
              key={paper}
              type="button"
              role="radio"
              aria-checked={receiptPaper === paper}
              onClick={() => onReceiptPaperChange(paper)}
              className={`min-h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30 ${
                receiptPaper === paper
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {paper} mm
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <DButton variant="ghost" onClick={onClose}>
          {copy('Close')}
        </DButton>
        {deliveryAvailable && onSendReceipt ? (
          <DButton variant="outline" onClick={() => onSendReceipt(sale)}>
            {receiptDeliveryLabel}
          </DButton>
        ) : null}
        <DButton
          variant="primary"
          leftIcon={<Printer className="size-3.5" />}
          onClick={() => window.print()}
        >
          {copy('Print')}
        </DButton>
      </div>
    </div>
  );
}

/** Transaction-detail footer: close, view receipt and the explicit Complete action. */
export function ReferenceDetailFooter({
  sale,
  receiptAvailable,
  canCompleteTransaction,
  completionBlocked,
  isMutating,
  onClose,
  onViewReceipt,
  onComplete,
}: {
  sale: Sale;
  receiptAvailable: boolean;
  /** The transaction is in progress, so the Complete action is offered. */
  canCompleteTransaction: boolean;
  /** Completion issues remain, so the Complete action is disabled. */
  completionBlocked: boolean;
  isMutating: boolean;
  onClose: () => void;
  onViewReceipt: (sale: Sale) => void;
  onComplete: () => void;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
      <DButton variant="ghost" className="justify-center" onClick={onClose}>
        {copy('Close')}
      </DButton>
      {receiptAvailable ? (
        <DButton
          rightIcon={<Printer className="size-3.5" />}
          variant="outline"
          className="justify-center"
          onClick={() => onViewReceipt(sale)}
        >
          {copy('View receipt')}
        </DButton>
      ) : null}
      {canCompleteTransaction ? (
        <DButton
          variant="primary"
          className="order-first col-span-2 justify-center sm:order-none"
          disabled={completionBlocked}
          loading={isMutating}
          leftIcon={<CheckCircle2 className="size-3.5" />}
          onClick={onComplete}
        >
          {copy('Complete transaction')}
        </DButton>
      ) : null}
    </div>
  );
}
