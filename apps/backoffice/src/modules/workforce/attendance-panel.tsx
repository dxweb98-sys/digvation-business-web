import {
  DBadge,
  DButton,
  DDataTable,
  DDatePicker,
  DDialog,
  DSelect,
  DTextarea,
  DTimePicker,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Clock3,
  History as HistoryIcon,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import {
  type AttendanceStatus,
  type Employee,
  type EmployeeAttendance,
  type EmployeePosition,
  EmployeesApi,
} from './employees-api';
import { useWorkforceLocalization } from './workforce-localization';

const attendanceKey = ['employees', 'attendance'] as const;
const employeesKey = ['employees', 'attendance-roster'] as const;
const directoryKey = ['employees', 'attendance-directory'] as const;
const positionsKey = ['employees', 'attendance-positions'] as const;
const historyKey = ['employees', 'attendance-history'] as const;
const PAGE_BATCH_SIZE = 100;

type HistoryPeriodMode = 'DAY' | 'MONTH' | 'RANGE';
type HistoryStatusFilter = 'ALL' | AttendanceStatus;

type HistoryRange = {
  from: string;
  to: string;
};

export function AttendancePanel({
  api,
  canManage,
}: {
  api: EmployeesApi;
  canManage: boolean;
}) {
  const { copy, formatDate, locale } = useWorkforceLocalization();
  const today = localDateKey(new Date());
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState('');
  const [positionId, setPositionId] = useState('ALL');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [target, setTarget] = useState<Employee | null>(null);

  const [historyMode, setHistoryMode] = useState<HistoryPeriodMode>('MONTH');
  const [historyDay, setHistoryDay] = useState(today);
  const [historyMonth, setHistoryMonth] = useState(today.slice(0, 7));
  const [historyFrom, setHistoryFrom] = useState(startOfMonth(today));
  const [historyTo, setHistoryTo] = useState(today);
  const [historyEmployeeId, setHistoryEmployeeId] = useState('ALL');
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>('ALL');
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(20);

  const employeeDirectory = useQuery({
    queryKey: directoryKey,
    queryFn: () => loadAllEmployees(api),
  });
  const positions = useQuery({
    queryKey: positionsKey,
    queryFn: () => loadAllPositions(api),
  });
  const employees = useQuery({
    queryKey: [...employeesKey, query, positionId, offset, pageSize],
    queryFn: () =>
      api.list({
        status: 'ACTIVE',
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(positionId !== 'ALL' ? { positionId } : {}),
        limit: pageSize,
        offset,
      }),
  });
  const attendance = useQuery({
    queryKey: [...attendanceKey, 'daily', date],
    queryFn: () => loadAllAttendance(api, { from: date, to: date }),
  });

  const activeEmployeeIds = useMemo(
    () =>
      new Set(
        (employeeDirectory.data ?? [])
          .filter((employee) => employee.status === 'ACTIVE')
          .map((employee) => employee.id),
      ),
    [employeeDirectory.data],
  );
  const dailyAttendance = useMemo(
    () =>
      (attendance.data ?? []).filter((record) =>
        activeEmployeeIds.has(record.employeeId),
      ),
    [activeEmployeeIds, attendance.data],
  );
  const attendanceByEmployee = useMemo(
    () =>
      new Map(dailyAttendance.map((record) => [record.employeeId, record])),
    [dailyAttendance],
  );
  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LEAVE: 0,
      SICK: 0,
    };
    for (const record of dailyAttendance) result[record.status] += 1;
    return result;
  }, [dailyAttendance]);
  const unsetCount = Math.max(
    0,
    activeEmployeeIds.size - dailyAttendance.length,
  );

  const historyRange = useMemo(
    () =>
      resolveHistoryRange({
        mode: historyMode,
        day: historyDay,
        month: historyMonth,
        from: historyFrom,
        to: historyTo,
      }),
    [historyDay, historyFrom, historyMode, historyMonth, historyTo],
  );
  const history = useQuery({
    queryKey: [
      ...historyKey,
      historyRange.from,
      historyRange.to,
      historyEmployeeId,
      historyStatus,
      historyOffset,
      historyPageSize,
    ],
    queryFn: () =>
      api.listAttendance({
        from: historyRange.from,
        to: historyRange.to,
        ...(historyEmployeeId !== 'ALL'
          ? { employeeId: historyEmployeeId }
          : {}),
        ...(historyStatus !== 'ALL' ? { status: historyStatus } : {}),
        limit: historyPageSize,
        offset: historyOffset,
      }),
  });
  const historyCounts = useQuery({
    queryKey: [
      ...historyKey,
      'counts',
      historyRange.from,
      historyRange.to,
      historyEmployeeId,
    ],
    queryFn: async () => {
      const statuses: AttendanceStatus[] = [
        'PRESENT',
        'ABSENT',
        'LEAVE',
        'SICK',
      ];
      const pages = await Promise.all(
        statuses.map((status) =>
          api.listAttendance({
            from: historyRange.from,
            to: historyRange.to,
            ...(historyEmployeeId !== 'ALL'
              ? { employeeId: historyEmployeeId }
              : {}),
            status,
            limit: 1,
            offset: 0,
          }),
        ),
      );
      return statuses.reduce<Record<AttendanceStatus, number>>(
        (result, status, index) => {
          result[status] = pages[index]?.total ?? 0;
          return result;
        },
        { PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0 },
      );
    },
  });

  const employeeById = useMemo(
    () =>
      new Map(
        (employeeDirectory.data ?? []).map((employee) => [
          employee.id,
          employee,
        ]),
      ),
    [employeeDirectory.data],
  );
  const positionOptions = useMemo(
    () => [
      { value: 'ALL', label: copy('All positions') },
      ...(positions.data ?? [])
        .filter((position) => position.status === 'ACTIVE')
        .map((position) => ({ value: position.id, label: position.name })),
    ],
    [copy, positions.data],
  );
  const employeeOptions = useMemo(
    () => [
      { value: 'ALL', label: copy('All employees') },
      ...(employeeDirectory.data ?? [])
        .slice()
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        )
        .map((employee) => ({
          value: employee.id,
          label: `${employee.displayName} · ${employee.code}`,
        })),
    ],
    [copy, employeeDirectory.data],
  );
  const monthOptions = useMemo(
    () => createMonthOptions(locale === 'id' ? 'id-ID' : 'en-US'),
    [locale],
  );

  const columns: TableColumn<Employee>[] = [
    { key: 'code', label: copy('Employee code') },
    { key: 'displayName', label: copy('Display name') },
    {
      key: 'position',
      label: copy('Position'),
      render: (employee) => employee.position?.name ?? copy('Not set'),
    },
    {
      key: 'attendance',
      label: copy('Attendance status'),
      render: (employee) => {
        const record = attendanceByEmployee.get(employee.id);
        return record ? (
          <AttendanceBadge status={record.status} />
        ) : (
          copy('Not set')
        );
      },
    },
    {
      key: 'time',
      label: copy('Check in'),
      render: (employee) => {
        const record = attendanceByEmployee.get(employee.id);
        return record?.checkInAt
          ? formatDate(new Date(record.checkInAt), { timeStyle: 'short' })
          : copy('Not set');
      },
    },
    {
      key: 'source',
      label: copy('Source'),
      render: (employee) => {
        const source = attendanceByEmployee.get(employee.id)?.source;
        return source
          ? copy(source === 'LOCAL' ? 'Local' : 'HRIS')
          : copy('Not set');
      },
    },
  ];

  const historyColumns: TableColumn<EmployeeAttendance>[] = [
    {
      key: 'attendanceDate',
      label: copy('Attendance date'),
      render: (record) =>
        formatDate(new Date(`${record.attendanceDate}T00:00:00`)),
    },
    {
      key: 'employee',
      label: copy('Employee'),
      render: (record) => {
        const employee = employeeById.get(record.employeeId);
        return employee ? (
          <div>
            <p className="font-medium text-[var(--color-text)]">
              {employee.displayName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {employee.code}
            </p>
          </div>
        ) : (
          record.employeeId
        );
      },
    },
    {
      key: 'position',
      label: copy('Position'),
      render: (record) =>
        employeeById.get(record.employeeId)?.position?.name ?? copy('Not set'),
    },
    {
      key: 'status',
      label: copy('Attendance status'),
      render: (record) => <AttendanceBadge status={record.status} />,
    },
    {
      key: 'checkInAt',
      label: copy('Check in'),
      render: (record) =>
        record.checkInAt
          ? formatDate(new Date(record.checkInAt), { timeStyle: 'short' })
          : '—',
    },
    {
      key: 'checkOutAt',
      label: copy('Check out'),
      render: (record) =>
        record.checkOutAt
          ? formatDate(new Date(record.checkOutAt), { timeStyle: 'short' })
          : '—',
    },
    {
      key: 'source',
      label: copy('Source'),
      render: (record) => copy(record.source === 'LOCAL' ? 'Local' : 'HRIS'),
    },
  ];

  const resetDailyFilters = () => {
    setDate(localDateKey(new Date()));
    setQuery('');
    setPositionId('ALL');
    setOffset(0);
  };
  const resetHistoryFilters = () => {
    const current = localDateKey(new Date());
    setHistoryMode('MONTH');
    setHistoryDay(current);
    setHistoryMonth(current.slice(0, 7));
    setHistoryFrom(startOfMonth(current));
    setHistoryTo(current);
    setHistoryEmployeeId('ALL');
    setHistoryStatus('ALL');
    setHistoryOffset(0);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[var(--color-text)]">
                <CalendarDays className="size-4" aria-hidden="true" />
                <h3 className="text-sm font-semibold">
                  {copy('Attendance summary')}
                </h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {copy(
                  'Review the daily roster, find an employee quickly, and record attendance without leaving this view.',
                )}
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_auto]">
              <DDatePicker
                label={copy('Attendance date')}
                value={date}
                onChange={(value) => {
                  if (value) {
                    setDate(value);
                    setOffset(0);
                  }
                }}
                variant="date"
              />
              <DSelect
                label={copy('Position')}
                value={positionId}
                clearable={false}
                options={positionOptions}
                onValueChange={(value) => {
                  setPositionId(value);
                  setOffset(0);
                }}
              />
              <div className="self-end">
                <DButton
                  variant="secondary"
                  leftIcon={<RotateCcw className="size-4" />}
                  onClick={resetDailyFilters}
                >
                  {copy('Reset filters')}
                </DButton>
              </div>
            </div>
          </div>

          <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy(
              'Attendance is recorded by authorized supervisors or managers. HRIS-sourced records remain read-only locally.',
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AttendanceStat label={copy('Present')} value={counts.PRESENT} />
          <AttendanceStat label={copy('Absent')} value={counts.ABSENT} />
          <AttendanceStat label={copy('Leave')} value={counts.LEAVE} />
          <AttendanceStat label={copy('Sick')} value={counts.SICK} />
          <AttendanceStat label={copy('Not set')} value={unsetCount} />
        </div>

        <DDataTable
          columns={columns}
          data={employees.data?.items ?? []}
          loading={
            employees.isLoading ||
            attendance.isLoading ||
            employeeDirectory.isLoading
          }
          rowKey="id"
          searchable
          searchPlaceholder={copy('Search employee code or name...')}
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setOffset(0);
          }}
          emptyMessage={
            query || positionId !== 'ALL'
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
              label: copy('Record attendance'),
              icon: <Clock3 className="size-4" />,
              onClick: (employee) => setTarget(employee),
              show: (employee) =>
                canManage && !attendanceByEmployee.has(employee.id),
            },
            {
              label: copy('Edit attendance'),
              icon: <Pencil className="size-4" />,
              onClick: (employee) => setTarget(employee),
              show: (employee) =>
                canManage &&
                attendanceByEmployee.get(employee.id)?.source === 'LOCAL',
            },
          ]}
        />
      </section>

      <section className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text)]">
            <HistoryIcon className="size-4" aria-hidden="true" />
            <h3 className="text-base font-semibold">
              {copy('Attendance history')}
            </h3>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy(
              'Review attendance history by day, month, or a custom date range.',
            )}
          </p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DSelect
              label={copy('Period')}
              value={historyMode}
              clearable={false}
              options={[
                { value: 'DAY', label: copy('Daily') },
                { value: 'MONTH', label: copy('Monthly') },
                { value: 'RANGE', label: copy('Date range') },
              ]}
              onValueChange={(value) => {
                setHistoryMode(value as HistoryPeriodMode);
                setHistoryOffset(0);
              }}
            />

            {historyMode === 'DAY' ? (
              <DDatePicker
                label={copy('Attendance date')}
                value={historyDay}
                onChange={(value) => {
                  if (value) {
                    setHistoryDay(value);
                    setHistoryOffset(0);
                  }
                }}
                variant="date"
              />
            ) : null}

            {historyMode === 'MONTH' ? (
              <DSelect
                label={copy('Month')}
                value={historyMonth}
                clearable={false}
                options={monthOptions}
                onValueChange={(value) => {
                  setHistoryMonth(value);
                  setHistoryOffset(0);
                }}
              />
            ) : null}

            {historyMode === 'RANGE' ? (
              <>
                <DDatePicker
                  label={copy('From date')}
                  value={historyFrom}
                  onChange={(value) => {
                    if (!value) return;
                    setHistoryFrom(value);
                    if (value > historyTo) setHistoryTo(value);
                    setHistoryOffset(0);
                  }}
                  variant="date"
                />
                <DDatePicker
                  label={copy('To date')}
                  value={historyTo}
                  onChange={(value) => {
                    if (!value) return;
                    setHistoryTo(value);
                    if (value < historyFrom) setHistoryFrom(value);
                    setHistoryOffset(0);
                  }}
                  variant="date"
                />
              </>
            ) : null}

            <DSelect
              label={copy('Employee')}
              value={historyEmployeeId}
              clearable={false}
              options={employeeOptions}
              onValueChange={(value) => {
                setHistoryEmployeeId(value);
                setHistoryOffset(0);
              }}
            />

            <DSelect
              label={copy('Attendance status')}
              value={historyStatus}
              clearable={false}
              options={[
                { value: 'ALL', label: copy('All statuses') },
                { value: 'PRESENT', label: copy('Present') },
                { value: 'ABSENT', label: copy('Absent') },
                { value: 'LEAVE', label: copy('Leave') },
                { value: 'SICK', label: copy('Sick') },
              ]}
              onValueChange={(value) => {
                setHistoryStatus(value as HistoryStatusFilter);
                setHistoryOffset(0);
              }}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              {copy(
                'Showing attendance records for the selected period and filters.',
              )}
            </p>
            <DButton
              variant="secondary"
              leftIcon={<RotateCcw className="size-4" />}
              onClick={resetHistoryFilters}
            >
              {copy('Reset filters')}
            </DButton>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AttendanceStat
            label={copy('Present')}
            value={historyCounts.data?.PRESENT ?? 0}
          />
          <AttendanceStat
            label={copy('Absent')}
            value={historyCounts.data?.ABSENT ?? 0}
          />
          <AttendanceStat
            label={copy('Leave')}
            value={historyCounts.data?.LEAVE ?? 0}
          />
          <AttendanceStat
            label={copy('Sick')}
            value={historyCounts.data?.SICK ?? 0}
          />
        </div>

        <DDataTable
          columns={historyColumns}
          data={history.data?.items ?? []}
          loading={history.isLoading || employeeDirectory.isLoading}
          rowKey="id"
          emptyMessage={copy('No attendance history is available.')}
          pagination={{
            page: Math.floor(historyOffset / historyPageSize) + 1,
            pageSize: historyPageSize,
            total: history.data?.total ?? 0,
          }}
          onPageChange={(page) =>
            setHistoryOffset((page - 1) * historyPageSize)
          }
          onPageSizeChange={(nextPageSize) => {
            setHistoryPageSize(nextPageSize);
            setHistoryOffset(0);
          }}
        />
      </section>

      <AttendanceEditor
        open={target !== null}
        employee={target}
        date={date}
        existing={
          target ? attendanceByEmployee.get(target.id) : undefined
        }
        api={api}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

