import { DAlert, DBadge, DButton, DSkeleton } from '@digvation/ui';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopBilling } from '../api/workshop-billing-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { useWorkOrderBilling } from '../model/use-work-order-billing';
import {
  BILLING_STATE_BADGE,
  BILLING_STATE_LABEL,
  canValidateBilling,
} from '../model/workshop-billing-model';
import { BillingAmounts } from './billing-amounts';
import { ValidateBillingDialog } from './validate-billing-dialog';

/**
 * Billing summary of one Work Order: a consequence of its items, never a
 * separate page. Read-only apart from the explicit validation, and hidden
 * completely without the sensitive billing permission.
 */
export function WorkOrderBillingSection({
  workOrder,
  permissions,
}: {
  workOrder: WorkshopQueueWorkOrder;
  permissions: readonly string[];
}) {
  const { copy } = useOperationalLocalization();
  const state = useWorkOrderBilling({ workOrder, permissions });
  const { billing } = state;

  // Nothing to show without permission, or before the Work Order has items.
  if (!state.readable || (!state.loading && !state.failed && !billing)) return null;

  const mayValidate =
    billing !== null &&
    billing.validationState !== 'VALIDATED' &&
    canValidateBilling(workOrder.workStatus, permissions);

  return (
    <section aria-label={copy('Billing summary')} className="space-y-2">
      <h3 className="text-[11px] font-semibold text-(--color-text-muted)">
        {copy('Billing summary')}
      </h3>

      {state.failed ? (
        <div>
          <DAlert variant="danger" title={copy('Could not load the billing summary.')} />
          <DButton variant="secondary" size="sm" className="mt-3" onClick={state.retry}>
            {copy('Retry')}
          </DButton>
        </div>
      ) : !billing ? (
        <div aria-busy="true">
          <DSkeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-(--color-border) px-3.5 py-3">
          <BillingAmounts billing={billing} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DBadge variant={BILLING_STATE_BADGE[billing.validationState]}>
              {copy(BILLING_STATE_LABEL[billing.validationState])}
            </DBadge>
            {mayValidate ? (
              <DButton variant="secondary" size="sm" onClick={state.openValidate}>
                {billing.validationState === 'REVALIDATION_REQUIRED'
                  ? copy('Revalidate billing')
                  : copy('Validate billing')}
              </DButton>
            ) : null}
          </div>
          {billing.validationState === 'REVALIDATION_REQUIRED' ? (
            <p className="text-[13px] leading-snug text-(--color-text-muted)">
              {copy('Items or tax settings changed after the billing was last validated.')}
            </p>
          ) : null}
        </div>
      )}

      {billing && mayValidate ? (
        <ValidateBillingDialog
          open={state.validateOpen}
          billing={billing}
          pending={state.validatePending}
          onClose={state.closeValidate}
          onConfirm={() => state.validate(billing.version)}
        />
      ) : null}
    </section>
  );
}
