import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  cn,
  DAlert,
  DButton,
  DCombobox,
  DInput,
  DSkeleton,
  DTextarea,
  useToast,
  type SelectOption,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

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

type StepState = 'active' | 'done' | 'locked';

/**
 * One step of the intake desk. Hierarchy comes from type and dividers, not
 * boxes: the active step is open, a completed step shrinks to its label plus
 * the chosen value, a locked step is a quiet label.
 */
function Step({
  number,
  title,
  state,
  action,
  hint,
  first,
  contentRef,
  children,
}: {
  number: string;
  title: string;
  state: StepState;
  action?: ReactNode;
  hint?: string;
  first?: boolean;
  contentRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}) {
  return (
    <section
      data-step-state={state}
      className={cn(!first && 'mt-5 border-t border-(--color-border) pt-5')}
    >
      <div className="flex min-h-8 items-center gap-2.5">
        {state === 'done' ? (
          <Check className="h-4 w-4 shrink-0 text-(--color-success)" aria-hidden="true" />
        ) : (
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              state === 'active' ? 'text-(--color-brand)' : 'text-(--color-text-muted)',
            )}
          >
            {number}
          </span>
        )}
        <h3
          className={cn(
            state === 'active' && 'text-base font-semibold text-(--color-text)',
            state === 'done' && 'text-sm font-medium text-(--color-text-muted)',
            state === 'locked' && 'text-base font-medium text-(--color-text-muted)/70',
          )}
        >
          {title}
        </h3>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {state === 'locked' && hint ? (
        <p className="mt-1 text-sm text-(--color-text-muted)/70">{hint}</p>
      ) : null}
      {children ? (
        <div ref={contentRef} className="mt-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Moves attention to the step that just became active. A search combobox is
 * deliberately not focused: it opens its option list on focus, which would
 * cover the step's own actions.
 */
function focusFirstField(ref: RefObject<HTMLDivElement | null>) {
  window.setTimeout(() => {
    const field = ref.current?.querySelector<HTMLElement>('input, textarea');
    if (field && field.getAttribute('role') !== 'combobox') field.focus();
  }, 0);
}

/**
 * The Penerimaan desk: one working surface on the page (no dialog). The
 * Customer's saved vehicles are listed directly, so the common case needs
 * one tap per step.
 */
export function WorkshopIntakeForm({
  onCreatedChange,
  onOpenQueue,
}: {
  /** Reports the created Work Order id (or null when a new one starts). */
  onCreatedChange?: (workOrderId: string | null) => void;
  /** Present only when the user may read the Workshop queue. */
  onOpenQueue?: () => void;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canCreateCustomer = canCreateWorkshopCustomer(session.access.permissions);

  const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
  const [customerOptions, setCustomerOptions] = useState<WorkshopCustomer[]>([]);
  const [isNewCustomer, setNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [selectedVehicle, setSelectedVehicle] = useState<WorkshopVehicle | null>(null);
  const [isNewVehicle, setNewVehicle] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');

  const [customerRequest, setCustomerRequest] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<WorkshopWorkOrder | null>(null);

  const customerStepRef = useRef<HTMLDivElement>(null);
  const vehicleStepRef = useRef<HTMLDivElement>(null);
  const complaintStepRef = useRef<HTMLDivElement>(null);

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

  // The selected Customer's own vehicles (Runtime scopes them to that Customer).
  const customerId = selectedCustomer?.id;
  const savedVehicles = useQuery({
    queryKey: ['workshop-vehicles', customerId],
    enabled: Boolean(customerId),
    queryFn: () => api.listVehicles(customerId!),
  });
  const vehicles = savedVehicles.data?.items ?? [];
  const noSavedVehicles = savedVehicles.isSuccess && vehicles.length === 0;
  // A Customer without vehicles goes straight to entering one.
  const creatingVehicle = Boolean(selectedCustomer) && (isNewVehicle || noSavedVehicles);

  function clearVehicle() {
    setSelectedVehicle(null);
    setNewVehicle(false);
    setPlateNumber('');
    setChassisNumber('');
    setEngineNumber('');
  }

  function clearNewCustomerForm() {
    setNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
  }

  const createCustomer = useMutation({
    mutationFn: () => api.createCustomer({ name: newCustomerName, phone: newCustomerPhone }),
    onSuccess: (customer) => {
      setSelectedCustomer(customer);
      clearNewCustomerForm();
      clearVehicle();
      showToast({ variant: 'success', title: copy('Customer created.') });
    },
    onError: () => showToast({ variant: 'danger', title: copy('Could not create Customer.') }),
  });

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
      onCreatedChange?.(workOrder.id);
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['workshop-vehicles'] });
    },
  });

  function startNewWorkOrder() {
    setCreated(null);
    onCreatedChange?.(null);
    setSelectedCustomer(null);
    clearNewCustomerForm();
    clearVehicle();
    setCustomerRequest('');
    setIdempotencyKey(newIdempotencyKey());
    createWorkOrder.reset();
  }

  const vehicleReady = creatingVehicle
    ? Boolean(plateNumber.trim() && chassisNumber.trim() && engineNumber.trim())
    : Boolean(selectedVehicle);

  const canSubmit = Boolean(
    selectedLocationId && selectedCustomer && vehicleReady && customerRequest.trim(),
  );

  const errorCode = createWorkOrder.isError ? apiErrorCode(createWorkOrder.error) : undefined;
  const errorMessage = createWorkOrder.isError
    ? copy(
        (errorCode ? ERROR_COPY[errorCode] : undefined) ??
          'Could not create Work Order. Try again.',
      )
    : undefined;

  const surface = 'rounded-xl border border-(--color-border) bg-(--color-surface)';

  if (created) {
    return (
      <section className={cn(surface, 'p-5 md:p-6')} aria-live="polite">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-(--color-success)">
          <Check className="h-4 w-4" aria-hidden="true" />
          {copy('Work Order created')}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-(--color-text)">
          {created.workOrderNumber}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 border-t border-(--color-border) pt-4 text-sm">
          <div>
            <dt className="text-(--color-text-muted)">{copy('Customer')}</dt>
            <dd className="mt-0.5 text-base font-medium text-(--color-text)">
              {created.customerNameSnapshot}
            </dd>
          </div>
          <div>
            <dt className="text-(--color-text-muted)">{copy('Vehicle')}</dt>
            <dd className="mt-0.5 text-base font-medium text-(--color-text)">
              {created.vehiclePlateSnapshot}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <DButton className="w-full sm:w-auto" onClick={startNewWorkOrder}>
            {copy('Create another Work Order')}
          </DButton>
          {onOpenQueue ? (
            <DButton variant="secondary" className="w-full sm:w-auto" onClick={onOpenQueue}>
              {copy('View queue')}
            </DButton>
          ) : null}
        </div>
      </section>
    );
  }

  const customerState: StepState = selectedCustomer ? 'done' : 'active';
  const vehicleState: StepState = !selectedCustomer
    ? 'locked'
    : selectedVehicle
      ? 'done'
      : 'active';
  const complaintState: StepState = selectedCustomer && vehicleReady ? 'active' : 'locked';

  const linkAction = (label: string, onClick: () => void, withPlus = true) => (
    <DButton variant="link" size="sm" className="px-0" onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {withPlus ? <Plus className="h-4 w-4" aria-hidden="true" /> : null}
        {label}
      </span>
    </DButton>
  );

  return (
    <section className={surface}>
      <div className="p-5 md:p-6">
        <h2 className="text-lg font-semibold text-(--color-text)">{copy('New Work Order')}</h2>

        <div className="mt-4">
          <Step
            first
            number="01"
            title={copy('Customer')}
            state={customerState}
            contentRef={customerStepRef}
            action={
              selectedCustomer
                ? linkAction(
                    copy('Change'),
                    () => {
                      setSelectedCustomer(null);
                      clearVehicle();
                    },
                    false,
                  )
                : undefined
            }
          >
            {selectedCustomer ? (
              <div>
                <p className="text-base font-semibold text-(--color-text)">
                  {selectedCustomer.name}
                </p>
                <p className="text-sm text-(--color-text-muted)">
                  {formatPhoneForDisplay(selectedCustomer.phoneE164)}
                </p>
              </div>
            ) : isNewCustomer ? (
              <div className="space-y-3">
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
                  <DButton variant="ghost" size="sm" onClick={clearNewCustomerForm}>
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
              <>
                <DCombobox
                  ariaLabel={copy('Customer')}
                  placeholder={copy('Search name or phone number')}
                  value={null}
                  onChange={(value) => {
                    const customer = customerOptions.find((c) => c.id === value) ?? null;
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
                {canCreateCustomer
                  ? linkAction(copy('New customer'), () => {
                      setNewCustomer(true);
                      focusFirstField(customerStepRef);
                    })
                  : null}
              </>
            )}
          </Step>

          <Step
            number="02"
            title={copy('Vehicle')}
            state={vehicleState}
            hint={copy('Select a Customer first.')}
            contentRef={vehicleStepRef}
            action={
              selectedVehicle
                ? linkAction(copy('Change'), () => setSelectedVehicle(null), false)
                : undefined
            }
          >
            {!selectedCustomer ? null : selectedVehicle ? (
              <div>
                <p className="text-xl font-bold tracking-wide text-(--color-text)">
                  {selectedVehicle.plateNumber}
                </p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-(--color-text-muted)">
                  <dt>{copy('Chassis number')}</dt>
                  <dd className="truncate text-(--color-text)">{selectedVehicle.chassisNumber}</dd>
                  <dt>{copy('Engine number')}</dt>
                  <dd className="truncate text-(--color-text)">{selectedVehicle.engineNumber}</dd>
                </dl>
              </div>
            ) : savedVehicles.isLoading ? (
              <div aria-hidden="true">
                <DSkeleton count={2} height={44} />
              </div>
            ) : creatingVehicle ? (
              <div className="space-y-3">
                <DInput
                  label={copy('Plate number')}
                  value={plateNumber}
                  onChange={setPlateNumber}
                />
                <div className="grid gap-3 sm:grid-cols-2">
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
                {vehicles.length > 0
                  ? linkAction(copy('Use a saved vehicle'), clearVehicle, false)
                  : null}
              </div>
            ) : (
              <>
                <ul
                  aria-label={copy('Saved vehicles')}
                  className="max-h-64 divide-y divide-(--color-border) overflow-y-auto border-y border-(--color-border)"
                >
                  {vehicles.map((vehicle) => (
                    <li key={vehicle.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          focusFirstField(complaintStepRef);
                        }}
                        className="flex min-h-11 w-full flex-col items-start px-1 py-2 text-left transition-colors hover:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                      >
                        <span className="text-base font-semibold text-(--color-text)">
                          {vehicle.plateNumber}
                        </span>
                        <span className="text-xs text-(--color-text-muted)">
                          {vehicle.chassisNumber} · {vehicle.engineNumber}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {linkAction(copy('Add new vehicle'), () => {
                  setNewVehicle(true);
                  focusFirstField(vehicleStepRef);
                })}
              </>
            )}
          </Step>

          <Step
            number="03"
            title={copy('Keluhan')}
            state={complaintState}
            hint={copy('Select a Vehicle first.')}
            contentRef={complaintStepRef}
          >
            {complaintState === 'active' ? (
              <DTextarea
                aria-label={copy('Keluhan')}
                value={customerRequest}
                onChange={setCustomerRequest}
                placeholder={copy('For example, rem bunyi')}
              />
            ) : null}
          </Step>
        </div>

        {errorMessage ? <DAlert className="mt-5" variant="danger" title={errorMessage} /> : null}
      </div>

      <div className="flex justify-end border-t border-(--color-border) px-5 py-4 md:px-6">
        <DButton
          className="w-full sm:w-auto"
          loading={createWorkOrder.isPending}
          disabled={!canSubmit}
          onClick={() => createWorkOrder.mutate()}
        >
          {copy('Create Work Order')}
        </DButton>
      </div>
    </section>
  );
}
