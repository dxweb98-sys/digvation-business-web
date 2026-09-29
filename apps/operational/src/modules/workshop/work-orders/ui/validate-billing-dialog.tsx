import { DButton, DDialog } from '@digvation/ui';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopBilling } from '../api/workshop-billing-api';
import { BillingAmounts } from './billing-amounts';

/**
 * Explicit confirmation before a billing is validated. The amounts shown are
 * the ones the operator reviewed; they are a preview, not authority: Runtime
 * recomputes on submit and rejects the request if anything moved meanwhile.
 */
export function ValidateBillingDialog({
  open,
  billing,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  billing: WorkshopBilling;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const revalidating = billing.validationState === 'REVALIDATION_REQUIRED';
  const action = revalidating ? copy('Revalidate billing') : copy('Validate billing');
  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={action}
      title={<span className="text-lg font-bold tracking-tight">{action}</span>}
      description={copy('Make sure the Work Order items and billing amounts are correct.')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="outline" onClick={onClose} disabled={pending}>
            {copy('Cancel')}
          </DButton>
          <DButton loading={pending} onClick={onConfirm}>
            {action}
          </DButton>
        </div>
      }
    >
      <BillingAmounts billing={billing} />
    </DDialog>
  );
}
