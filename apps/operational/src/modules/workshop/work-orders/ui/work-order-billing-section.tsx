import { cn, DAlert, DButton, DSkeleton } from '@digvation/ui';
import { CircleCheck, Receipt, RefreshCw } from 'lucide-react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { useWorkOrderBilling } from '../model/use-work-order-billing';
import { BILLING_STATE_LABEL, canValidateBilling } from '../model/workshop-billing-model';
import { BillingBreakdown, BillingTotal } from './billing-amounts';
import { SectionMark } from './section-identity';
import { ValidateBillingDialog } from './validate-billing-dialog';

/**
 * Billing summary of one Work Order: a consequence of its items, anchored
 * directly beneath them. Read-only apart from the explicit validation, and
 * hidden completely without the sensitive billing permission. The validation
 * state sits in the heading; an action strip appears only when there is
 * something to do.
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
  const revalidation = billing?.validationState === 'REVALIDATION_REQUIRED';
  const validated = billing?.validationState === 'VALIDATED';

  return (
    <section
      aria-label={copy('Billing summary')}
      className="overflow-hidden rounded-2xl bg-(--color-text) text-white shadow-[0_2px_4px_rgba(16,24,40,0.12),0_8px_20px_-6px_rgba(16,24,40,0.3)]"
    >
      <div className="px-4 pb-3 pt-3.5">
        <div className="mb-3 flex min-h-9 items-center gap-3">
          <SectionMark icon={Receipt} tone="financial" />
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
            {copy('Billing summary')}
          </h3>
          {billing ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white',
                validated
                  ? 'bg-(--color-success)/35'
                  : revalidation
                    ? 'bg-(--color-warning)/40'
                    : 'bg-white/15',
              )}
            >
              {validated ? (
                <CircleCheck className="size-3.5" aria-hidden="true" />
              ) : revalidation ? (
                <RefreshCw className="size-3.5" aria-hidden="true" />
              ) : null}
              {copy(BILLING_STATE_LABEL[billing.validationState])}
            </span>
          ) : null}
        </div>

        {state.failed ? (
          <div>
            <DAlert variant="danger" title={copy('Could not load the billing summary.')} />
            <DButton variant="secondary" size="sm" className="mt-3" onClick={state.retry}>
              {copy('Retry')}
            </DButton>
          </div>
        ) : !billing ? (
          <div aria-busy="true">
            <DSkeleton className="h-20 w-full" />
          </div>
        ) : (
          <BillingBreakdown billing={billing} onInk />
        )}
      </div>

      {billing ? (
        <div className="border-t border-white/12 bg-black/25 px-4 py-3.5">
          <BillingTotal billing={billing} onInk />
          {mayValidate || revalidation ? (
            <div
              className={cn(
                'mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg px-3 py-2',
                revalidation ? 'bg-(--color-warning)/25' : 'bg-white/10',
              )}
            >
              {revalidation ? (
                <p className="min-w-0 flex-1 basis-48 text-[13px] leading-snug text-white/85">
                  {copy('Items or tax settings changed after the billing was last validated.')}
                </p>
              ) : (
                <span />
              )}
              {mayValidate ? (
                <DButton
                  variant={revalidation ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={state.openValidate}
                >
                  {revalidation ? copy('Revalidate billing') : copy('Validate billing')}
                </DButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
