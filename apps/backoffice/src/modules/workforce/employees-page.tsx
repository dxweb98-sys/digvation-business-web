import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DDataTable,
  DDatePicker,
  DDialog,
  DInput,
  DSkeleton,
  DStatusFilter,
  DTextarea,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Eye, Pencil, Plus, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  EmployeesApi,
  type Employee,
  type EmployeeDetail,
  type EmployeeStatusHistoryEntry,
} from './employees-api';

const defaultPageSize = 20;
const employeeKey = ['employees'] as const;

const employeeCopy: Record<string, { id: string; en: string }> = {
  Position: { id: 'Jabatan', en: 'Position' },
  'Employee profile': { id: 'Profil karyawan', en: 'Employee profile' },
  'Employment information': { id: 'Informasi kepegawaian', en: 'Employment information' },
  'Lifecycle history': { id: 'Riwayat status', en: 'Lifecycle history' },
  'Status changes remain auditable and do not remove historical employee references.': {
    id: 'Perubahan status tetap dapat diaudit dan tidak menghapus referensi historis karyawan.',
    en: 'Status changes remain auditable and do not remove historical employee references.',
  },
  'System information': { id: 'Informasi sistem', en: 'System information' },
  'Record version': { id: 'Versi data', en: 'Record version' },
  'For example, Supervisor, Manager, or Staff': {
    id: 'Contoh: Supervisor, Manajer, atau Staf',
    en: 'For example, Supervisor, Manager, or Staff',
  },
  'Position is descriptive for now. Service assignment and contribution rules remain configured on service catalog items.': {
    id: 'Jabatan saat ini bersifat deskriptif. Aturan penugasan jasa dan kontribusi tetap dikonfigurasi pada item jasa di katalog.',
    en: 'Position is descriptive for now. Service assignment and contribution rules remain configured on service catalog items.',
  },
  'Position not set': { id: 'Jabatan belum diatur', en: 'Position not set' },
};

function useEmployeeLocalization() {
  const localization = useBackofficeLocalization();
  const copy = (value: string) =>
    employeeCopy[value]?.[localization.locale] ?? localization.copy(value);
  return { ...localization, copy };
}

