import { DButton as Button, DDialog as Dialog } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { PaymentRoute, Sale } from '../model/cashier-transaction.types';
import {
  RefundDisbursementPicker,
  type RefundDisbursementDraft,
} from '../../adjustment/refund-disbursement-picker';
import { financialSummary } from '../../payment/sale-payment-status';
import { transactionNumber, isPositiveDecimal } from '../model/sale-display';

export function ReferenceCancelDialog({
  sale,
  reason,
  isMutating,
  onReasonChange,
  onClose,
  onConfirm,
  paymentRoutes,
  disbursement,
  onDisbursementChange,
}: {
  sale: Sale | null;
  reason: string;
  isMutating: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** The location's routes; a paid Sale returns its money through one of them. */
  paymentRoutes: readonly PaymentRoute[];
  disbursement: RefundDisbursementDraft | null;
  onDisbursementChange: (next: RefundDisbursementDraft) => void;
}) {
  const { copy, locale } = useOperationalLocalization();
  const refundAmount = sale ? financialSummary(sale).totalPaid : '0.0000';
  const hasRefund = isPositiveDecimal(refundAmount);
  return (
    <Dialog
      open={Boolean(sale)}
      title={copy('Cancel transaction')}
      description={sale ? transactionNumber(sale, locale) : ''}
      onClose={onClose}
      ariaLabel={copy('Cancel transaction')}
      closeOnEscape={!isMutating}
      closeOnOverlay={!isMutating}
      className="pos-reference-dialog w-full max-w-md rounded-t-2xl bg-(--color-surface) shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={isMutating} onClick={onClose}>
            {copy('Back')}
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim() || (hasRefund && !disbursement) || isMutating}
            loading={isMutating}
            onClick={onConfirm}
          >
            {copy('Confirm cancellation')}
          </Button>
        </div>
      }
    >
      <>
        {hasRefund ? (
          // Cancelling a paid transaction returns everything paid, manually, through an account the
          // operator chooses; the earlier payments stay recorded.
          <div className="mt-4 rounded-xl border border-(--color-warning)/30 bg-(--color-warning)/10 px-3 py-3">
            <RefundDisbursementPicker
              amount={refundAmount}
              routes={paymentRoutes}
              value={disbursement}
              onChange={onDisbursementChange}
              locale={locale}
              disabled={isMutating}
            />
            <p className="mt-2 text-xs text-(--color-text-muted)">
              {copy('Previous payment remains recorded')}
            </p>
          </div>
        ) : null}
        <label className="mt-5 block text-sm font-medium">
          {copy('Cancellation reason')}
          <DTextarea
            className="mt-1.5 h-10 rounded-lg"
            autoFocus
            value={reason}
            disabled={isMutating}
            onChange={onReasonChange}
            placeholder={copy('Example: Customer request')}
          />
        </label>
      </>
    </Dialog>
  );
}
