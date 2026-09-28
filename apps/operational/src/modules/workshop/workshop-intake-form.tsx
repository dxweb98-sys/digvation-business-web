import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  cn,
  DAlert,
  DAvatar,
  DButton,
  DDialog,
  DInfoNote,
  DInput,
  DRadio,
  DSkeleton,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DTextarea,
  useToast,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CarFront, Check, Search, UserRound } from 'lucide-react';
import { Fragment, useDeferredValue, useMemo, useState, type ReactNode } from 'react';

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
type CustomerMode = 'existing' | 'new';
type VehicleMode = 'existing' | 'new';

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
        'flex min-w-0 items-center gap-2 text-left outline-none',
        enabled ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
          active && 'border-(--color-brand) bg-(--color-brand) text-white',
          !active &&
            done &&
            'border-(--color-brand)/30 bg-(--color-brand)/10 text-(--color-brand)',
          !active &&
            !done &&
            'border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)',
        )}
      >
        {done && !active ? <Check className="size-4" aria-hidden="true" /> : step}
      </span>
      <span
        className={cn(
          'min-w-0 text-xs font-semibold leading-4 sm:text-sm',
          active ? 'text-(--color-brand)' : 'text-(--color-text-muted)',
          done && !active && 'text-(--color-text)',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function WorkflowStepper({
  step,
  selectedCustomer,
  vehicleReady,
  customerRequest,
  onStepChange,
  copy,
}: {
  step: IntakeStep;
  selectedCustomer: WorkshopCustomer | null;
  vehicleReady: boolean;
  customerRequest: string;
  onStepChange: (step: IntakeStep) => void;
  copy: (value: string) => string;
}) {
  const steps = [
    {
      step: 1 as const,
      label: copy('Customer'),
      enabled: true,
      done: Boolean(selectedCustomer),
    },
    {
      step: 2 as const,
      label: copy('Vehicle'),
      enabled: Boolean(selectedCustomer),
      done: vehicleReady,
    },
    {
      step: 3 as const,
      label: copy('Complaint & Summary'),
      enabled: Boolean(selectedCustomer && vehicleReady),
      done: Boolean(customerRequest.trim()),
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)_52px_minmax(0,1fr)] sm:gap-3">
      {steps.map((item, index) => (
        <Fragment key={item.step}>
          <StepIndicator
            step={item.step}
            current={step}
            label={item.label}
            enabled={item.enabled}
            done={item.done}
            onSelect={() => onStepChange(item.step)}
          />
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                'h-px w-full bg-(--color-border)',
                item.done && 'bg-(--color-brand)/30',
              )}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function CustomerChoiceRow({
  customer,
  selected,
  onSelect,
}: {
  customer: WorkshopCustomer;
  selected: boolean;
  onSelect: (customer: WorkshopCustomer) => void;
}) {
  const id = `workshop-customer-${customer.id}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/5 shadow-sm'
          : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/40 hover:bg-(--color-surface-muted)/40',
      )}
    >
      <DAvatar name={customer.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-(--color-text)">{customer.name}</p>
        <p className="mt-0.5 truncate text-sm text-(--color-text-muted)">
          {formatPhoneForDisplay(customer.phoneE164)}
        </p>
      </div>
      <DRadio
        id={id}
        name="workshop-customer"
        checked={selected}
        onChange={() => onSelect(customer)}
        className="size-5 shrink-0"
      />
    </label>
  );
}

function VehicleChoiceRow({
  vehicle,
  selected,
  onSelect,
  copy,
}: {
  vehicle: WorkshopVehicle;
  selected: boolean;
  onSelect: (vehicle: WorkshopVehicle) => void;
  copy: (value: string) => string;
}) {
  const id = `workshop-vehicle-${vehicle.id}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/5 shadow-sm'
          : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/40 hover:bg-(--color-surface-muted)/40',
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--color-surface-muted) text-(--color-text-muted)">
        <CarFront className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-wide text-(--color-text)">{vehicle.plateNumber}</p>
        <p className="mt-0.5 truncate text-xs text-(--color-text-muted)">
          {copy('Chassis number')} {vehicle.chassisNumber} · {copy('Engine number')} {vehicle.engineNumber}
        </p>
      </div>
      <DRadio
        id={id}
        name="workshop-vehicle"
        checked={selected}
        onChange={() => onSelect(vehicle)}
        className="size-5 shrink-0"
      />
    </label>
  );
}

function SelectionSummary({
  icon,
  label,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface-muted)/35 p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--color-surface) text-(--color-text-muted) shadow-sm">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--color-text-muted)">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-(--color-text)">{title}</p>
        {detail ? <p className="mt-0.5 truncate text-xs text-(--color-text-muted)">{detail}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <DButton variant="link" size="sm" className="shrink-0 px-0" onClick={onAction}>
          {actionLabel}
        </DButton>
      ) : null}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <DSkeleton count={4} height={66} rounded="lg" />
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
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [vehicleMode, setVehicleMode] = useState<VehicleMode>('existing');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<WorkshopVehicle | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');

  const [customerRequest, setCustomerRequest] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<WorkshopWorkOrder | null>(null);

  const deferredCustomerQuery = useDeferredValue(customerQuery);
  const deferredVehicleQuery = useDeferredValue(vehicleQuery);

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

  const customers = useQuery({
    queryKey: ['workshop-customers', 'intake', deferredCustomerQuery],
    enabled: open && !created && step === 1 && customerMode === 'existing',
    queryFn: () => api.searchCustomers(deferredCustomerQuery),
    staleTime: 15_000,
  });

  const vehicles = useQuery({
    queryKey: ['workshop-vehicles', selectedCustomer?.id, deferredVehicleQuery],
    enabled:
      open &&
      !created &&
      step === 2 &&
      vehicleMode === 'existing' &&
      Boolean(selectedCustomer),
    queryFn: () => api.listVehicles(selectedCustomer!.id, deferredVehicleQuery),
    staleTime: 15_000,
  });

  function clearVehicle() {
    setSelectedVehicle(null);
    setVehicleMode('existing');
    setVehicleQuery('');
    setPlateNumber('');
    setChassisNumber('');
    setEngineNumber('');
  }

  function clearNewCustomer() {
    setNewCustomerName('');
    setNewCustomerPhone('');
  }

  function resetAll() {
    setStep(1);
    setCustomerMode('existing');
    setCustomerQuery('');
    setSelectedCustomer(null);
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

  function selectCustomer(customer: WorkshopCustomer) {
    setSelectedCustomer(customer);
    clearVehicle();
    setCustomerRequest('');
  }

  function changeCustomer() {
    setSelectedCustomer(null);
    setCustomerMode('existing');
    setCustomerQuery('');
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
      setCustomerMode('existing');
      clearNewCustomer();
      clearVehicle();
      showToast({ variant: 'success', title: copy('Customer created.') });
      setStep(2);
    },
    onError: () => showToast({ variant: 'danger', title: copy('Could not create Customer.') }),
  });

  const creatingVehicle = vehicleMode === 'new';
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
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!canAdvanceCustomer}
          onClick={() => setStep(2)}
        >
          {copy('Continue to Vehicle')}
        </DButton>
      ) : step === 2 ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!canAdvanceVehicle}
          onClick={() => setStep(3)}
        >
          {copy('Continue to Complaint')}
        </DButton>
      ) : (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
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
      size="xl"
      title={
        <span className="text-xl font-bold tracking-tight">
          {created ? copy('Work Order created') : copy('Create Work Order')}
        </span>
      }
      footer={footer}
      noPadding
      overlayClassName="items-center p-3 sm:items-center sm:p-4"
      className="max-h-[94vh] rounded-2xl [&>div:first-child]:hidden sm:max-h-[88vh] sm:max-w-[860px] sm:rounded-2xl"
    >
      {created ? (
        <div className="px-5 py-7 text-center sm:px-7" aria-live="polite">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-(--color-success)/10 text-(--color-success)">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm text-(--color-text-muted)">{copy('Work Order number')}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-(--color-text)">
            {created.workOrderNumber}
          </p>
          <dl className="mx-auto mt-7 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted)/35 p-4">
              <dt className="text-xs font-semibold text-(--color-text-muted)">{copy('Customer')}</dt>
              <dd className="mt-1 font-semibold text-(--color-text)">
                {created.customerNameSnapshot}
              </dd>
            </div>
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted)/35 p-4">
              <dt className="text-xs font-semibold text-(--color-text-muted)">{copy('Vehicle')}</dt>
              <dd className="mt-1 font-semibold tracking-wide text-(--color-text)">
                {created.vehiclePlateSnapshot}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="flex min-h-[540px] flex-col">
          <div className="border-b border-(--color-border) bg-(--color-surface-muted)/20 px-5 py-4 sm:px-7">
            <WorkflowStepper
              step={step}
              selectedCustomer={selectedCustomer}
              vehicleReady={vehicleReady}
              customerRequest={customerRequest}
              copy={copy}
              onStepChange={(next) => {
                if (next === 1 || (next === 2 && selectedCustomer) || (next === 3 && canAdvanceVehicle)) {
                  setStep(next);
                }
              }}
            />
          </div>

          <div className="flex-1 px-5 py-5 sm:px-7 sm:py-6">
            {!selectedLocationId ? (
              <DAlert
                variant="warning"
                className="mb-5"
                title={copy('Select a Location to continue.')}
              />
            ) : null}

            {step === 1 ? (
              <section aria-labelledby="workshop-intake-customer-heading">
                <h3
                  id="workshop-intake-customer-heading"
                  className="text-2xl font-bold tracking-tight text-(--color-text)"
                >
                  {copy('Choose customer')}
                </h3>
                <p className="mt-1.5 text-sm text-(--color-text-muted)">
                  {copy('Find an existing customer or add a new customer.')}
                </p>

                <DTabs
                  className="mt-5"
                  value={customerMode}
                  defaultValue="existing"
                  onValueChange={(value) => {
                    const next = value as CustomerMode;
                    setCustomerMode(next);
                    if (next === 'new') {
                      setSelectedCustomer(null);
                      clearVehicle();
                      setCustomerRequest('');
                    }
                  }}
                >
                  <DTabsList
                    className={cn(
                      'grid w-full border border-(--color-border) bg-(--color-surface-muted)/45 p-1',
                      canCreateCustomer ? 'grid-cols-2' : 'grid-cols-1',
                    )}
                  >
                    <DTabsTrigger value="existing" className="w-full py-2.5 text-center">
                      {copy('Find customer')}
                    </DTabsTrigger>
                    {canCreateCustomer ? (
                      <DTabsTrigger value="new" className="w-full py-2.5 text-center">
                        {copy('New customer')}
                      </DTabsTrigger>
                    ) : null}
                  </DTabsList>

                  <DTabsContent value="existing" className="mt-4">
                    <DInput
                      type="search"
                      leftIcon={<Search className="size-4" aria-hidden="true" />}
                      value={customerQuery}
                      onChange={setCustomerQuery}
                      placeholder={copy('Search name or phone number')}
                      containerClassName="w-full"
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-(--color-text)">
                        {copy('Available customers')}
                      </p>
                    </div>

                    <div className="mt-2 max-h-[278px] overflow-y-auto pr-1">
                      {customers.isLoading ? (
                        <ResultsSkeleton />
                      ) : customers.isError ? (
                        <DAlert
                          variant="danger"
                          title={copy('Could not load customers.')}
                        />
                      ) : (customers.data?.items.length ?? 0) === 0 ? (
                        <DInfoNote variant="neutral">
                          {copy('No customers found. Try another search.')}
                        </DInfoNote>
                      ) : (
                        <div className="space-y-2">
                          {customers.data!.items.map((customer) => (
                            <CustomerChoiceRow
                              key={customer.id}
                              customer={customer}
                              selected={selectedCustomer?.id === customer.id}
                              onSelect={selectCustomer}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {canCreateCustomer ? (
                      <DInfoNote variant="info" className="mt-4">
                        {copy('Customer not found? Use the New customer tab to add one.')}
                      </DInfoNote>
                    ) : null}
                  </DTabsContent>

                  {canCreateCustomer ? (
                    <DTabsContent value="new" className="mt-4">
                      <div className="grid gap-4 rounded-xl border border-(--color-border) bg-(--color-surface-muted)/25 p-4 sm:grid-cols-2">
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
                        <div className="flex justify-end gap-2 sm:col-span-2">
                          <DButton
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              clearNewCustomer();
                              setCustomerMode('existing');
                            }}
                          >
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
                    </DTabsContent>
                  ) : null}
                </DTabs>
              </section>
            ) : null}

            {step === 2 && selectedCustomer ? (
              <section aria-labelledby="workshop-intake-vehicle-heading">
                <SelectionSummary
                  icon={<UserRound className="size-5" aria-hidden="true" />}
                  label={copy('Customer')}
                  title={selectedCustomer.name}
                  detail={formatPhoneForDisplay(selectedCustomer.phoneE164)}
                  actionLabel={copy('Change')}
                  onAction={changeCustomer}
                />

                <div className="mt-6">
                  <h3
                    id="workshop-intake-vehicle-heading"
                    className="text-2xl font-bold tracking-tight text-(--color-text)"
                  >
                    {copy('Choose vehicle')}
                  </h3>
                  <p className="mt-1.5 text-sm text-(--color-text-muted)">
                    {copy('Select a saved vehicle or add a new vehicle.')}
                  </p>
                </div>

                <DTabs
                  className="mt-5"
                  value={vehicleMode}
                  defaultValue="existing"
                  onValueChange={(value) => {
                    const next = value as VehicleMode;
                    setVehicleMode(next);
                    setSelectedVehicle(null);
                    setCustomerRequest('');
                  }}
                >
                  <DTabsList className="grid w-full grid-cols-2 border border-(--color-border) bg-(--color-surface-muted)/45 p-1">
                    <DTabsTrigger value="existing" className="w-full py-2.5 text-center">
                      {copy('Saved vehicles')}
                    </DTabsTrigger>
                    <DTabsTrigger value="new" className="w-full py-2.5 text-center">
                      {copy('New vehicle')}
                    </DTabsTrigger>
                  </DTabsList>

                  <DTabsContent value="existing" className="mt-4">
                    <DInput
                      type="search"
                      leftIcon={<Search className="size-4" aria-hidden="true" />}
                      value={vehicleQuery}
                      onChange={setVehicleQuery}
                      placeholder={copy('Search plate, chassis, or engine number')}
                      containerClassName="w-full"
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-(--color-text)">
                        {copy('Available vehicles')}
                      </p>
                    </div>

                    <div className="mt-2 max-h-[250px] overflow-y-auto pr-1">
                      {vehicles.isLoading ? (
                        <ResultsSkeleton />
                      ) : vehicles.isError ? (
                        <DAlert variant="danger" title={copy('Could not load vehicles.')} />
                      ) : (vehicles.data?.items.length ?? 0) === 0 ? (
                        <DInfoNote variant="neutral">
                          {copy('No saved vehicles found. Use the New vehicle tab to add one.')}
                        </DInfoNote>
                      ) : (
                        <div className="space-y-2">
                          {vehicles.data!.items.map((vehicle) => (
                            <VehicleChoiceRow
                              key={vehicle.id}
                              vehicle={vehicle}
                              selected={selectedVehicle?.id === vehicle.id}
                              onSelect={setSelectedVehicle}
                              copy={copy}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </DTabsContent>

                  <DTabsContent value="new" className="mt-4">
                    <div className="grid gap-4 rounded-xl border border-(--color-border) bg-(--color-surface-muted)/25 p-4 sm:grid-cols-2">
                      <DInput
                        label={copy('Plate number')}
                        value={plateNumber}
                        onChange={setPlateNumber}
                        containerClassName="sm:col-span-2"
                      />
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
                  </DTabsContent>
                </DTabs>
              </section>
            ) : null}

            {step === 3 && selectedCustomer ? (
              <section aria-labelledby="workshop-intake-summary-heading">
                <h3
                  id="workshop-intake-summary-heading"
                  className="text-2xl font-bold tracking-tight text-(--color-text)"
                >
                  {copy('Complaint & Summary')}
                </h3>
                <p className="mt-1.5 text-sm text-(--color-text-muted)">
                  {copy('Review the customer and vehicle, then record the complaint.')}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SelectionSummary
                    icon={<UserRound className="size-5" aria-hidden="true" />}
                    label={copy('Customer')}
                    title={selectedCustomer.name}
                    detail={formatPhoneForDisplay(selectedCustomer.phoneE164)}
                    actionLabel={copy('Change')}
                    onAction={changeCustomer}
                  />
                  <SelectionSummary
                    icon={<CarFront className="size-5" aria-hidden="true" />}
                    label={copy('Vehicle')}
                    title={selectedVehicle?.plateNumber ?? plateNumber}
                    detail={
                      selectedVehicle
                        ? copy('Chassis number') + ' ' + selectedVehicle.chassisNumber
                        : copy('Chassis number') + ' ' + chassisNumber
                    }
                    actionLabel={copy('Change')}
                    onAction={changeVehicle}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
                  <DTextarea
                    label={copy('Keluhan')}
                    value={customerRequest}
                    onChange={setCustomerRequest}
                    placeholder={copy('For example, rem bunyi')}
                    rows={5}
                  />
                </div>

                {errorMessage ? (
                  <DAlert className="mt-4" variant="danger" title={errorMessage} />
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      )}
    </DDialog>
  );
}
