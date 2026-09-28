import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useToast } from '@digvation/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { useOperationalSession } from '../../../operational/operational-session-provider';
import {
  WorkshopIntakeApi,
  type WorkshopCustomer,
  type WorkshopVehicle,
  type WorkshopWorkOrder,
} from '../api/workshop-intake-api';
import {
  apiErrorCode,
  canCreateWorkshopCustomer,
  INTAKE_ERROR_COPY,
  newIdempotencyKey,
} from './workshop-intake-format';
import { normalizeIndonesianPhone } from './workshop-phone';
import { composePlate, EMPTY_PLATE, type PlateParts } from './workshop-plate';
import { useDebouncedValue } from './use-debounced-value';

export type CreateStep = 1 | 2 | 3;
export type LookupMode = 'existing' | 'new';

/**
 * State, lookups and mutations for the Workshop Intake dialog. The UI layer
 * only renders this controller; every Runtime call goes through
 * `WorkshopIntakeApi` and stays authoritative.
 */
export function useCreateWorkOrder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canCreateCustomer = canCreateWorkshopCustomer(session.access.permissions);

  const [step, setStep] = useState<CreateStep>(1);
  const [customerMode, setCustomerMode] = useState<LookupMode>('existing');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<WorkshopCustomer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [vehicleMode, setVehicleMode] = useState<LookupMode>('existing');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<WorkshopVehicle | null>(null);
  const [plateParts, setPlateParts] = useState<PlateParts>(EMPTY_PLATE);
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');

  const [customerRequest, setCustomerRequest] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [created, setCreated] = useState<WorkshopWorkOrder | null>(null);

  const plateNumber = composePlate(plateParts);
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
    enabled:
      open && !created && step === 2 && vehicleMode === 'existing' && Boolean(vehicleCustomerId),
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
    setPlateParts(EMPTY_PLATE);
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

  function changeVehicleMode(next: LookupMode) {
    setVehicleMode(next);
    setSelectedVehicle(null);
    setCustomerRequest('');
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
        (errorCode ? INTAKE_ERROR_COPY[errorCode] : undefined) ??
          'Could not create Work Order. Try again.',
      )
    : undefined;

  const canAdvanceCustomer = Boolean(selectedCustomer);
  const canAdvanceVehicle = Boolean(selectedCustomer && vehicleReady);
  const canSubmit = Boolean(
    selectedLocationId && selectedCustomer && vehicleReady && customerRequest.trim(),
  );

  return {
    selectedLocationId,
    canCreateCustomer,
    step,
    setStep,
    created,
    // customer
    customerMode,
    customerQuery,
    setCustomerQuery,
    customers,
    customersRefreshing,
    selectedCustomer,
    selectCustomer,
    changeCustomer,
    changeCustomerMode,
    newCustomerName,
    setNewCustomerName,
    newCustomerPhone,
    setNewCustomerPhone,
    setPhoneTouched,
    phoneInvalid,
    canSaveCustomer,
    createCustomer,
    cancelNewCustomer,
    // vehicle
    vehicleMode,
    vehicleQuery,
    setVehicleQuery,
    vehicles,
    vehiclesRefreshing,
    selectedVehicle,
    setSelectedVehicle,
    changeVehicle,
    changeVehicleMode,
    plateParts,
    setPlateParts,
    plateNumber,
    chassisNumber,
    setChassisNumber,
    engineNumber,
    setEngineNumber,
    vehicleReady,
    // complaint + submit
    customerRequest,
    setCustomerRequest,
    createWorkOrder,
    errorMessage,
    canAdvanceCustomer,
    canAdvanceVehicle,
    canSubmit,
    resetAll,
    closeDialog,
  };
}

export type CreateWorkOrderController = ReturnType<typeof useCreateWorkOrder>;
