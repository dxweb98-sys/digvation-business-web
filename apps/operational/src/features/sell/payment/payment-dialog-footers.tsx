import { DButton } from '@digvation-labs/ui';
import { ChevronRight } from 'lucide-react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';

/** Edit step: leave/cancel, then either continue to confirm the payment or hand the Sale over. */
export function PaymentEditFooter({
  onCancel,
  leavesPayment,
  collectsPayment,
  canPay,
  onPay,
  payAmountLabel,
  canQueue,
  isSubmitting,
  onQueue,
  instantOnly,
}: {
  onCancel: () => void;
  /** Money is recorded but the transaction is not settled, so cancelling leaves an open payment. */
  leavesPayment: boolean;
  collectsPayment: boolean;
  canPay: boolean;
  onPay: () => void;
  payAmountLabel: string;
  canQueue: boolean;
  isSubmitting: boolean;
  onQueue: () => void;
  instantOnly: boolean;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <DButton variant="ghost" className="h-12 px-3 text-sm" onClick={onCancel}>
        {copy(leavesPayment ? 'Leave payment' : 'Cancel')}
      </DButton>
      {collectsPayment ? (
        <DButton
          size="lg"
          disabled={!canPay}
          onClick={onPay}
          rightIcon={<ChevronRight className="size-4" aria-hidden="true" />}
          className="w-full justify-center whitespace-nowrap"
        >
          {copy('Pay')} {payAmountLabel}
        </DButton>
      ) : (
        <DButton
          size="lg"
          disabled={!canQueue}
          loading={isSubmitting}
          onClick={onQueue}
          className="w-full justify-center whitespace-nowrap"
        >
          {copy(instantOnly ? 'Complete transaction' : 'Add to queue')}
        </DButton>
      )}
    </div>
  );
}

/** Review step: go back to editing, or confirm the payment shown in the review. */
export function PaymentReviewFooter({
  canPay,
  isSubmitting,
  completes,
  onBack,
  onConfirm,
}: {
  canPay: boolean;
  isSubmitting: boolean;
  /** The confirmed payment settles the transaction. */
  completes: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
      <DButton variant="outline" disabled={isSubmitting} onClick={onBack}>
        {copy('Back to edit')}
      </DButton>
      <DButton disabled={!canPay && !isSubmitting} loading={isSubmitting} onClick={onConfirm}>
        {copy(completes ? 'Confirm and complete' : 'Confirm payment')}
      </DButton>
    </div>
  );
}

/** Leave step: queue the partly paid transaction to collect the rest later, or keep paying. */
export function PaymentLeaveFooter({
  hasPending,
  isSubmitting,
  onQueueWithBalance,
  onContinue,
}: {
  hasPending: boolean;
  isSubmitting: boolean;
  onQueueWithBalance: () => void;
  onContinue: () => void;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
      <DButton
        variant="outline"
        disabled={hasPending || isSubmitting}
        loading={isSubmitting}
        onClick={onQueueWithBalance}
      >
        {copy('Add to queue, collect later')}
      </DButton>
      <DButton onClick={onContinue}>{copy('Continue payment')}</DButton>
    </div>
  );
}
