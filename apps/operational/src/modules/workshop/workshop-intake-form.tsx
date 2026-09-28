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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CarFront, Check, Search } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import {
  WorkshopIntakeApi,
  type WorkshopCustomer,
  type WorkshopVehicle,
  type WorkshopWorkOrder,
} from './workshop-intake-api';
import { normalizeIndonesianPhone } from './workshop-phone';

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

function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
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
type LookupMode = 'existing' | 'new';

/** Height of the scrollable result area; fixed so search never resizes the dialog. */
const RESULTS_HEIGHT = 'h-[192px]';

const modeTabClass =
  '-mb-px flex-none rounded-none border-0 border-b-2! border-transparent bg-transparent! px-4 py-2.5 shadow-none! aria-selected:border-(--color-brand)! aria-selected:text-(--color-brand)!';

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
      aria-current={active ? 'step' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-2 py-1.5 text-left outline-none focus-visible:underline',
        enabled ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors',
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
          'whitespace-nowrap text-[13px] font-medium leading-4',
          active ? 'text-(--color-brand)' : 'text-(--color-text)',
          !active && 'hidden sm:inline',
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
    <div className="flex items-center gap-3">
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
                'h-px min-w-3 flex-1 bg-(--color-border)',
                item.done && 'bg-(--color-brand)/30',
              )}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

/** One section heading for every step. */
function SectionHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 id={id} className="text-lg font-bold tracking-tight text-(--color-text)">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-[13px] text-(--color-text-muted)">{description}</p>
      ) : null}
    </div>
  );
}

/** The single mode switch used by both Customer and Vehicle. */
function ModeTabs({
  value,
  onValueChange,
  tabs,
  panels,
  className,
}: {
  value: LookupMode;
  onValueChange: (value: LookupMode) => void;
  tabs: { value: LookupMode; label: string }[];
  panels: Record<LookupMode, ReactNode>;
  className?: string;
}) {
  return (
    <DTabs
      className={className}
      value={value}
      defaultValue="existing"
      onValueChange={(next) => onValueChange(next as LookupMode)}
    >
      <DTabsList className="flex w-full gap-1 rounded-none border-b border-(--color-border) bg-transparent p-0">
        {tabs.map((tab) => (
          <DTabsTrigger key={tab.value} value={tab.value} className={modeTabClass}>
            {tab.label}
          </DTabsTrigger>
        ))}
      </DTabsList>
      {tabs.map((tab) => (
        <DTabsContent key={tab.value} value={tab.value} className="mt-4">
          {panels[tab.value]}
        </DTabsContent>
      ))}
    </DTabs>
  );
}

function ChoiceRow({
  id,
  name,
  leading,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  leading: ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 transition-colors',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/5'
          : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/40 hover:bg-(--color-surface-muted)/40',
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-(--color-text)">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-(--color-text-muted)">{subtitle}</p>
      </div>
      <DRadio
        id={id}
        name={name}
        checked={selected}
        onChange={onSelect}
        className="size-5 shrink-0"
      />
    </label>
  );
}

/**
 * Fixed-height result area shared by Customer and Vehicle lookup. The skeleton
 * only shows before the first result; later searches keep the previous rows
 * (dimmed) until the new ones arrive.
 */
