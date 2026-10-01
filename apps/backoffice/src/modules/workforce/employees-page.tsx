import { useRuntime } from '@digvation/business-runtime';
import {
  DButton,
  DDataTable,
  DDialog,
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
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { canAccessBackoffice, canPerformBackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { AttendancePanel } from './attendance-panel';
import { EmployeeDetailDialog } from './employee-detail-dialog';
import { EmployeeEditorDialog, handleEmployeeMutationError } from './employee-editor-dialog';
import { EmployeesApi, type Employee } from './employees-api';
import { PositionsPanel } from './positions-panel';
import { useWorkforceLocalization } from './workforce-localization';
import { EmployeeStatusBadge, ServiceEligibilityStatus } from './workforce-surfaces';

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

  const canCreate = Boolean(session && canPerformBackofficeAction(session, 'createEmployee'));
  const canUpdate = Boolean(session && canPerformBackofficeAction(session, 'updateEmployee'));
  const attendanceEnabled = Boolean(session && canAccessBackoffice(session, 'attendance'));
  const canManageAttendance = Boolean(
    attendanceEnabled && session && canPerformBackofficeAction(session, 'manageAttendance'),
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
  const selectedEmployeeId = detailId ?? (editorId && editorId !== 'create' ? editorId : null);
  const detail = useQuery({
    queryKey: [...employeeKey, 'detail', selectedEmployeeId],
    queryFn: () => api.get(selectedEmployeeId!),
    enabled: Boolean(session && selectedEmployeeId),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: employeeKey });

  const openStatusChange = (employee: Employee) => {
    setStatusReason('');
    setStatusTarget(employee);
  };

  const updateStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.update(statusTarget, {
        status: nextStatus,
        ...(statusReason.trim() ? { statusReason: statusReason.trim() } : {}),
      });
      refresh();
      setStatusTarget(null);
      showToast({
        variant: 'success',
        title: copy(nextStatus === 'ACTIVE' ? 'Employee reactivated.' : 'Employee deactivated.'),
      });
    } catch (error) {
      handleEmployeeMutationError(error, refresh, copy, showToast, () => setStatusTarget(null));
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
      // Runtime's effective verdict (employee and Position gates), with the blocking gate if any.
      render: (employee) => <ServiceEligibilityStatus employee={employee} compact />,
    },
    {
      key: 'joinedOn',
      label: copy('Join date'),
      render: (employee) => formatJoinedOn(employee.joinedOn, formatDate, copy),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (employee) => <EmployeeStatusBadge status={employee.status} />,
    },
  ];
  const nextStatus = statusTarget?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

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
            <DTabsTrigger value="attendance">{copy('Attendance')}</DTabsTrigger>
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
                show: (employee) => canUpdate && employee.status === 'ACTIVE',
              },
              {
                label: copy('Activate employee'),
                icon: <CircleCheck className="size-4" />,
                onClick: openStatusChange,
                show: (employee) => canUpdate && employee.status === 'INACTIVE',
              },
            ]}
          />
        </DTabsContent>

        <DTabsContent value="positions" className="mt-4">
          <PositionsPanel api={api} canCreate={canCreate} canUpdate={canUpdate} />
        </DTabsContent>

        {attendanceEnabled ? (
          <DTabsContent value="attendance" className="mt-4">
            <AttendancePanel api={api} canManage={canManageAttendance} />
          </DTabsContent>
        ) : null}
      </DTabs>

      {editorId !== null ? (
        <EmployeeEditorDialog
          key={editorId === 'create' ? 'create' : `${editorId}:${detail.data?.id ?? 'loading'}`}
          employee={editorId === 'create' ? null : detail.data}
          isLoading={editorId !== 'create' && detail.isLoading}
          isError={editorId !== 'create' && detail.isError}
          api={api}
          onClose={() => setEditorId(null)}
          onSaved={refresh}
        />
      ) : null}

      <EmployeeDetailDialog
        key={detailId ?? 'employee-detail'}
        open={detailId !== null}
        employee={detailId ? detail.data : undefined}
        isLoading={Boolean(detailId && detail.isLoading)}
        isError={Boolean(detailId && detail.isError)}
        api={api}
        attendanceEnabled={attendanceEnabled}
        onClose={() => setDetailId(null)}
        {...(canUpdate
          ? {
              onEdit: (employee: Employee) => {
                setDetailId(null);
                setEditorId(employee.id);
              },
            }
          : {})}
      />

      <DDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={copy(nextStatus === 'INACTIVE' ? 'Deactivate employee?' : 'Reactivate employee?')}
        description={
          nextStatus === 'INACTIVE'
            ? copy(
                'This employee remains in historical records but cannot be selected for new POS assignments.',
              )
            : copy('This employee can be selected for POS assignments again.')
        }
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setStatusTarget(null)}>
              {copy('Cancel')}
            </DButton>
            <DButton
              variant={nextStatus === 'INACTIVE' ? 'danger' : 'primary'}
              onClick={() => void updateStatus()}
            >
              {copy(nextStatus === 'INACTIVE' ? 'Deactivate' : 'Reactivate')}
            </DButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-(--radius-card) bg-(--color-surface-muted) p-4">
            <p className="font-semibold">{statusTarget?.displayName}</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {[statusTarget?.code, statusTarget?.position?.name].filter(Boolean).join(' · ')}
            </p>
          </div>
          <DTextarea
            label={copy('Reason')}
            value={statusReason}
            onChange={setStatusReason}
            hint={copy('Reason is optional and will be recorded in employee history.')}
            placeholder={copy('Optional reason for this status change')}
          />
        </div>
      </DDialog>
    </BackofficePage>
  );
}

function formatJoinedOn(
  joinedOn: string | null,
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string,
  copy: (value: string) => string,
) {
  return joinedOn
    ? formatDate(new Date(`${joinedOn}T00:00:00`), {
        dateStyle: 'medium',
      })
    : copy('Not set');
}
