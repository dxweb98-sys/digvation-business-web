import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DDataTable,
  DDatePicker,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DStatusFilter,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DTextarea,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Eye, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import {
  canAccessBackoffice,
  canPerformBackofficeAction,
} from '../../auth/backoffice-access';
import {
  isSessionExpiredError,
  useBackofficeAuth,
} from '../../auth/backoffice-auth-context';
import { AttendancePanel } from './attendance-panel';
import { EmployeeDetailDialog } from './employee-detail-dialog';
import {
  EmployeesApi,
  type Employee,
  type EmployeeDetail,
  type EmployeePosition,
} from './employees-api';
import { PositionsPanel } from './positions-panel';
import { useWorkforceLocalization } from './workforce-localization';

const defaultPageSize = 20;
const employeeKey = ['employees'] as const;

export function EmployeesPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy, formatDate } = useWorkforceLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new EmployeesApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState<'' | Employee['status']>('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [editorId, setEditorId] = useState<string | 'create' | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const canCreate = Boolean(
    session && canPerformBackofficeAction(session, 'createEmployee'),
  );
  const canUpdate = Boolean(
    session && canPerformBackofficeAction(session, 'updateEmployee'),
  );
  const attendanceEnabled = Boolean(
    session &&
      canAccessBackoffice(
        session,
        'attendance',
        session.effectiveEntitlements,
      ),
  );
  const canManageAttendance = Boolean(
    attendanceEnabled &&
      session &&
      canPerformBackofficeAction(session, 'manageAttendance'),
  );

  const employees = useQuery({
    queryKey: [...employeeKey, 'list', q, status, offset, pageSize],
    queryFn: () =>
      api.list({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(status ? { status } : {}),
        limit: pageSize,
        offset,
      }),
    enabled: Boolean(session),
  });
  const selectedEmployeeId =
    detailId ?? (editorId && editorId !== 'create' ? editorId : null);
  const detail = useQuery({
    queryKey: [...employeeKey, 'detail', selectedEmployeeId],
    queryFn: () => api.get(selectedEmployeeId!),
    enabled: Boolean(session && selectedEmployeeId),
  });

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: employeeKey });

  const openStatusChange = (employee: Employee) => {
    setStatusReason('');
    setStatusTarget(employee);
  };

  const updateStatus = async () => {
    if (!statusTarget) return;
    const nextStatus =
      statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.update(statusTarget, {
        status: nextStatus,
        ...(statusReason.trim()
          ? { statusReason: statusReason.trim() }
          : {}),
      });
      refresh();
      setStatusTarget(null);
      showToast({
        variant: 'success',
        title: copy(
          nextStatus === 'ACTIVE'
            ? 'Employee reactivated.'
            : 'Employee deactivated.',
        ),
      });
    } catch (error) {
      handleMutationError(
        error,
        refresh,
        copy,
        showToast,
        () => setStatusTarget(null),
      );
    }
  };

  if (!session) return null;

  const columns: TableColumn<Employee>[] = [
    { key: 'code', label: copy('Employee code') },
    { key: 'displayName', label: copy('Display name') },
    {
      key: 'position',
      label: copy('Position'),
      render: (employee) => employee.position?.name ?? copy('Not set'),
    },
    {
      key: 'serviceAssignment',
      label: copy('Service assignment'),
      render: (employee) =>
        employee.position ? (
          <DBadge
            variant={
              employee.position.status === 'ACTIVE' &&
              employee.position.serviceAssignmentEnabled
                ? 'success'
                : 'secondary'
            }
          >
            {copy(
              employee.position.status === 'ACTIVE' &&
                employee.position.serviceAssignmentEnabled
                ? 'Can perform services'
                : 'Cannot perform services',
            )}
          </DBadge>
        ) : (
          copy('Not set')
        ),
    },
    {
      key: 'joinedOn',
      label: copy('Join date'),
      render: (employee) =>
        formatJoinedOn(employee.joinedOn, formatDate, copy),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (employee) => <StatusBadge status={employee.status} />,
    },
  ];
  const nextStatus =
    statusTarget?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Master Data')}
        title={copy('Employees')}
        description={copy('Manage employees available to POS operations.')}
      />

      <DTabs defaultValue="employees" className="mt-6">
        <DTabsList className="max-w-full overflow-x-auto">
          <DTabsTrigger value="employees">{copy('Employees')}</DTabsTrigger>
          <DTabsTrigger value="positions">{copy('Positions')}</DTabsTrigger>
          {attendanceEnabled ? (
            <DTabsTrigger value="attendance">
              {copy('Attendance')}
            </DTabsTrigger>
          ) : null}
        </DTabsList>

        <DTabsContent value="employees" className="mt-4">
          <DDataTable
            columns={columns}
            data={employees.data?.items ?? []}
            loading={employees.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search employee code or name...')}
            searchValue={q}
            onSearchChange={(value) => {
              setQuery(value);
              setOffset(0);
            }}
            filters={
              <DStatusFilter
                label={copy('Status')}
                value={status}
                onChange={(value) => {
                  setStatus(value as '' | Employee['status']);
                  setOffset(0);
                }}
                allLabel={copy('All')}
                options={[
                  { label: copy('Active'), value: 'ACTIVE' },
                  { label: copy('Inactive'), value: 'INACTIVE' },
                ]}
              />
            }
            headerActions={
              canCreate ? (
                <DButton
                  leftIcon={<Plus className="size-4" />}
                  onClick={() => setEditorId('create')}
                >
                  {copy('Add employee')}
                </DButton>
              ) : null
            }
            emptyMessage={
              q || status
                ? copy('No matching employees found.')
                : copy('No employees are available.')
            }
            pagination={{
              page: Math.floor(offset / pageSize) + 1,
              pageSize,
              total: employees.data?.total ?? 0,
            }}
            onPageChange={(page) => setOffset((page - 1) * pageSize)}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setOffset(0);
            }}
            actions={[
              {
                label: copy('View details'),
                icon: <Eye className="size-4" />,
                onClick: (employee) => setDetailId(employee.id),
              },
              {
                label: copy('Edit employee'),
                icon: <Pencil className="size-4" />,
                onClick: (employee) => setEditorId(employee.id),
                show: () => canUpdate,
              },
              {
                label: copy('Deactivate employee'),
                icon: <CircleOff className="size-4" />,
                variant: 'danger',
                onClick: openStatusChange,
                show: (employee) =>
                  canUpdate && employee.status === 'ACTIVE',
              },
              {
                label: copy('Activate employee'),
                icon: <CircleCheck className="size-4" />,
                onClick: openStatusChange,
                show: (employee) =>
                  canUpdate && employee.status === 'INACTIVE',
              },
            ]}
          />
        </DTabsContent>

        <DTabsContent value="positions" className="mt-4">
          <PositionsPanel
            api={api}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </DTabsContent>

        {attendanceEnabled ? (
          <DTabsContent value="attendance" className="mt-4">
            <AttendancePanel api={api} canManage={canManageAttendance} />
          </DTabsContent>
        ) : null}
      </DTabs>

      <EmployeeEditor
        open={editorId !== null}
        employee={editorId === 'create' ? null : detail.data}
        isLoading={
          editorId !== null &&
          editorId !== 'create' &&
          detail.isLoading
        }
        isError={
          editorId !== null && editorId !== 'create' && detail.isError
        }
        api={api}
        onClose={() => setEditorId(null)}
        onSaved={refresh}
      />

      <EmployeeDetailDialog
        open={detailId !== null}
        employee={detailId ? detail.data : undefined}
        isLoading={Boolean(detailId && detail.isLoading)}
        isError={Boolean(detailId && detail.isError)}
        api={api}
        attendanceEnabled={attendanceEnabled}
        onClose={() => setDetailId(null)}
      />

      <DDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={copy(
          nextStatus === 'INACTIVE'
            ? 'Deactivate employee?'
            : 'Reactivate employee?',
        )}
        description={
          nextStatus === 'INACTIVE'
            ? copy(
                'This employee remains in historical records but cannot be selected for new POS assignments.',
              )
            : copy(
                'This employee can be selected for POS assignments again.',
              )
        }
        footer={
          <div className="flex justify-end gap-2">
            <DButton
              variant="secondary"
              onClick={() => setStatusTarget(null)}
            >
              {copy('Cancel')}
            </DButton>
            <DButton
              variant={
                nextStatus === 'INACTIVE' ? 'danger' : 'primary'
              }
              onClick={() => void updateStatus()}
            >
              {copy(
                nextStatus === 'INACTIVE' ? 'Deactivate' : 'Reactivate',
              )}
            </DButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-4">
            <p className="font-semibold">{statusTarget?.displayName}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {[
                statusTarget?.code,
                statusTarget?.position?.name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <DTextarea
            label={copy('Reason')}
            value={statusReason}
            onChange={setStatusReason}
            hint={copy(
              'Reason is optional and will be recorded in employee history.',
            )}
            placeholder={copy('Optional reason for this status change')}
          />
        </div>
      </DDialog>
    </BackofficePage>
  );
}

function StatusBadge({ status }: { status: Employee['status'] }) {
  const { copy } = useWorkforceLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {copy(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
  );
}

function EmployeeEditor({
  open,
  employee,
  isLoading,
  isError,
  api,
  onClose,
  onSaved,
}: {
  open: boolean;
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
  const [code, setCode] = useState(employee?.code ?? '');
  const [displayName, setDisplayName] = useState(
    employee?.displayName ?? '',
  );
  const [positionId, setPositionId] = useState(
    employee?.positionId ?? '',
  );
  const [joinedOn, setJoinedOn] = useState(employee?.joinedOn ?? '');

  const positions = useQuery({
    queryKey: ['employees', 'positions', 'editor'],
    queryFn: () => api.listPositions({ limit: 100, offset: 0 }),
    enabled: open,
  });

  useEffect(() => {
    if (employee) {
      setCode(employee.code);
      setDisplayName(employee.displayName);
      setPositionId(employee.positionId ?? '');
      setJoinedOn(employee.joinedOn ?? '');
    } else if (fresh) {
      setCode('');
      setDisplayName('');
      setPositionId('');
      setJoinedOn('');
    }
  }, [employee, fresh, open]);

  const save = async () => {
    if (!displayName.trim()) return;
    try {
      if (fresh) {
        await api.create({
          ...(code.trim()
            ? { code: code.trim().toUpperCase() }
            : {}),
          displayName: displayName.trim(),
          positionId: positionId || null,
          ...(joinedOn ? { joinedOn } : {}),
        });
      } else if (employee) {
        await api.update(employee, {
          displayName: displayName.trim(),
          ...(positionId !== (employee.positionId ?? '')
            ? { positionId: positionId || null }
            : {}),
          joinedOn: joinedOn || null,
        });
      }
      onSaved();
      showToast({
        variant: 'success',
        title: fresh
          ? copy('Employee added.')
          : copy('Employee updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        handleMutationError(
          error,
          onSaved,
          copy,
          showToast,
          onClose,
        );
    }
  };

  const positionOptions = (positions.data?.items ?? []).map(
    (position: EmployeePosition) => ({
      value: position.id,
      label: `${position.name}${position.status === 'INACTIVE' ? ` · ${copy('Inactive')}` : ''}`,
      disabled: position.status === 'INACTIVE',
    }),
  );

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={fresh ? copy('Add employee') : copy('Edit employee')}
      description={
        fresh
          ? copy('Employees are created Active.')
          : copy('Employee code cannot be changed after creation.')
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            disabled={isLoading || isError || !displayName.trim()}
            onClick={() => void save()}
          >
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <DSkeleton className="h-16 w-full" />
          <DSkeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Could not load employee details.')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DInput
            label={copy('Employee code')}
            value={code}
            onChange={setCode}
            disabled={!fresh}
            placeholder={copy(
              'Leave Employee Code blank to generate it automatically.',
            )}
            autoFocus
          />
          <DInput
            label={copy('Display name')}
            value={displayName}
            onChange={setDisplayName}
            placeholder={copy('For example, Ari Pratama')}
          />
          <DSelect
            label={copy('Position')}
            value={positionId || null}
            onValueChange={(value) =>
              setPositionId(value == null ? '' : String(value))
            }
            options={positionOptions}
            loading={positions.isLoading}
            searchable
            clearable
            placeholder={copy('Select position')}
            hint={copy(
              'Service eligibility is controlled by the employee position. Catalog service assignment mode still decides whether assignment is optional or required.',
            )}
          />
          <DDatePicker
            label={copy('Join date')}
            value={joinedOn}
            onChange={setJoinedOn}
            onClear={() => setJoinedOn('')}
            clearable
            variant="date"
            placeholder={copy('Select join date')}
          />
        </div>
      )}
    </DDialog>
  );
}

function formatJoinedOn(
  joinedOn: string | null,
  formatDate: (
    value: Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string,
  copy: (value: string) => string,
) {
  return joinedOn
    ? formatDate(new Date(`${joinedOn}T00:00:00`), {
        dateStyle: 'medium',
      })
    : copy('Not set');
}

function handleMutationError(
  error: unknown,
  refresh: () => void,
  copy: (value: string) => string,
  showToast: (input: {
    variant: 'danger' | 'warning';
    title: string;
  }) => void,
  onConflict?: () => void,
) {
  const normalized = normalizeBackofficeApiError(
    error,
    copy('Could not save employee.'),
  );
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
