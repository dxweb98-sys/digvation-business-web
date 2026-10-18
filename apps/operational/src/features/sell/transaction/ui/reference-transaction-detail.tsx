import { createDecimal } from '@digvation/pos-money';
import { DDialog as Dialog } from '@digvation-labs/ui';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { appliedPaymentComposition, saleSettlement } from '../model/sale-presentation';
import { isCorrectionLeg } from '../model/payment-kind';
import type { Employee, Sale, SaleLine } from '../model/cashier-transaction.types';
import { receiptDeliveryPreviewLabel } from '../../receipt/receipt-delivery-dialog';
import { receiptDeliveryPhase } from '../../receipt/receipt-delivery';
import type { ReceiptDeliveryState } from '../api/operational-projection-client';
import { queueStatus } from '../../queue/queue-status';
import { workflowIssues, groupWorkflowIssues } from '../../queue/workflow-issues';
import { transactionNumber } from '../model/sale-display';
import { ReceiptContent } from '../../receipt/receipt-content';
import { ReferenceTransactionOrder } from './reference-transaction-order';
import {
  ReferenceCompletionIssues,
  ReferenceTransactionSummary,
} from './reference-transaction-summary';
import { ReferenceDetailFooter, ReferenceReceiptFooter } from './reference-transaction-footer';

function useRetainedValue<T>(value: T | null): T | null {
  // Keep the last value while a DS dialog plays its close transition.
  const [retained, setRetained] = useState<T | null>(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}

function useValueShownWhileOpen<T extends string | boolean | null | undefined>(
  open: boolean,
  value: T,
): T {
  // The parent clears what it derives from the shown Sale (receipt mode, branch, delivery) in the
  // same batch that closes the dialog. A closing dialog keeps what it showed while open, so its
  // exit never swaps the receipt for another view; the next opening shows the live values.
  const [shown, setShown] = useState<T>(value);
  if (open && value !== shown) setShown(value);
  return open ? value : shown;
}

function useOpeningKey(open: boolean): number {
  // A retained, closed DS dialog needs an extra effect pass to reopen; a fresh one is shown in the
  // same render as the state that opens it. Only an opening changes the key, never a close.
  const [openings, setOpenings] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenings(openings + 1);
  }
  return openings;
}

export const referenceTransactionDetailLayout = {
  dialog: 'pos-reference-transaction-dialog lg:!max-w-[1060px]',
  body: 'pos-transaction-detail-story',
  orderColumn: 'pos-transaction-detail-order',
  summaryColumn: 'pos-transaction-detail-summary',
} as const;

export const referenceTransactionDetailPresentation = {
  showTopTotal: false,
  showRightContext: true,
  emphasizePrimaryStatus: true,
} as const;

