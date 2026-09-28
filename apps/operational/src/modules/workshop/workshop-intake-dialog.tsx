import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
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
import { useMemo, useState, type ReactNode } from 'react';

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

/** One labelled block of the dialog; the label doubles as the field label. */
function Field({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-(--color-text)">{label}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The chosen Customer / Vehicle, shown once, with a way to change it. */
function SelectedSummary({
  title,
  detail,
  onChange,
  changeLabel,
}: {
  title: string;
  detail: string;
  onChange: () => void;
  changeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-(--color-text)">{title}</p>
        <p className="truncate text-sm text-(--color-text-muted)">{detail}</p>
      </div>
      <DButton variant="ghost" size="sm" onClick={onChange}>
        {changeLabel}
      </DButton>
    </div>
  );
}

/** A subordinate inline form (new Customer / new Vehicle) inside the dialog. */
function InlineForm({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3">
      {children}
    </div>
  );
}

export function WorkshopIntakeDialog({
  onClose,
  onOpenQueue,
}: {
  onClose: () => void;
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
          ...(isNewVehicle
            ? { plateNumber, chassisNumber, engineNumber }
            : { vehicleId: selectedVehicle!.id }),
        },
        idempotencyKey,
      ),
    onSuccess: async (workOrder) => {
      setCreated(workOrder);
      await queryClient.invalidateQueries({ queryKey: ['workshop-vehicles'] });
    },
  });

  function startNewWorkOrder() {
    setCreated(null);
    setSelectedCustomer(null);
    clearNewCustomerForm();
    clearVehicle();
    setCustomerRequest('');
    setIdempotencyKey(newIdempotencyKey());
    createWorkOrder.reset();
  }

  const vehicleReady = isNewVehicle
    ? Boolean(plateNumber.trim() && chassisNumber.trim() && engineNumber.trim())
    : Boolean(selectedVehicle);

  const canSubmit = Boolean(
    selectedLocationId && selectedCustomer && vehicleReady && customerRequest.trim(),
  );

  const errorCode = createWorkOrder.isError ? apiErrorCode(createWorkOrder.error) : undefined;
  const errorMessage = errorCode
    ? copy(ERROR_COPY[errorCode] ?? 'Could not create Work Order. Try again.')
    : createWorkOrder.isError
      ? copy('Could not create Work Order. Try again.')
      : undefined;

  const buttonFit = 'w-full sm:w-auto';

  if (created) {
    return (
      <DDialog
        open
        onClose={onClose}
        size="md"
        title={copy('Work Order created')}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onOpenQueue ? (
              <DButton variant="secondary" className={buttonFit} onClick={onOpenQueue}>
                {copy('View queue')}
              </DButton>
            ) : (
              <DButton variant="secondary" className={buttonFit} onClick={onClose}>
                {copy('Close')}
              </DButton>
            )}
            <DButton className={buttonFit} onClick={startNewWorkOrder}>
              {copy('Create another Work Order')}
            </DButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--color-success)/10 text-(--color-success)">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-(--color-text-muted)">{copy('Work Order number')}</p>
              <p className="truncate text-xl font-bold text-(--color-text)">
                {created.workOrderNumber}
              </p>
            </div>
          </div>
          <dl className="space-y-2 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-(--color-text-muted)">{copy('Customer')}</dt>
              <dd className="text-right font-medium text-(--color-text)">
                {created.customerNameSnapshot}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-(--color-text-muted)">{copy('Vehicle')}</dt>
              <dd className="text-right font-medium text-(--color-text)">
                {created.vehiclePlateSnapshot}
              </dd>
            </div>
          </dl>
        </div>
      </DDialog>
    );
  }

  return (
    <DDialog
      open
      onClose={onClose}
      closeOnOverlay={false}
      size="lg"
      title={copy('Create Work Order')}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DButton variant="secondary" className={buttonFit} onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            className={buttonFit}
            loading={createWorkOrder.isPending}
            disabled={!canSubmit}
            onClick={() => createWorkOrder.mutate()}
          >
            {copy('Create Work Order')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-5">
        {!selectedLocationId ? (
          <DAlert variant="warning" title={copy('Select a Location to continue.')} />
        ) : null}

        <Field label={copy('Customer')}>
          {selectedCustomer ? (
            <SelectedSummary
              title={selectedCustomer.name}
              detail={selectedCustomer.phoneE164}
              changeLabel={copy('Change')}
              onChange={() => {
                setSelectedCustomer(null);
                clearVehicle();
              }}
            />
          ) : isNewCustomer ? (
            <InlineForm>
              <DInput label={copy('Name')} value={newCustomerName} onChange={setNewCustomerName} />
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
            </InlineForm>
          ) : (
            <>
              <DCombobox
                ariaLabel={copy('Customer')}
                placeholder={copy('Search name or phone number')}
                value={null}
                onChange={(value) => {
                  setSelectedCustomer(customerOptions.find((c) => c.id === value) ?? null);
                  clearVehicle();
                }}
                fetchOptions={async (search) => {
                  const page = await api.searchCustomers(search);
                  setCustomerOptions(page.items);
                  return page.items.map(
                    (customer): SelectOption => ({
                      value: customer.id,
                      label: `${customer.name} — ${customer.phoneE164}`,
                    }),
                  );
                }}
              />
              {canCreateCustomer ? (
                <DButton
                  variant="link"
                  size="sm"
                  onClick={() => setNewCustomer(true)}
                  className="px-0"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {copy('New customer')}
                  </span>
                </DButton>
              ) : null}
            </>
          )}
        </Field>

        <Field label={copy('Vehicle')}>
          {!selectedCustomer ? (
            <p className="rounded-lg border border-dashed border-(--color-border) px-3 py-3 text-sm text-(--color-text-muted)">
              {copy('Select a Customer first.')}
            </p>
          ) : isNewVehicle ? (
            <InlineForm>
              <DInput label={copy('Plate number')} value={plateNumber} onChange={setPlateNumber} />
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
              <DButton variant="link" size="sm" className="px-0" onClick={clearVehicle}>
                {copy('Use a saved vehicle')}
              </DButton>
            </InlineForm>
          ) : selectedVehicle ? (
            <SelectedSummary
              title={selectedVehicle.plateNumber}
              detail={`${copy('Chassis number')} ${selectedVehicle.chassisNumber} · ${copy('Engine number')} ${selectedVehicle.engineNumber}`}
              changeLabel={copy('Change')}
              onChange={() => setSelectedVehicle(null)}
            />
          ) : (
            <>
              <DCombobox
                ariaLabel={copy('Vehicle')}
                placeholder={copy('Search plate, chassis, or engine number')}
                value={null}
                refetchKey={selectedCustomer.id}
                onChange={(value) =>
                  setSelectedVehicle(vehicleOptions.find((v) => v.id === value) ?? null)
                }
                fetchOptions={async (search) => {
                  const page = await api.listVehicles(selectedCustomer.id, search);
                  setVehicleOptions(page.items);
                  return page.items.map(
                    (vehicle): SelectOption => ({
                      value: vehicle.id,
                      label: vehicle.plateNumber,
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
            </>
          )}
        </Field>

        <Field label={copy('Keluhan / Permintaan Customer')}>
          <DTextarea
            aria-label={copy('Keluhan / Permintaan Customer')}
            value={customerRequest}
            onChange={setCustomerRequest}
            placeholder={copy('For example, rem bunyi')}
          />
        </Field>

        {errorMessage ? <DAlert variant="danger" title={errorMessage} /> : null}
      </div>
    </DDialog>
  );
}