function LookupResults<T>({
  items,
  isInitialLoading,
  isRefreshing,
  isError,
  errorText,
  emptyText,
  keyOf,
  renderRow,
}: {
  items: readonly T[] | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  errorText: string;
  emptyText: string;
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}) {
  return (
    <div
      className={cn(RESULTS_HEIGHT, 'overflow-y-auto')}
      aria-busy={isInitialLoading || isRefreshing}
    >
      {isInitialLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <DSkeleton count={4} height={56} rounded="lg" className="mb-2" />
        </div>
      ) : isError && !items ? (
        <DAlert variant="danger" title={errorText} />
      ) : (items?.length ?? 0) === 0 ? (
        <p className="grid h-full place-items-center px-6 text-center text-[13px] text-(--color-text-muted)">
          {emptyText}
        </p>
      ) : (
        <ul
          className={cn(
            'space-y-2 transition-opacity duration-150',
            isRefreshing && 'opacity-60',
          )}
        >
          {items!.map((item) => (
            <li key={keyOf(item)}>{renderRow(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lightweight supporting context: no card, only separators. */
function ContextList({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  return (
    <div
      className={cn(
        'divide-y divide-(--color-border) border-b border-(--color-border)',
        !flush && 'border-t',
      )}
    >
      {children}
    </div>
  );
}

function ContextLine({
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
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-(--color-text-muted)">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-(--color-text)">{title}</p>
        {detail ? (
          <p className="mt-0.5 truncate text-[13px] text-(--color-text-muted)">{detail}</p>
        ) : null}
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
  const [customerMode, setCustomerMode] = useState<LookupMode>('existing');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [vehicleMode, setVehicleMode] = useState<LookupMode>('existing');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<WorkshopVehicle | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');

  const [customerRequest, setCustomerRequest] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<WorkshopWorkOrder | null>(null);

  const debouncedCustomerQuery = useDebouncedValue(customerQuery.trim());
  const debouncedVehicleQuery = useDebouncedValue(vehicleQuery.trim());

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
    queryKey: ['workshop-customers', 'intake', debouncedCustomerQuery],
    enabled: open && !created && step === 1 && customerMode === 'existing',
    queryFn: () => api.searchCustomers(debouncedCustomerQuery),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const vehicleCustomerId = selectedCustomer?.id;
  const vehicles = useQuery({
    queryKey: ['workshop-vehicles', vehicleCustomerId, debouncedVehicleQuery],
    enabled: open && !created && step === 2 && vehicleMode === 'existing' && Boolean(vehicleCustomerId),
    queryFn: () => api.listVehicles(vehicleCustomerId!, debouncedVehicleQuery),
    staleTime: 15_000,
    // Keep previous rows only for the same Customer; never show another Customer's vehicles.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === vehicleCustomerId ? previous : undefined,
  });

  const customersRefreshing =
    customerQuery.trim() !== debouncedCustomerQuery || customers.isPlaceholderData;
  const vehiclesRefreshing =
    vehicleQuery.trim() !== debouncedVehicleQuery || vehicles.isPlaceholderData;

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
    setPhoneTouched(false);
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

  function changeCustomerMode(next: LookupMode) {
    setCustomerMode(next);
    if (next === 'new') {
      setSelectedCustomer(null);
      clearVehicle();
      setCustomerRequest('');
    }
  }

  function cancelNewCustomer() {
    clearNewCustomer();
    setCustomerMode('existing');
  }

  const normalizedNewPhone = normalizeIndonesianPhone(newCustomerPhone);
  const phoneInvalid = phoneTouched && newCustomerPhone.trim() !== '' && !normalizedNewPhone;
  const canSaveCustomer = Boolean(newCustomerName.trim() && normalizedNewPhone);

  const createCustomer = useMutation({
    mutationFn: () =>
      api.createCustomer({ name: newCustomerName.trim(), phone: normalizedNewPhone! }),
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

  const continueLabel = (label: string) => (
    <span className="inline-flex items-center gap-2">
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </span>
  );

  const creatingCustomer = step === 1 && customerMode === 'new';

  const footer = created ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {onOpenQueue ? (
        <DButton variant="outline" className="w-full sm:w-auto" onClick={onOpenQueue}>
          {copy('View queue')}
        </DButton>
      ) : (
        <DButton variant="outline" className="w-full sm:w-auto" onClick={closeDialog}>
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
        variant="outline"
        className="w-full sm:w-auto"
        onClick={
          creatingCustomer
            ? cancelNewCustomer
            : step === 1
              ? closeDialog
              : () => setStep((step - 1) as IntakeStep)
        }
      >
        {step === 1 ? copy('Cancel') : copy('Back')}
      </DButton>

      {creatingCustomer ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          loading={createCustomer.isPending}
          disabled={!canSaveCustomer}
          onClick={() => createCustomer.mutate()}
        >
          {copy('Save customer')}
        </DButton>
      ) : step === 1 ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!canAdvanceCustomer}
          onClick={() => setStep(2)}
        >
          {continueLabel(copy('Continue to Vehicle'))}
        </DButton>
      ) : step === 2 ? (
        <DButton
          className="w-full sm:w-auto sm:min-w-44"
          disabled={!canAdvanceVehicle}
          onClick={() => setStep(3)}
        >
          {continueLabel(copy('Continue to Complaint'))}
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
      size="md"
      ariaLabel={created ? copy('Work Order created') : copy('Create Intake')}
      title={
        <span className="text-lg font-bold tracking-tight">
          {created ? copy('Work Order created') : copy('Create Intake')}
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

          <div className="px-5 py-4 sm:min-h-[512px] sm:px-6">
            {!selectedLocationId ? (
              <DAlert
                variant="warning"
                className="mb-5"
                title={copy('Select a Location to continue.')}
              />
            ) : null}

            {step === 1 ? (
              <section aria-labelledby="workshop-intake-customer-heading">
                <SectionHeader
                  id="workshop-intake-customer-heading"
                  title={copy('Choose customer')}
                  description={copy('Find an existing customer or add a new customer.')}
                />

                <ModeTabs
                  className="mt-4"
                  value={customerMode}
                  onValueChange={changeCustomerMode}
                  tabs={[
                    { value: 'existing', label: copy('Find customer') },
                    ...(canCreateCustomer
                      ? [{ value: 'new' as const, label: copy('New customer') }]
                      : []),
                  ]}
                  panels={{
                    existing: (
                      <div>
                        <DInput
                          type="search"
                          aria-label={copy('Find customer')}
                          leftIcon={<Search className="size-4" aria-hidden="true" />}
                          value={customerQuery}
                          onChange={setCustomerQuery}
                          placeholder={copy('Customer name or phone number...')}
                          loading={customersRefreshing && customers.isFetching}
                          containerClassName="w-full"
                        />

                        <div className="mt-4 flex min-h-5 items-center justify-between gap-3">
                          <p className="text-[13px] font-semibold text-(--color-text)">
                            {copy('Available customers')}
                          </p>
                          {customerQuery ? (
                            <button
                              type="button"
                              onClick={() => setCustomerQuery('')}
                              className="inline-flex items-center gap-1 text-[13px] font-medium text-(--color-brand) outline-none hover:underline focus-visible:underline"
                            >
                              {copy('View all')}
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-2">
                          <LookupResults
                            items={customers.data?.items}
                            isInitialLoading={customers.isLoading}
                            isRefreshing={customersRefreshing}
                            isError={customers.isError}
                            errorText={copy('Could not load customers.')}
                            emptyText={copy('No customers found. Try another search.')}
                            keyOf={(customer) => customer.id}
                            renderRow={(customer) => (
                              <ChoiceRow
                                id={`workshop-customer-${customer.id}`}
                                name="workshop-customer"
                                leading={<DAvatar name={customer.name} size="md" />}
                                title={customer.name}
                                subtitle={formatPhoneForDisplay(customer.phoneE164)}
                                selected={selectedCustomer?.id === customer.id}
                                onSelect={() => selectCustomer(customer)}
                              />
                            )}
                          />
                        </div>

                        {canCreateCustomer ? (
                          <DInfoNote variant="info" className="mt-4 rounded-lg border-transparent px-3 py-2.5">
                            {copy('Customer not found? Use the New customer tab to add one.')}
                          </DInfoNote>
                        ) : null}
                      </div>
                    ),
                    new: (
                      <div className="space-y-4">
                        <DInput
                          label={copy('Name')}
                          value={newCustomerName}
                          onChange={setNewCustomerName}
                          placeholder={copy('Example: Budi Santoso')}
                          autoComplete="off"
                        />
                        <DInput
                          label={copy('Phone number')}
                          type="tel"
                          inputMode="tel"
                          value={newCustomerPhone}
                          onChange={setNewCustomerPhone}
                          onBlur={() => setPhoneTouched(true)}
                          placeholder="0812 3456 7890"
                          error={phoneInvalid ? copy('Enter a valid phone number') : undefined}
                          autoComplete="off"
                        />
                      </div>
                    ),
                  }}
                />
              </section>
            ) : null}

            {step === 2 && selectedCustomer ? (
              <section aria-labelledby="workshop-intake-vehicle-heading">
                <ContextList flush>
                  <ContextLine
                    label={copy('Customer')}
                    title={selectedCustomer.name}
                    detail={formatPhoneForDisplay(selectedCustomer.phoneE164)}
                    actionLabel={copy('Change')}
                    onAction={changeCustomer}
                  />
                </ContextList>

                <div className="mt-5">
                  <SectionHeader
                    id="workshop-intake-vehicle-heading"
                    title={copy('Choose vehicle')}
                    description={copy('Select a saved vehicle or add a new vehicle.')}
                  />
                </div>

                <ModeTabs
                  className="mt-4"
                  value={vehicleMode}
                  onValueChange={(next) => {
                    setVehicleMode(next);
                    setSelectedVehicle(null);
                    setCustomerRequest('');
                  }}
                  tabs={[
                    { value: 'existing', label: copy('Saved vehicles') },
                    { value: 'new', label: copy('New vehicle') },
                  ]}
                  panels={{
                    existing: (
                      <div>
                        <DInput
                          type="search"
                          aria-label={copy('Saved vehicles')}
                          leftIcon={<Search className="size-4" aria-hidden="true" />}
                          value={vehicleQuery}
                          onChange={setVehicleQuery}
                          placeholder={copy('Search plate, chassis, or engine number')}
                          loading={vehiclesRefreshing && vehicles.isFetching}
                          containerClassName="w-full"
                        />

                        <div className="mt-3">
                          <LookupResults
                            items={vehicles.data?.items}
                            isInitialLoading={vehicles.isLoading}
                            isRefreshing={vehiclesRefreshing}
                            isError={vehicles.isError}
                            errorText={copy('Could not load vehicles.')}
                            emptyText={copy('No saved vehicles found. Use the New vehicle tab to add one.')}
                            keyOf={(vehicle) => vehicle.id}
                            renderRow={(vehicle) => (
                              <ChoiceRow
                                id={`workshop-vehicle-${vehicle.id}`}
                                name="workshop-vehicle"
                                leading={
                                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--color-surface-muted) text-(--color-text-muted)">
                                    <CarFront className="size-5" aria-hidden="true" />
                                  </span>
                                }
                                title={vehicle.plateNumber}
                                subtitle={`${copy('Chassis number')} ${vehicle.chassisNumber} · ${copy('Engine number')} ${vehicle.engineNumber}`}
                                selected={selectedVehicle?.id === vehicle.id}
                                onSelect={() => setSelectedVehicle(vehicle)}
                              />
                            )}
                          />
                        </div>
                      </div>
                    ),
                    new: (
                      <div className="space-y-4">
                        <DInput
                          label={copy('Plate number')}
                          value={plateNumber}
                          onChange={setPlateNumber}
                          placeholder="B 1234 ABC"
                          autoComplete="off"
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <DInput
                            label={copy('Chassis number')}
                            value={chassisNumber}
                            onChange={setChassisNumber}
                            placeholder={copy('Enter chassis number')}
                            autoComplete="off"
                          />
                          <DInput
                            label={copy('Engine number')}
                            value={engineNumber}
                            onChange={setEngineNumber}
                            placeholder={copy('Enter engine number')}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    ),
                  }}
                />
              </section>
            ) : null}

            {step === 3 && selectedCustomer ? (
              <section aria-labelledby="workshop-intake-summary-heading">
                <SectionHeader
                  id="workshop-intake-summary-heading"
                  title={copy('Complaint & Summary')}
                  description={copy('Review the customer and vehicle, then record the complaint.')}
                />

                <div className="mt-4">
                  <ContextList>
                    <ContextLine
                      label={copy('Customer')}
                      title={selectedCustomer.name}
                      detail={formatPhoneForDisplay(selectedCustomer.phoneE164)}
                      actionLabel={copy('Change')}
                      onAction={changeCustomer}
                    />
                    <ContextLine
                      label={copy('Vehicle')}
                      title={selectedVehicle?.plateNumber ?? plateNumber}
                      detail={`${copy('Chassis number')} ${selectedVehicle?.chassisNumber ?? chassisNumber}`}
                      actionLabel={copy('Change')}
                      onAction={changeVehicle}
                    />
                  </ContextList>
                </div>

                <div className="mt-5">
                  <DTextarea
                    label={copy('Keluhan')}
                    value={customerRequest}
                    onChange={setCustomerRequest}
                    placeholder={copy('For example, rem bunyi')}
                    rows={6}
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