export function ReferenceTransactionDetail({
  sale: currentSale,
  locale,
  employees,
  businessName,
  branchName: currentBranchName,
  branchAddress: currentBranchAddress = null,
  cashierName,
  cancellationReason: currentCancellationReason,
  showPaymentReceipt: currentShowPaymentReceipt,
  onClose,
  onViewReceipt,
  onSendReceipt,
  deliveryStatus,
  onAssign,
  onStartLineWork,
  onComplete,
  isMutating,
  onCorrectPayment,
}: {
  sale: Sale | null;
  locale: string;
  employees: readonly Employee[];
  businessName: string;
  branchName: string;
  branchAddress?: string | null;
  cashierName: string;
  cancellationReason?: string;
  showPaymentReceipt: boolean;
  onClose: () => void;
  onNewSale: () => void;
  onViewReceipt: (sale: Sale) => void;
  /** Opens the shared receipt-delivery flow; the preview never sends on its own. */
  onSendReceipt?: (sale: Sale) => void;
  deliveryStatus?: {
    available: boolean;
    delivery: { status: ReceiptDeliveryState } | null;
  };
  onAssign: (line: SaleLine) => void;
  onStartLineWork: (line: SaleLine) => void;
  onComplete: () => void;
  isMutating: boolean;
  /** Opens the payment correction for this Sale; omitted when the session may not correct. */
  onCorrectPayment?: (sale: Sale) => void;
}) {
  const { copy, locale: copyLocale } = useOperationalLocalization();
  const [receiptPaper, setReceiptPaper] = useState<'58' | '80'>('80');
  const sale = useRetainedValue(currentSale);
  const openingKey = useOpeningKey(currentSale !== null);
  const showPaymentReceipt = useValueShownWhileOpen(
    currentSale !== null,
    currentShowPaymentReceipt,
  );
  const branchName = useValueShownWhileOpen(currentSale !== null, currentBranchName);
  const branchAddress = useValueShownWhileOpen(currentSale !== null, currentBranchAddress);
  const cancellationReason = useValueShownWhileOpen(
    currentSale !== null,
    currentCancellationReason,
  );
  const deliveryAvailable = useValueShownWhileOpen(
    currentSale !== null,
    deliveryStatus?.available ?? false,
  );
  const deliveryState = useValueShownWhileOpen(
    currentSale !== null,
    deliveryStatus?.delivery?.status,
  );
  if (!sale) return null;
  const open = currentSale !== null;
  const status = queueStatus(sale);
  const customer = sale.customer ?? null;
  const activeLines = sale.lines.filter((line) => !line.removedAt);
  const receiptAvailable = appliedPaymentComposition(sale).components.length > 0;
  const showReceipt = showPaymentReceipt && receiptAvailable;
  const settlement = saleSettlement(sale);
  const composition = appliedPaymentComposition(sale);
  const unappliedPayments = sale.payments
    // A correction leg is neither a payment nor an attempt: it has its own history.
    .filter((payment) => !composition.components.includes(payment) && !isCorrectionLeg(payment))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const hasDiscount = !createDecimal(sale.discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(sale.taxAmount).equals(createDecimal('0'));
  const completionIssues = status === 'PROGRESS' ? workflowIssues(sale, locale) : [];
  const completionIssueGroups = groupWorkflowIssues(sale, completionIssues, locale);
  const transactionDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(sale.finalizedAt ?? sale.updatedAt));
  const identity = transactionNumber(sale, locale);
  const receiptDeliveryLabel = receiptDeliveryPreviewLabel(
    receiptDeliveryPhase(deliveryState),
    copyLocale,
  );

  return (
    <>
      <Dialog
        key={openingKey}
        open={open}
        onClose={onClose}
        title={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        description={identity}
        ariaLabel={copy(showReceipt ? 'Preview receipt' : 'Transaction details')}
        closeOnEscape
        closeOnOverlay
        noPadding
        size="xl"
        className={`pos-reference-dialog ${referenceTransactionDetailLayout.dialog} w-full overflow-hidden`}
        footer={
          showReceipt ? (
            <ReferenceReceiptFooter
              sale={sale}
              receiptPaper={receiptPaper}
              onReceiptPaperChange={setReceiptPaper}
              deliveryAvailable={deliveryAvailable}
              receiptDeliveryLabel={receiptDeliveryLabel}
              onClose={onClose}
              onSendReceipt={onSendReceipt}
            />
          ) : (
            <ReferenceDetailFooter
              sale={sale}
              receiptAvailable={receiptAvailable}
              canCompleteTransaction={status === 'PROGRESS'}
              completionBlocked={completionIssues.length > 0}
              isMutating={isMutating}
              onClose={onClose}
              onViewReceipt={onViewReceipt}
              onComplete={onComplete}
            />
          )
        }
      >
        {showReceipt ? (
          // The receipt sits as paper on a muted desk; the dialog body is the only scroll region.
          <div className="pos-receipt-desk">
            <div
              className={`pos-receipt-preview pos-receipt-print--${receiptPaper} bg-white text-slate-950`}
            >
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                branchAddress={branchAddress}
                cashierName={cashierName}
                transactionDate={transactionDate}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>
          </div>
        ) : (
          <div className={referenceTransactionDetailLayout.body}>
            <div className="pos-detail-columns">
              <div className={`pos-detail-column ${referenceTransactionDetailLayout.orderColumn}`}>
                <ReferenceTransactionOrder
                  sale={sale}
                  activeLines={activeLines}
                  employees={employees}
                  locale={locale}
                  isMutating={isMutating}
                  onAssign={onAssign}
                  onStartLineWork={onStartLineWork}
                />
              </div>
              <div
                className={`pos-detail-column ${referenceTransactionDetailLayout.summaryColumn}`}
              >
                <ReferenceTransactionSummary
                  sale={sale}
                  locale={locale}
                  composition={composition}
                  unappliedPayments={unappliedPayments}
                  settlement={settlement}
                  hasDiscount={hasDiscount}
                  hasTax={hasTax}
                  transactionDate={transactionDate}
                  cancellationReason={cancellationReason}
                  showRightContext={referenceTransactionDetailPresentation.showRightContext}
                  onCorrectPayment={onCorrectPayment ? () => onCorrectPayment(sale) : undefined}
                />
                {completionIssues.length ? (
                  <ReferenceCompletionIssues groups={completionIssueGroups} />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {open && showReceipt
        ? createPortal(
            <div className={`pos-receipt-print pos-receipt-print--${receiptPaper}`}>
              <ReceiptContent
                sale={sale}
                activeLines={activeLines}
                customer={customer}
                locale={locale}
                businessName={businessName}
                branchName={branchName}
                branchAddress={branchAddress}
                cashierName={cashierName}
                transactionDate={transactionDate}
                hasDiscount={hasDiscount}
                hasTax={hasTax}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
