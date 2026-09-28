import { DAlert, DButton, DDialog } from '@digvation/ui';
import { ArrowRight, Check } from 'lucide-react';

import { useOperationalLocalization } from '../../../../../app/localization/operational-localization';
import { useCreateWorkOrder, type CreateStep } from '../../model/use-create-work-order';
import { CustomerStep } from './customer-step';
import { CreateStepper } from './create-stepper';
import { SummaryStep } from './summary-step';
import { VehicleStep } from './vehicle-step';

function ContinueLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </span>
  );
}

/** Centered Work Order intake dialog. Composition only: state lives in `useCreateWorkOrder`. */
export function CreateWorkOrderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const intake = useCreateWorkOrder({ open, onClose });
  const { step, created, selectedCustomer } = intake;

  const creatingCustomer = step === 1 && intake.customerMode === 'new';

  const footer = created ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <DButton variant="outline" className="w-full sm:w-auto" onClick={intake.closeDialog}>
        {copy('Close')}
      </DButton>
      <DButton className="w-full sm:w-auto" onClick={intake.resetAll}>
        {copy('Create another Work Order')}
      </DButton>
    </div>
  ) : (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <DButton
        variant="outline"
        className="w-full sm:w-auto"
        onClick={
          creatingCustomer
            ? intake.cancelNewCustomer
            : step === 1
              ? intake.closeDialog
              : () => intake.setStep((step - 1) as CreateStep)
        }
      >
        {step === 1 ? copy('Cancel') : copy('Back')}
      </DButton>

      {creatingCustomer ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          loading={intake.createCustomer.isPending}
          disabled={!intake.canSaveCustomer}
          onClick={() => intake.createCustomer.mutate()}
        >
          {copy('Save customer')}
        </DButton>
      ) : step === 1 ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!intake.canAdvanceCustomer}
          onClick={() => intake.setStep(2)}
        >
          <ContinueLabel label={copy('Continue to Vehicle')} />
        </DButton>
      ) : step === 2 ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!intake.canAdvanceVehicle}
          onClick={() => intake.setStep(3)}
        >
          <ContinueLabel label={copy('Continue to Complaint')} />
        </DButton>
      ) : (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          loading={intake.createWorkOrder.isPending}
          disabled={!intake.canSubmit}
          onClick={() => intake.createWorkOrder.mutate()}
        >
          {copy('Create Work Order')}
        </DButton>
      )}
    </div>
  );

  return (
    <DDialog
      open={open}
      onClose={intake.closeDialog}
      closeOnOverlay={false}
      size="md"
      ariaLabel={created ? copy('Work Order created') : copy('Create Work Order')}
      title={
        <span className="text-lg font-bold tracking-tight">
          {created ? copy('Work Order created') : copy('Create Work Order')}
        </span>
      }
      footer={footer}
      noPadding
      overlayClassName="items-center p-3 sm:items-center sm:p-4"
      className="max-h-[94vh] rounded-2xl [&>div:first-child]:hidden sm:max-h-[88vh] sm:max-w-[540px] sm:rounded-xl"
    >
      {created ? (
        <div className="px-5 py-7 text-center sm:px-6" aria-live="polite">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-(--color-success)/10 text-(--color-success)">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-(--color-text-muted)">{copy('Work Order number')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-(--color-text)">
            {created.workOrderNumber}
          </p>
          <dl className="mt-6 grid divide-y divide-(--color-border) border-y border-(--color-border) text-left sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="py-3 sm:pr-4">
              <dt className="text-xs font-medium text-(--color-text-muted)">{copy('Customer')}</dt>
              <dd className="mt-0.5 font-semibold text-(--color-text)">
                {created.customerNameSnapshot}
              </dd>
            </div>
            <div className="py-3 sm:pl-4">
              <dt className="text-xs font-medium text-(--color-text-muted)">{copy('Vehicle')}</dt>
              <dd className="mt-0.5 font-semibold tracking-wide text-(--color-text)">
                {created.vehiclePlateSnapshot}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="border-b border-(--color-border) px-5 py-2.5 sm:px-6">
            <CreateStepper intake={intake} copy={copy} />
          </div>

          <div className="px-5 py-4 sm:min-h-[512px] sm:px-6">
            {!intake.selectedLocationId ? (
              <DAlert
                variant="warning"
                className="mb-5"
                title={copy('Select a Location to continue.')}
              />
            ) : null}

            {step === 1 ? <CustomerStep intake={intake} copy={copy} /> : null}
            {step === 2 && selectedCustomer ? (
              <VehicleStep intake={intake} customer={selectedCustomer} copy={copy} />
            ) : null}
            {step === 3 && selectedCustomer ? (
              <SummaryStep intake={intake} customer={selectedCustomer} copy={copy} />
            ) : null}
          </div>
        </div>
      )}
    </DDialog>
  );
}
