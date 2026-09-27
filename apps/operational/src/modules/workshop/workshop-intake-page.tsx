import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DAlert,
  DButton,
  DCombobox,
  DInput,
  DTextarea,
  useToast,
  type SelectOption,
} from '@digvation/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export function WorkshopIntakePage() {
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

  const createCustomer = useMutation({
    mutationFn: () => api.createCustomer({ name: newCustomerName, phone: newCustomerPhone }),
    onSuccess: (customer) => {
      setSelectedCustomer(customer);
      setNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setSelectedVehicle(null);
      setNewVehicle(false);
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
    setNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setSelectedVehicle(null);
    setNewVehicle(false);
    setPlateNumber('');
    setChassisNumber('');
    setEngineNumber('');
    setCustomerRequest('');
    setIdempotencyKey(newIdempotencyKey());
    createWorkOrder.reset();
  }

  const vehicleSelected = isNewVehicle
    ? Boolean(plateNumber.trim() && chassisNumber.trim() && engineNumber.trim())
    : Boolean(selectedVehicle);

  const canSubmit = Boolean(
    selectedLocationId && selectedCustomer && vehicleSelected && customerRequest.trim(),
  );

  const errorCode = createWorkOrder.isError ? apiErrorCode(createWorkOrder.error) : undefined;
  const errorMessage = errorCode
    ? copy(ERROR_COPY[errorCode] ?? 'Could not create Work Order. Try again.')
    : undefined;

  if (created) {
    return (
      <div className="p-5 md:p-6 lg:p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-(--color-border) bg-(--color-surface) p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Workshop')}
          </p>
          <h1 className="mt-2 text-xl font-bold text-(--color-text)">
            {copy('Work Order created')}
          </h1>
          <dl className="mt-5 space-y-2 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-(--color-text-muted)">{copy('Work Order number')}</dt>
              <dd className="font-semibold text-(--color-text)">{created.workOrderNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-(--color-text-muted)">{copy('Customer')}</dt>
              <dd className="text-(--color-text)">{created.customerNameSnapshot}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-(--color-text-muted)">{copy('Vehicle')}</dt>
              <dd className="text-(--color-text)">{created.vehiclePlateSnapshot}</dd>
            </div>
          </dl>
          <DButton className="mt-6 w-full" onClick={startNewWorkOrder}>
            {copy('New Work Order')}
          </DButton>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Workshop')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Intake')}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {copy('Keluhan / Permintaan Customer sebelum diagnosis mekanik.')}
        </p>
      </header>

      {!selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">{copy('Customer')}</h2>
          {!isNewCustomer ? (
            <>
              <DCombobox
                label={copy('Search customer by name or phone')}
                value={selectedCustomer?.id ?? null}
                onChange={(value) => {
                  setSelectedCustomer(customerOptions.find((c) => c.id === value) ?? null);
                  setSelectedVehicle(null);
                  setNewVehicle(false);
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
                <DButton variant="outline" size="sm" onClick={() => setNewCustomer(true)}>
                  {copy('New customer')}
                </DButton>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <DInput
                label={copy('Name')}
                value={newCustomerName}
                onChange={setNewCustomerName}
              />
              <DInput
                label={copy('Phone')}
                value={newCustomerPhone}
                onChange={setNewCustomerPhone}
                placeholder="+628123456789"
              />
              <div className="flex gap-2">
                <DButton
                  size="sm"
                  loading={createCustomer.isPending}
                  disabled={!newCustomerName.trim() || !newCustomerPhone.trim()}
                  onClick={() => createCustomer.mutate()}
                >
                  {copy('Save')}
                </DButton>
                <DButton size="sm" variant="secondary" onClick={() => setNewCustomer(false)}>
                  {copy('Cancel')}
                </DButton>
              </div>
            </div>
          )}
          {selectedCustomer ? (
            <p className="text-sm text-(--color-text)">
              {selectedCustomer.name} — {selectedCustomer.phoneE164}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-(--color-text)">{copy('Vehicle')}</h2>
          {!selectedCustomer ? (
            <p className="text-sm text-(--color-text-muted)">
              {copy('Select a Customer first.')}
            </p>
          ) : !isNewVehicle ? (
            <>
              <DCombobox
                label={copy('Search vehicle by plate, chassis, or engine number')}
                value={selectedVehicle?.id ?? null}
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
              <DButton variant="outline" size="sm" onClick={() => setNewVehicle(true)}>
                {copy('Add new vehicle')}
              </DButton>
            </>
          ) : (
            <div className="space-y-3">
              <DInput label={copy('Plate number')} value={plateNumber} onChange={setPlateNumber} />
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
              <DButton size="sm" variant="secondary" onClick={() => setNewVehicle(false)}>
                {copy('Cancel')}
              </DButton>
            </div>
          )}
          {selectedVehicle && !isNewVehicle ? (
            <p className="text-sm text-(--color-text)">
              {selectedVehicle.plateNumber} · {selectedVehicle.chassisNumber} ·{' '}
              {selectedVehicle.engineNumber}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <DTextarea
          label={copy('Keluhan / Permintaan Customer')}
          value={customerRequest}
          onChange={setCustomerRequest}
          placeholder={copy('For example, rem bunyi')}
        />
      </section>

      {errorMessage ? (
        <DAlert variant="danger" className="mt-5" title={errorMessage} />
      ) : null}

      <footer className="mt-6 flex justify-end">
        <DButton
          loading={createWorkOrder.isPending}
          disabled={!canSubmit}
          onClick={() => createWorkOrder.mutate()}
        >
          {copy('Create Work Order')}
        </DButton>
      </footer>
    </div>
  );
}