export function EmployeesPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy, formatDate } = useEmployeeLocalization();
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
  const employees = useQuery({
    queryKey: [...employeeKey, q, status, offset, pageSize],
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
      handleMutationError(error, refresh, copy, showToast, () => setStatusTarget(null));
    }
  };

  if (!session) return null;

  const columns: TableColumn<Employee>[] = [
    { key: 'code', label: copy('Employee code') },
    { key: 'displayName', label: copy('Display name') },
    {
      key: 'position',
      label: copy('Position'),
      render: (employee) => employee.position || copy('Not set'),
    },
    {
      key: 'joinedOn',
      label: copy('Join date'),
      render: (employee) => formatJoinedOn(employee.joinedOn, formatDate, copy),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (employee) => <StatusBadge status={employee.status} />,
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

      <section className="mt-6">
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
              <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditorId('create')}>
                {copy('Add employee')}
              </DButton>
            ) : null
          }
          emptyMessage={
            q || status ? copy('No matching employees found.') : copy('No employees are available.')
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
      </section>

      <EmployeeEditor
        open={editorId !== null}
        employee={editorId === 'create' ? null : detail.data}
        isLoading={editorId !== null && editorId !== 'create' && detail.isLoading}
        isError={editorId !== null && editorId !== 'create' && detail.isError}
        api={api}
        onClose={() => setEditorId(null)}
        onSaved={refresh}
      />
      <EmployeeDetailDialog
        open={detailId !== null}
        employee={detailId ? detail.data : undefined}
        isLoading={Boolean(detailId && detail.isLoading)}
        isError={Boolean(detailId && detail.isError)}
        onClose={() => setDetailId(null)}
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
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-4">
            <p className="font-semibold">{statusTarget?.displayName}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {[statusTarget?.code, statusTarget?.position].filter(Boolean).join(' · ')}
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

function StatusBadge({ status }: { status: Employee['status'] }) {
  const { copy } = useEmployeeLocalization();
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
  const { copy } = useEmployeeLocalization();
  const { showToast } = useToast();
  const fresh = employee === null;
  const [code, setCode] = useState(employee?.code ?? '');
  const [displayName, setDisplayName] = useState(employee?.displayName ?? '');
  const [position, setPosition] = useState(employee?.position ?? '');
  const [joinedOn, setJoinedOn] = useState(employee?.joinedOn ?? '');

  useEffect(() => {
    if (employee) {
      setCode(employee.code);
      setDisplayName(employee.displayName);
      setPosition(employee.position ?? '');
      setJoinedOn(employee.joinedOn ?? '');
    } else if (fresh) {
      setCode('');
      setDisplayName('');
      setPosition('');
      setJoinedOn('');
    }
  }, [employee, fresh]);

  const save = async () => {
    if (!displayName.trim()) return;
    try {
      if (fresh) {
        await api.create({
          ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
          displayName: displayName.trim(),
          position: position.trim() || null,
          ...(joinedOn ? { joinedOn } : {}),
        });
      } else if (employee) {
        await api.update(employee, {
          displayName: displayName.trim(),
          position: position.trim() || null,
          joinedOn: joinedOn || null,
        });
      }
      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? copy('Employee added.') : copy('Employee updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        handleMutationError(error, onSaved, copy, showToast, onClose);
    }
  };

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
        <DialogLoading />
      ) : isError ? (
        <DialogLoadError />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <DInput
            label={copy('Employee code')}
            value={code}
            onChange={setCode}
            disabled={!fresh}
            placeholder={copy('Leave Employee Code blank to generate it automatically.')}
            hint={
              fresh ? copy('Leave Employee Code blank to generate it automatically.') : undefined
            }
            autoFocus
          />
          <DInput
            label={copy('Display name')}
            value={displayName}
            onChange={setDisplayName}
            placeholder={copy('For example, Ari Pratama')}
          />
          <DInput
            label={copy('Position')}
            value={position}
            onChange={setPosition}
            placeholder={copy('For example, Supervisor, Manager, or Staff')}
            hint={copy(
              'Position is descriptive for now. Service assignment and contribution rules remain configured on service catalog items.',
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

function EmployeeDetailDialog({
  open,
  employee,
  isLoading,
  isError,
  onClose,
}: {
  open: boolean;
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) {
  const { copy, formatDate } = useEmployeeLocalization();

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={copy('Employee details')}
      description={employee ? `${employee.code} · ${employee.position || copy('Position not set')}` : undefined}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {isLoading ? (
        <DialogLoading />
      ) : isError ? (
        <DialogLoadError />
      ) : (
        employee && (
          <div className="space-y-5">
            <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                    <UserRound aria-hidden="true" className="size-5 text-[var(--color-text-muted)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                      {copy('Employee profile')}
                    </p>
                    <h2 className="mt-1 break-words text-xl font-semibold tracking-tight">
                      {employee.displayName}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {employee.code}
                    </p>
                  </div>
                </div>
                <StatusBadge status={employee.status} />
              </div>

              <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
                <SummaryFact label={copy('Position')} value={employee.position || copy('Not set')} />
                <SummaryFact
                  label={copy('Join date')}
                  value={formatJoinedOn(employee.joinedOn, formatDate, copy)}
                />
                <SummaryFact label={copy('Tenure')} value={formatTenure(employee.joinedOn, copy)} />
              </div>
            </section>

            <DetailCard
              title={copy('Employment information')}
              description={copy(
                'Position is descriptive for now. Service assignment and contribution rules remain configured on service catalog items.',
              )}
            >
              <DetailGrid>
                <Field label={copy('Employee code')} value={employee.code} />
                <Field label={copy('Display name')} value={employee.displayName} />
                <Field label={copy('Position')} value={employee.position || copy('Not set')} />
                <Field
                  label={copy('Current status')}
                  value={<StatusBadge status={employee.status} />}
                />
                <Field
                  label={copy('Join date')}
                  value={formatJoinedOn(employee.joinedOn, formatDate, copy)}
                />
                <Field label={copy('Tenure')} value={formatTenure(employee.joinedOn, copy)} />
              </DetailGrid>
            </DetailCard>

            <DetailCard
              title={copy('Lifecycle history')}
              description={copy(
                'Status changes remain auditable and do not remove historical employee references.',
              )}
            >
              <LifecycleHistory employee={employee} copy={copy} formatDate={formatDate} />
            </DetailCard>

            <DetailCard title={copy('System information')}>
              <DetailGrid>
                <Field
                  label={copy('Created')}
                  value={formatDate(new Date(employee.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
                <Field
                  label={copy('Updated')}
                  value={formatDate(new Date(employee.updatedAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
                <Field label={copy('Record version')} value={String(employee.version)} />
              </DetailGrid>
            </DetailCard>
          </div>
        )
      )}
    </DDialog>
  );
}

function DialogLoading() {
  const { copy } = useEmployeeLocalization();
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm text-[var(--color-text-muted)]">{copy('Loading...')}</p>
      <DSkeleton className="h-20 w-full" />
      <DSkeleton className="h-28 w-full" />
    </div>
  );
}

function DialogLoadError() {
  const { copy } = useEmployeeLocalization();
  return (
    <p className="text-sm text-[var(--color-text-muted)]">
      {copy('Could not load employee details.')}
    </p>
  );
}

function LifecycleHistory({
  employee,
  copy,
  formatDate,
}: {
  employee: EmployeeDetail;
  copy: (value: string) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
}) {
  const events = lifecycleEvents(employee).sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
  const columns: TableColumn<LifecycleEvent>[] = [
    {
      key: 'event',
      label: copy('Event'),
      render: (event) =>
        copy(
          event.event === 'JOINED'
            ? 'Joined'
            : event.event === 'DEACTIVATED'
              ? 'Deactivated'
              : 'Reactivated',
        ),
    },
    {
      key: 'occurredAt',
      label: copy('Date / Time'),
      render: (event) =>
        formatDate(new Date(event.occurredAt), {
          dateStyle: 'medium',
          timeStyle: event.event === 'JOINED' ? undefined : 'short',
        }),
    },
    {
      key: 'reason',
      label: copy('Reason'),
      render: (event) => event.reason ?? copy('Not set'),
    },
    {
      key: 'actor',
      label: copy('Changed by'),
      render: (event) =>
        event.actorId
          ? `${copy(event.actorKind === 'machine' ? 'Machine' : 'User')} · ${event.actorId}`
          : copy('Not set'),
    },
  ];
  return (
    <DDataTable
      columns={columns}
      data={events}
      rowKey="id"
      emptyMessage={copy('No employee history is available.')}
    />
  );
}

interface LifecycleEvent {
  id: string;
  event: 'JOINED' | 'DEACTIVATED' | 'REACTIVATED';
  occurredAt: string;
  reason: string | null;
  actorId: string | null;
  actorKind: string | null;
}

function lifecycleEvents(employee: EmployeeDetail): LifecycleEvent[] {
  const joined = employee.joinedOn
    ? [
        {
          id: `joined-${employee.id}`,
          event: 'JOINED' as const,
          occurredAt: `${employee.joinedOn}T00:00:00`,
          reason: null,
          actorId: null,
          actorKind: null,
        },
      ]
    : [];
  return [...joined, ...employee.statusHistory.map(historyEvent)];
}

function historyEvent(entry: EmployeeStatusHistoryEntry): LifecycleEvent {
  return {
    id: entry.id,
    event: entry.newStatus === 'INACTIVE' ? 'DEACTIVATED' : 'REACTIVATED',
    occurredAt: entry.transitionedAt,
    reason: entry.reason,
    actorId: entry.actorId,
    actorKind: entry.actorKind,
  };
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function DetailCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function formatJoinedOn(
  joinedOn: string | null,
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string,
  copy: (value: string) => string,
) {
  return joinedOn
    ? formatDate(new Date(`${joinedOn}T00:00:00`), { dateStyle: 'medium' })
    : copy('Not set');
}

function formatTenure(joinedOn: string | null, copy: (value: string) => string) {
  if (!joinedOn) return copy('Not set');
  const [year = 0, month = 0, day = 0] = joinedOn.split('-').map(Number);
  const joined = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (joined > today) return copy('Not set');
  let years = today.getFullYear() - joined.getFullYear();
  let cursor = addCalendarMonths(joined, years * 12);
  if (cursor > today) {
    years -= 1;
    cursor = addCalendarMonths(joined, years * 12);
  }
  let months =
    (today.getFullYear() - cursor.getFullYear()) * 12 + today.getMonth() - cursor.getMonth();
  cursor = addCalendarMonths(cursor, months);
  if (cursor > today) {
    months -= 1;
    cursor = addCalendarMonths(cursor, months);
  }
  const days = Math.round((today.getTime() - cursor.getTime()) / 86_400_000);
  const parts = [
    years && `${years} ${copy(years === 1 ? 'year' : 'years')}`,
    months && `${months} ${copy(months === 1 ? 'month' : 'months')}`,
    days && `${days} ${copy(days === 1 ? 'day' : 'days')}`,
  ].filter(Boolean);
  return parts.join(' ') || `0 ${copy('days')}`;
}

function addCalendarMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(date.getDate(), new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()),
  );
}

function handleMutationError(
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
