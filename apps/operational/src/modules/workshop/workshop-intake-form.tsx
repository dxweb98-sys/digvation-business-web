import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  cn,
  DAlert,
  DButton,
  DCombobox,
  DDialog,
  DInput,
  DTextarea,
  useToast,
  type SelectOption,
} from '@digvation/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import {
  WorkshopIntakeApi,
  type WorkshopCustomer,
  type WorkshopVehicle,
  type WorkshopWorkOrder,
} from './workshop-intake-api';

export function canCreateWorkshopCustomer(permissions: readonly string[]) {
  return permissions.includes('customers:manage');
}

/** Display only: +6281234567890 -> 0812 3456 7890. The stored value is unchanged. */
export function formatPhoneForDisplay(phoneE164: string): string {
  const local = phoneE164.startsWith('+62') ? `0${phoneE164.slice(3)}` : phoneE164;
  return local.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

function newIdempotencyKey(): string {
  return `workshop-work-order:${crypto.randomUUID()}`;
}

function apiErrorCode(error: unknown): string | undefined {
  const value = error as { code?: string; body?: { error?: { code?: string } } } | undefined;
  return value?.code ?? value?.body?.error?.code;
}

const ERROR_COPY: Record<string, string> = {
  WORKSHOP_CUSTOMER_NOT_FOUND: 'Customer was not found. Search again.',
  WORKSHOP_CUSTOMER_INACTIVE: 'This Customer is not active.',
  WORKSHOP_VEHICLE_NOT_FOUND: 'Vehicle was not found. Search again.',
  WORKSHOP_VEHICLE_CUSTOMER_MISMATCH: 'This Vehicle belongs to a different Customer.',
  WORKSHOP_VEHICLE_DUPLICATE_PLATE: 'A Vehicle with this plate number already exists.',
  WORKSHOP_VEHICLE_DUPLICATE_CHASSIS: 'A Vehicle with this chassis number already exists.',
  WORKSHOP_VEHICLE_DUPLICATE_ENGINE: 'A Vehicle with this engine number already exists.',
  WORKSHOP_VEHICLE_INPUT_INVALID: 'Check the Vehicle details and try again.',
  OPERATIONAL_LOCATION_ACCESS_DENIED: 'This Location is not available to you.',
  IDEMPOTENCY_KEY_REQUIRED: 'Could not submit. Try again.',
};

type IntakeStep = 1 | 2 | 3;

function StepIndicator({
  step,
  current,
  label,
  enabled,
  done,
  onSelect,
}: {
  step: IntakeStep;
  current: IntakeStep;
  label: string;
  enabled: boolean;
  done: boolean;
  onSelect: () => void;
}) {
  const active = current === step;

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onSelect}
      className={cn(
        'group flex min-w-0 items-center gap-2 text-left',
        enabled ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          active && 'border-(--color-brand) bg-(--color-brand) text-white',
          !active && done && 'border-(--color-success)/40 bg-(--color-success)/10 text-(--color-success)',
          !active &&
            !done &&
            'border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)',
        )}
      >
        {done && !active ? <Check className="h-4 w-4" aria-hidden="true" /> : step}
      </span>
      <span
        className={cn(
          'truncate text-sm font-medium',
          active ? 'text-(--color-brand)' : 'text-(--color-text-muted)',
          done && !active && 'text-(--color-text)',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function SelectedContext({
  label,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  label: string;
  title: string;
  detail?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-(--color-border) pb-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-(--color-text-muted)">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-(--color-text)">{title}</p>
        {detail ? <p className="mt-0.5 text-sm text-(--color-text-muted)">{detail}</p> : null}
      </div>
      <DButton variant="link" size="sm" className="shrink-0 px-0" onClick={onAction}>
        {actionLabel}
      </DButton>
    </div>
  );
}

export function WorkshopIntakeDialog({
  open,
  onClose,
  onOpenQueue,
}: {
  open: boolean;
  onClose: () => void;
  onOpenQueue?: () => void;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canCreateCustomer = canCreateWorkshopCustomer(session.access.permissions);

  const [step, setStep] = useState<IntakeStep>(1);
  const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
  const [customerOptions, setCustomerOptions] = useState<WorkshopCustomer[]>([]);
  const [isNewCustomer, setNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [selectedVehicle, setSelectedVehicle] = useState<WorkshopVehicle | null>(null);
  const [vehicleOptions, setVehicleOptions] = useState<WorkshopVehicle[]>([]);
  const [isNewVehicle, setNewVehicle] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');

  const [customerRequest, setCustomerRequest] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<WorkshopWorkOrder | null>(null);

  const api = useMemo(
    () =>
      new WorkshopIntakeApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          applicationSurface: 'operational',
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );

  function clearVehicle() {
    setSelectedVehicle(null);
    setVehicleOptions([]);
    setNewVehicle(false);
    setPlateNumber('');
    setChassisNumber('');
    setEngineNumber('');
  }

  function clearNewCustomer() {
    setNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  }

  function resetAll() {
    setStep(1);
    setSelectedCustomer(null);
    setCustomerOptions([]);
    clearNewCustomer();
    clearVehicle();
    setCustomerRequest('');
    setCreated(null);
    setIdempotencyKey(newIdempotencyKey());
    createWorkOrder.reset();
  }

  function closeDialog() {
    resetAll();
    onClose();
  }

  function changeCustomer() {
    setSelectedCustomer(null);
    clearVehicle();
    setCustomerRequest('');
    setStep(1);
  }

  function changeVehicle() {
    clearVehicle();
    setCustomerRequest('');
    setStep(2);
  }

  const createCustomer = useMutation({
    mutationFn: () => api.createCustomer({ name: newCustomerName, phone: newCustomerPhone }),
    onSuccess: (customer) => {
      setSelectedCustomer(customer);
      clearNewCustomer();
      clearVehicle();
      showToast({ variant: 'success', title: copy('Customer created.') });
      setStep(2);
    },
    onError: () => showToast({ variant: 'danger', title: copy('Could not create Customer.') }),
  });

  const creatingVehicle = isNewVehicle;
  const vehicleReady = creatingVehicle
    ? Boolean(plateNumber.trim() && chassisNumber.trim() && engineNumber.trim())
    : Boolean(selectedVehicle);

  const createWorkOrder = useMutation({
    mutationFn: () =>
      api.createWorkOrder(
        {
          sellingLocationId: selectedLocationId!,
          customerId: selectedCustomer!.id,
          customerRequest,
          ...(creatingVehicle
            ? { plateNumber, chassisNumber, engineNumber }
            : { vehicleId: selectedVehicle!.id }),
        },
        idempotencyKey,
      ),
    onSuccess: async (workOrder) => {
      setCreated(workOrder);
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['workshop-vehicles'] });
    },
  });

  const errorCode = createWorkOrder.isError ? apiErrorCode(createWorkOrder.error) : undefined;
  const errorMessage = createWorkOrder.isError
    ? copy(
        (errorCode ? ERROR_COPY[errorCode] : undefined) ??
          'Could not create Work Order. Try again.',
      )
    : undefined;

  const canAdvanceCustomer = Boolean(selectedCustomer);
  const canAdvanceVehicle = Boolean(selectedCustomer && vehicleReady);
  const canSubmit = Boolean(
    selectedLocationId && selectedCustomer && vehicleReady && customerRequest.trim(),
  );

  const footer = created ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onOpenQueue ? (
        <DButton variant="secondary" className="w-full sm:w-auto" onClick={onOpenQueue}>
          {copy('View queue')}
        </DButton>
      ) : (
        <DButton variant="secondary" className="w-full sm:w-auto" onClick={closeDialog}>
          {copy('Close')}
        </DButton>
      )}
      <DButton className="w-full sm:w-auto" onClick={resetAll}>
        {copy('Create another Work Order')}
      </DButton>
    </div>
  ) : (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <DButton
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={step === 1 ? closeDialog : () => setStep((step - 1) as IntakeStep)}
      >
        {step === 1 ? copy('Cancel') : copy('Back')}
      </DButton>

      {step === 1 ? (
        <DButton
          className="w-full sm:w-auto"
          disabled={!canAdvanceCustomer}
          onClick={() => setStep(2)}
        >
          {copy('Continue')}
        </DButton>
      ) : step === 2 ? (
        <DButton
          className="w-full sm:w-auto"
          disabled={!canAdvanceVehicle}
          onClick={() => setStep(3)}
        >
          {copy('Continue')}
        </DButton>
      ) : (
        <DButton
          className="w-full sm:w-auto"
          loading={createWorkOrder.isPending}
          disabled={!canSubmit}
          onClick={() => createWorkOrder.mutate()}
        >
          {copy('Create Work Order')}
        </DButton>
      )}
    </div>
  );

  return (
    <DDialog
      open={open}
      onClose={closeDialog}
      closeOnOverlay={false}
      size="lg"
      title={created ? copy('Work Order created') : copy('Create Work Order')}
      footer={footer}
    >
      {created ? (
        <div className="py-2 text-center" aria-live="polite">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-(--color-success)/10 text-(--color-success)">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm text-(--color-text-muted)">{copy('Work Order number')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-(--color-text)">
            {created.workOrderNumber}
          </p>
          <dl className="mx-auto mt-6 grid max-w-lg gap-4 border-t border-(--color-border) pt-4 text-left sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-(--color-text-muted)">{copy('Customer')}</dt>
              <dd className="mt-1 font-semibold text-(--color-text)">
                {created.customerNameSnapshot}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-(--color-text-muted)">{copy('Vehicle')}</dt>
              <dd className="mt-1 font-semibold tracking-wide text-(--color-text)">
                {created.vehiclePlateSnapshot}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2 border-b border-(--color-border) pb-5">
            <StepIndicator
              step={1}
              current={step}
              label={copy('Customer')}
              enabled
              done={Boolean(selectedCustomer)}
              onSelect={() => setStep(1)}
            />
            <StepIndicator
              step={2}
              current={step}
              label={copy('Vehicle')}
              enabled={Boolean(selectedCustomer)}
              done={vehicleReady}
              onSelect={() => {
                if (selectedCustomer) setStep(2);
              }}
            />
            <StepIndicator
              step={3}
              current={step}
              label={copy('Keluhan')}
              enabled={Boolean(selectedCustomer && vehicleReady)}
              done={Boolean(customerRequest.trim())}
              onSelect={() => {
                if (selectedCustomer && vehicleReady) setStep(3);
              }}
            />
          </div>

          {!selectedLocationId ? (
            <DAlert
              variant="warning"
              className="mt-5"
              title={copy('Select a Location to continue.')}
            />
          ) : null}

          {step === 1 ? (
            <section className="pt-6">
              <h3 className="text-xl font-semibold text-(--color-text)">
                {copy('Choose customer')}
              </h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">
                {copy('Search name or phone number')}
              </p>

              {selectedCustomer ? (
                <div className="mt-5">
                  <SelectedContext
                    label={copy('Customer')}
                    title={selectedCustomer.name}
                    detail={formatPhoneForDisplay(selectedCustomer.phoneE164)}
                    actionLabel={copy('Change')}
                    onAction={changeCustomer}
                  />
                </div>
              ) : isNewCustomer ? (
                <div className="mt-5 space-y-4">
                  <DInput
                    label={copy('Name')}
                    value={newCustomerName}
                    onChange={setNewCustomerName}
                  />
                  <DInput
                    label={copy('Phone number')}
                    type="tel"
                    value={newCustomerPhone}
                    onChange={setNewCustomerPhone}
                    placeholder="+628123456789"
                  />
                  <div className="flex justify-end gap-2">
                    <DButton variant="ghost" size="sm" onClick={clearNewCustomer}>
                      {copy('Cancel')}
                    </DButton>
                    <DButton
                      size="sm"
                      loading={createCustomer.isPending}
                      disabled={!newCustomerName.trim() || !newCustomerPhone.trim()}
                      onClick={() => createCustomer.mutate()}
                    >
                      {copy('Save customer')}
                    </DButton>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <DCombobox
                    ariaLabel={copy('Customer')}
                    placeholder={copy('Search name or phone number')}
                    value={null}
                    onChange={(value) => {
                      const customer = customerOptions.find((item) => item.id === value) ?? null;
                      setSelectedCustomer(customer);
                      clearVehicle();
                    }}
                    fetchOptions={async (search) => {
                      const page = await api.searchCustomers(search);
                      setCustomerOptions(page.items);
                      return page.items.map(
                        (customer): SelectOption => ({
                          value: customer.id,
                          label: `${customer.name} — ${formatPhoneForDisplay(customer.phoneE164)}`,
                        }),
                      );
                    }}
                  />

                  {canCreateCustomer ? (
                    <DButton
                      variant="link"
                      size="sm"
                      className="px-0"
                      onClick={() => setNewCustomer(true)}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {copy('New customer')}
                      </span>
                    </DButton>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="pt-6">
              <SelectedContext
                label={copy('Customer')}
                title={selectedCustomer!.name}
                detail={formatPhoneForDisplay(selectedCustomer!.phoneE164)}
                actionLabel={copy('Change')}
                onAction={changeCustomer}
              />

              <h3 className="mt-6 text-xl font-semibold text-(--color-text)">
                {copy('Vehicle')}
              </h3>

              {isNewVehicle ? (
                <div className="mt-5 space-y-4">
                  <DInput
                    label={copy('Plate number')}
                    value={plateNumber}
                    onChange={setPlateNumber}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DInput
                      label={copy('Chassis number')}
                      value={chassisNumber}
                      onChange={setChassisNumber}
                    />
                    <DInput
                      label={copy('Engine number')}
                      value={engineNumber}
                      onChange={setEngineNumber}
                    />
                  </div>
                  <DButton
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => {
                      setNewVehicle(false);
                      setPlateNumber('');
                      setChassisNumber('');
                      setEngineNumber('');
                    }}
                  >
                    {copy('Use a saved vehicle')}
                  </DButton>
                </div>
              ) : selectedVehicle ? (
                <div className="mt-5">
                  <SelectedContext
                    label={copy('Vehicle')}
                    title={selectedVehicle.plateNumber}
                    detail={`${copy('Chassis number')} ${selectedVehicle.chassisNumber} · ${copy('Engine number')} ${selectedVehicle.engineNumber}`}
                    actionLabel={copy('Change')}
                    onAction={changeVehicle}
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <DCombobox
                    ariaLabel={copy('Vehicle')}
                    placeholder={copy('Search plate, chassis, or engine number')}
                    value={null}
                    refetchKey={selectedCustomer!.id}
                    onChange={(value) => {
                      const vehicle = vehicleOptions.find((item) => item.id === value) ?? null;
                      setSelectedVehicle(vehicle);
                    }}
                    fetchOptions={async (search) => {
                      const page = await api.listVehicles(selectedCustomer!.id, search);
                      setVehicleOptions(page.items);
                      return page.items.map(
                        (vehicle): SelectOption => ({
                          value: vehicle.id,
                          label: `${vehicle.plateNumber} — ${vehicle.chassisNumber}`,
                        }),
                      );
                    }}
                  />

                  <DButton
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => {
                      setSelectedVehicle(null);
                      setNewVehicle(true);
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {copy('Add new vehicle')}
                    </span>
                  </DButton>
                </div>
              )}
            </section>
          ) : null}

          {step === 3 ? (
            <section className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectedContext
                  label={copy('Customer')}
                  title={selectedCustomer!.name}
                  detail={formatPhoneForDisplay(selectedCustomer!.phoneE164)}
                  actionLabel={copy('Change')}
                  onAction={changeCustomer}
                />
                <SelectedContext
                  label={copy('Vehicle')}
                  title={selectedVehicle?.plateNumber ?? plateNumber}
                  detail={
                    selectedVehicle
                      ? `${copy('Chassis number')} ${selectedVehicle.chassisNumber}`
                      : `${copy('Chassis number')} ${chassisNumber}`
                  }
                  actionLabel={copy('Change')}
                  onAction={changeVehicle}
                />
              </div>

              <h3 className="mt-6 text-xl font-semibold text-(--color-text)">
                {copy('What is the customer complaint?')}
              </h3>
              <DTextarea
                className="mt-4"
                aria-label={copy('Keluhan')}
                value={customerRequest}
                onChange={setCustomerRequest}
                placeholder={copy('For example, rem bunyi')}
              />

              {errorMessage ? <DAlert className="mt-4" variant="danger" title={errorMessage} /> : null}
            </section>
          ) : null}
        </div>
      )}
    </DDialog>
  );
}
