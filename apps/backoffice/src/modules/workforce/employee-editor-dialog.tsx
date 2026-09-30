import {
  DBadge,
  DButton,
  DCheckbox,
  DDatePicker,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  useToast,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import { useFormState } from '../../shared/forms/use-form-state';
import {
  createEmployeePayload,
  employeeEditorForm,
  serviceEligibilityBlocker,
  serviceEligibilityBlockerCopy,
  updateEmployeePayload,
} from './employee-editor-model';
import type { EmployeeDetail, EmployeePosition, EmployeesApi } from './employees-api';
import { useWorkforceLocalization } from './workforce-localization';
import {
  EmployeeStatusBadge,
  WorkforceDialogTitle,
  WorkforcePanel,
  WorkforcePanelHeader,
} from './workforce-surfaces';

export function EmployeeEditorDialog({
  employee,
  isLoading,
  isError,
  api,
  onClose,
  onSaved,
}: {
  /** `null` creates an employee; otherwise the loaded employee is edited. */
  employee: EmployeeDetail | null | undefined;
  isLoading: boolean;
  isError: boolean;
  api: EmployeesApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useWorkforceLocalization();
  const { showToast } = useToast();
  const fresh = employee === null;
  const { values: form, setField } = useFormState(() => employeeEditorForm(employee));

  const positions = useQuery({
    queryKey: ['employees', 'positions', 'editor'],
    queryFn: () => api.listPositions({ limit: 100, offset: 0 }),
  });
  const positionList = positions.data?.items ?? [];
  const selectedPosition = positionList.find((position) => position.id === form.positionId);

  const save = async () => {
    if (!form.displayName.trim()) return;
    try {
      if (fresh) await api.create(createEmployeePayload(form));
      else if (employee) await api.update(employee, updateEmployeePayload(employee, form));
      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? copy('Employee added.') : copy('Employee updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        handleEmployeeMutationError(error, onSaved, copy, showToast, onClose);
    }
  };

  // Draft preview of the same gates Runtime applies once saved; the saved verdict stays Runtime's.
  const serviceBlocker = serviceEligibilityBlocker({
    status: employee?.status ?? 'ACTIVE',
    servicePerformerEligible: form.servicePerformerEligible,
    position: form.positionId ? (selectedPosition ?? employee?.position ?? null) : null,
  });

  const positionOptions = positionList.map((position: EmployeePosition) => ({
    value: position.id,
    label: `${position.name}${position.status === 'INACTIVE' ? ` · ${copy('Inactive')}` : ''}`,
    disabled: position.status === 'INACTIVE',
  }));

  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={
        <WorkforceDialogTitle
          title={fresh ? copy('Add employee') : copy('Edit employee')}
          badges={
            employee ? (
              <>
                <DBadge variant="info">{employee.code}</DBadge>
                <EmployeeStatusBadge status={employee.status} />
              </>
            ) : null
          }
        />
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            disabled={isLoading || isError || !form.displayName.trim()}
            onClick={() => void save()}
          >
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <DSkeleton className="h-40 w-full" />
          <DSkeleton className="h-32 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Could not load employee details.')}
        </p>
      ) : (
        <div className="space-y-5">
          <WorkforcePanel ariaLabel={copy('Identity & employment')} className="p-5">
            <div className="space-y-3">
              <DInput
                label={copy('Display name')}
                value={form.displayName}
                onChange={(value) => setField('displayName', value)}
                placeholder={copy('For example, Ari Pratama')}
                autoFocus
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DInput
                  label={copy('Employee code')}
                  value={form.code}
                  onChange={(value) => setField('code', value)}
                  disabled={!fresh}
                  hint={
                    fresh
                      ? copy('Leave Employee Code blank to generate it automatically.')
                      : copy('Employee code cannot be changed after creation.')
                  }
                />
                <DDatePicker
                  label={copy('Join date')}
                  value={form.joinedOn}
                  onChange={(value) => setField('joinedOn', value ?? '')}
                  onClear={() => setField('joinedOn', '')}
                  clearable
                  variant="date"
                  placeholder={copy('Select join date')}
                />
              </div>
              <DSelect
                label={copy('Position')}
                value={form.positionId || null}
                onValueChange={(value) =>
                  setField('positionId', value == null ? '' : String(value))
                }
                options={positionOptions}
                loading={positions.isLoading}
                searchable
                clearable
                placeholder={copy('Select position')}
              />
            </div>
          </WorkforcePanel>

          <WorkforcePanel ariaLabel={copy('Work eligibility')}>
            <WorkforcePanelHeader
              title={copy('Work eligibility')}
              description={copy('Service work and Product sales attribution are set separately.')}
            />
            <div className="space-y-3 p-5">
              <EligibilityOption
                checked={form.servicePerformerEligible}
                onToggle={() =>
                  setField('servicePerformerEligible', !form.servicePerformerEligible)
                }
                title={copy('Eligible as Service performer')}
                hint={copy(
                  'The employee can be assigned to service work when the position allows it.',
                )}
                footer={
                  <p
                    className={`text-xs leading-5 ${
                      serviceBlocker
                        ? 'text-[var(--color-text-muted)]'
                        : 'text-[var(--color-success)]'
                    }`}
                  >
                    {serviceBlocker
                      ? `${copy('Not shown in Operational Service performer selection.')} ${copy(
                          serviceEligibilityBlockerCopy[serviceBlocker],
                        )}`
                      : copy('Shown in Operational Service performer selection.')}
                  </p>
                }
              />
              <EligibilityOption
                checked={form.productSalesEligible}
                onToggle={() => setField('productSalesEligible', !form.productSalesEligible)}
                title={copy('Eligible for Product sales attribution')}
                hint={copy('The employee can be chosen as the seller of a Product in a sale.')}
              />
            </div>
          </WorkforcePanel>
        </div>
      )}
    </DDialog>
  );
}

function EligibilityOption({
  checked,
  onToggle,
  title,
  hint,
  footer,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  hint: string;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-3.5 py-3">
      <label className="flex items-start gap-3">
        <DCheckbox checked={checked} onChange={onToggle} className="mt-0.5" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--color-text)]">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
            {hint}
          </span>
        </span>
      </label>
      {footer ? <div className="mt-2 pl-7">{footer}</div> : null}
    </div>
  );
}

export function handleEmployeeMutationError(
  error: unknown,
  refresh: () => void,
  copy: (value: string) => string,
  showToast: (input: { variant: 'danger' | 'warning'; title: string }) => void,
  onConflict?: () => void,
) {
  const normalized = normalizeBackofficeApiError(error, copy('Could not save employee.'));
  if (normalized.code === 'VERSION_CONFLICT') {
    refresh();
    onConflict?.();
    showToast({
      variant: 'warning',
      title: copy(
        'Employee data changed. The latest data has been loaded; review it before trying again.',
      ),
    });
    return;
  }
  showToast({ variant: 'danger', title: normalized.safeMessage });
}