function AttendanceEditor({
  open,
  employee,
  date,
  existing,
  api,
  onClose,
}: {
  open: boolean;
  employee: Employee | null;
  date: string;
  existing: EmployeeAttendance | undefined;
  api: EmployeesApi;
  onClose: () => void;
}) {
  const { copy } = useWorkforceLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setStatus(existing?.status ?? 'PRESENT');
    setCheckIn(existing?.checkInAt ? localTime(existing.checkInAt) : '');
    setCheckOut(existing?.checkOutAt ? localTime(existing.checkOutAt) : '');
    setNote(existing?.note ?? '');
  }, [existing, employee?.id, date, open]);

  const save = async () => {
    if (!employee) return;
    try {
      await api.upsertAttendance(employee.id, date, {
        status,
        checkInAt:
          status === 'PRESENT' && checkIn ? toIso(date, checkIn) : null,
        checkOutAt:
          status === 'PRESENT' && checkOut ? toIso(date, checkOut) : null,
        note: note.trim() || null,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: attendanceKey }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]);
      showToast({ variant: 'success', title: copy('Attendance saved.') });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not save attendance.'),
          ).safeMessage,
        });
      }
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(existing ? 'Edit attendance' : 'Record attendance')}
      description={
        employee
          ? `${employee.code} · ${employee.displayName} · ${date}`
          : undefined
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void save()}>{copy('Save')}</DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <DSelect
          label={copy('Attendance status')}
          value={status}
          clearable={false}
          options={[
            { value: 'PRESENT', label: copy('Present') },
            { value: 'ABSENT', label: copy('Absent') },
            { value: 'LEAVE', label: copy('Leave') },
            { value: 'SICK', label: copy('Sick') },
          ]}
          onValueChange={(value) =>
            setStatus(value as AttendanceStatus)
          }
        />
        {status === 'PRESENT' ? (
          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <DTimePicker
                label={copy('Check in (optional)')}
                value={checkIn}
                onChange={setCheckIn}
                onClear={() => setCheckIn('')}
              />
              <DTimePicker
                label={copy('Check out (optional)')}
                value={checkOut}
                onChange={setCheckOut}
                onClear={() => setCheckOut('')}
              />
            </div>
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('Check-in and check-out times are optional for now.')}
            </p>
          </div>
        ) : null}
        <DTextarea
          label={copy('Note')}
          value={note}
          onChange={setNote}
          placeholder={copy('Not set')}
        />
      </div>
    </DDialog>
  );
}

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const { copy } = useWorkforceLocalization();
  const label =
    status === 'PRESENT'
      ? 'Present'
      : status === 'ABSENT'
        ? 'Absent'
        : status === 'LEAVE'
          ? 'Leave'
          : 'Sick';
  return (
    <DBadge
      variant={
        status === 'PRESENT'
          ? 'success'
          : status === 'ABSENT'
            ? 'danger'
            : 'secondary'
      }
    >
      {copy(label)}
    </DBadge>
  );
}

function AttendanceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
        {value}
      </p>
    </div>
  );
}

async function loadAllEmployees(api: EmployeesApi) {
  const items: Employee[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const page = await api.list({ limit: PAGE_BATCH_SIZE, offset });
    items.push(...page.items);
    total = page.total;
    if (!page.items.length) break;
    offset += page.items.length;
  }
  return items;
}

async function loadAllPositions(api: EmployeesApi) {
  const items: EmployeePosition[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const page = await api.listPositions({
      limit: PAGE_BATCH_SIZE,
      offset,
    });
    items.push(...page.items);
    total = page.total;
    if (!page.items.length) break;
    offset += page.items.length;
  }
  return items;
}

async function loadAllAttendance(
  api: EmployeesApi,
  filter: { from: string; to: string },
) {
  const items: EmployeeAttendance[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const page = await api.listAttendance({
      ...filter,
      limit: PAGE_BATCH_SIZE,
      offset,
    });
    items.push(...page.items);
    total = page.total;
    if (!page.items.length) break;
    offset += page.items.length;
  }
  return items;
}

function resolveHistoryRange(input: {
  mode: HistoryPeriodMode;
  day: string;
  month: string;
  from: string;
  to: string;
}): HistoryRange {
  if (input.mode === 'DAY') return { from: input.day, to: input.day };
  if (input.mode === 'MONTH') return monthRange(input.month);
  return input.from <= input.to
    ? { from: input.from, to: input.to }
    : { from: input.to, to: input.from };
}

function monthRange(month: string): HistoryRange {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function createMonthOptions(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  });
  const now = new Date();
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: formatter.format(date) };
  });
}

function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}
