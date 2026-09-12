import {
  DBadge,
  DButton,
  DCheckbox,
  DDataTable,
  DDatePicker,
  DDialog,
  DInput,
  DSelect,
  DTextarea,
  DTimePicker,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, History as HistoryIcon, RotateCcw, Users } from 'lucide-react';
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

const directoryKey = ['employees', 'attendance-directory'] as const;
const positionsKey = ['employees', 'attendance-positions'] as const;
const historyKey = ['employees', 'attendance-history'] as const;
const adjustmentKey = ['employees', 'attendance-adjustment'] as const;
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
  const [historyMode, setHistoryMode] = useState<HistoryPeriodMode>('MONTH');
  const [historyDay, setHistoryDay] = useState(today);
  const [historyMonth, setHistoryMonth] = useState(today.slice(0, 7));
  const [historyFrom, setHistoryFrom] = useState(startOfMonth(today));
  const [historyTo, setHistoryTo] = useState(today);
  const [historyEmployeeId, setHistoryEmployeeId] = useState('ALL');
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>('ALL');
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

  const employeeDirectory = useQuery({
    queryKey: directoryKey,
    queryFn: () => loadAllEmployees(api),
  });
  const positions = useQuery({
    queryKey: positionsKey,
    queryFn: () => loadAllPositions(api),
  });

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
      const statuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'SICK'];
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
        (employeeDirectory.data ?? []).map((employee) => [employee.id, employee]),
      ),
    [employeeDirectory.data],
  );
  const employeeOptions = useMemo(
    () => [
      { value: 'ALL', label: copy('All employees') },
      ...(employeeDirectory.data ?? [])
        .slice()
        .sort((left, right) => left.displayName.localeCompare(right.displayName))
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

  const historyColumns: TableColumn<EmployeeAttendance>[] = [
    {
      key: 'attendanceDate',
      label: copy('Attendance date'),
      render: (record) => formatDate(new Date(`${record.attendanceDate}T00:00:00`)),
    },
    {
      key: 'employee',
      label: copy('Employee'),
      render: (record) => {
        const employee = employeeById.get(record.employeeId);
        return employee ? (
          <div>
            <p className="font-medium text-[var(--color-text)]">{employee.displayName}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{employee.code}</p>
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

  const counts = historyCounts.data ?? {
    PRESENT: 0,
    ABSENT: 0,
    LEAVE: 0,
    SICK: 0,
  };
  const totalRecords = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.SICK;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--color-text)]">
            <HistoryIcon className="size-4" aria-hidden="true" />
            <h3 className="text-base font-semibold">{copy('Attendance history')}</h3>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            {copy('Review attendance history by day, month, or a custom date range.')}
          </p>
        </div>
        {canManage ? (
          <DButton
            leftIcon={<Clock3 className="size-4" />}
            onClick={() => setAdjustmentOpen(true)}
          >
            {copy('Adjust attendance')}
          </DButton>
        ) : null}
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

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text)]">
              {totalRecords} {copy('attendance records')}
            </span>
            <span aria-hidden="true">·</span>
            <span>{copy('Present')} {counts.PRESENT}</span>
            <span aria-hidden="true">·</span>
            <span>{copy('Absent')} {counts.ABSENT}</span>
            <span aria-hidden="true">·</span>
            <span>{copy('Leave')} {counts.LEAVE}</span>
            <span aria-hidden="true">·</span>
            <span>{copy('Sick')} {counts.SICK}</span>
          </div>
          <DButton
            variant="secondary"
            leftIcon={<RotateCcw className="size-4" />}
            onClick={resetHistoryFilters}
          >
            {copy('Reset filters')}
          </DButton>
        </div>
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
        onPageChange={(page) => setHistoryOffset((page - 1) * historyPageSize)}
        onPageSizeChange={(nextPageSize) => {
          setHistoryPageSize(nextPageSize);
          setHistoryOffset(0);
        }}
      />

      <AttendanceAdjustmentDialog
        open={adjustmentOpen}
        api={api}
        employees={employeeDirectory.data ?? []}
        positions={positions.data ?? []}
        onClose={() => setAdjustmentOpen(false)}
      />
    </div>
  );
}

function AttendanceAdjustmentDialog({
  open,
  api,
  employees,
  positions,
  onClose,
}: {
  open: boolean;
  api: EmployeesApi;
  employees: Employee[];
  positions: EmployeePosition[];
  onClose: () => void;
}) {
  const { copy } = useWorkforceLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const today = localDateKey(new Date());
  const [date, setDate] = useState(today);
  const [query, setQuery] = useState('');
  const [positionId, setPositionId] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const attendance = useQuery({
    queryKey: [...adjustmentKey, date],
    queryFn: () => loadAllAttendance(api, { from: date, to: date }),
    enabled: open,
  });
  const attendanceByEmployee = useMemo(
    () => new Map((attendance.data ?? []).map((record) => [record.employeeId, record])),
    [attendance.data],
  );
  const filteredEmployees = useMemo(() => {
    const search = query.trim().toLowerCase();
    return employees
      .filter((employee) => employee.status === 'ACTIVE')
      .filter((employee) => positionId === 'ALL' || employee.positionId === positionId)
      .filter((employee) =>
        !search
          ? true
          : `${employee.code} ${employee.displayName} ${employee.position?.name ?? ''}`
              .toLowerCase()
              .includes(search),
      )
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [employees, positionId, query]);
  const selectableEmployees = attendance.isSuccess
    ? filteredEmployees.filter(
        (employee) => attendanceByEmployee.get(employee.id)?.source !== 'HRIS',
      )
    : [];
  const positionOptions = [
    { value: 'ALL', label: copy('All positions') },
    ...positions
      .filter((position) => position.status === 'ACTIVE')
      .map((position) => ({ value: position.id, label: position.name })),
  ];

  useEffect(() => {
    if (!open) return;
    setDate(today);
    setQuery('');
    setPositionId('ALL');
    setSelectedIds(new Set());
    setStatus('PRESENT');
    setCheckIn('');
    setCheckOut('');
    setNote('');
  }, [open, today]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [date]);

  const toggleEmployee = (employeeId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const selectVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      selectableEmployees.forEach((employee) => next.add(employee.id));
      return next;
    });
  };

  const save = async () => {
    if (!selectedIds.size || saving) return;
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map((employeeId) => {
          const existing = attendanceByEmployee.get(employeeId);
          const sameStatus = existing?.status === status;
          return api.upsertAttendance(employeeId, date, {
            status,
            checkInAt:
              status !== 'PRESENT'
                ? null
                : checkIn
                  ? toIso(date, checkIn)
                  : sameStatus
                    ? (existing?.checkInAt ?? null)
                    : null,
            checkOutAt:
              status !== 'PRESENT'
                ? null
                : checkOut
                  ? toIso(date, checkOut)
                  : sameStatus
                    ? (existing?.checkOutAt ?? null)
                    : null,
            note: note.trim() || (sameStatus ? (existing?.note ?? null) : null),
          });
        }),
      );
      const failed = results.filter((result) => result.status === 'rejected').length;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: historyKey }),
        queryClient.invalidateQueries({ queryKey: adjustmentKey }),
      ]);
      if (failed === 0) {
        showToast({ variant: 'success', title: copy('Attendance adjustment saved.') });
        onClose();
      } else {
        showToast({
          variant: 'danger',
          title: `${selectedIds.size - failed}/${selectedIds.size} ${copy('employees updated')}`,
        });
      }
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={copy('Adjust attendance')}
      description={copy('Select one or more employees, then apply the same attendance adjustment.')}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton loading={saving} disabled={!selectedIds.size} onClick={() => void save()}>
            {`${copy('Save')} (${selectedIds.size})`}
          </DButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <DDatePicker
            label={copy('Attendance date')}
            value={date}
            onChange={(value) => value && setDate(value)}
            variant="date"
          />
          <DSelect
            label={copy('Position')}
            value={positionId}
            clearable={false}
            options={positionOptions}
            onValueChange={setPositionId}
          />
        </div>

        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <DInput
                label={copy('Search employee code or name')}
                value={query}
                onChange={setQuery}
                placeholder={copy('Search employee code or name...')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <DButton variant="secondary" disabled={!selectableEmployees.length} onClick={selectVisible}>
                {copy('Select visible')}
              </DButton>
              {selectedIds.size ? (
                <DButton variant="secondary" onClick={() => setSelectedIds(new Set())}>
                  {copy('Clear selection')}
                </DButton>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Users className="size-4" aria-hidden="true" />
            <span>
              {selectedIds.size} {copy('employees selected')}
            </span>
          </div>

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {filteredEmployees.length ? (
              filteredEmployees.map((employee) => {
                const existing = attendanceByEmployee.get(employee.id);
                const readOnly = existing?.source === 'HRIS';
                const selectionDisabled = !attendance.isSuccess || readOnly;
                const selected = selectedIds.has(employee.id);
                return (
                  <label
                    key={employee.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectionDisabled
                        ? 'cursor-not-allowed border-[var(--color-border)] opacity-60'
                        : selected
                          ? 'cursor-pointer border-[var(--color-brand)] bg-[var(--color-surface)]'
                          : 'cursor-pointer border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]'
                    }`}
                  >
                    <DCheckbox
                      className="mt-1"
                      checked={selected}
                      disabled={selectionDisabled}
                      onChange={() => toggleEmployee(employee.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--color-text)]">
                          {employee.displayName}
                        </span>
                        {existing ? <AttendanceBadge status={existing.status} /> : null}
                        {readOnly ? <DBadge variant="secondary">HRIS</DBadge> : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {[employee.code, employee.position?.name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </label>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                {copy('No matching employees found.')}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              onValueChange={(value) => setStatus(value as AttendanceStatus)}
            />
          </div>

          {status === 'PRESENT' ? (
            <div className="mt-4 space-y-2">
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

          <div className="mt-4">
            <DTextarea
              label={copy('Note')}
              value={note}
              onChange={setNote}
              placeholder={copy('Not set')}
            />
          </div>
        </div>
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
    const page = await api.listPositions({ limit: PAGE_BATCH_SIZE, offset });
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

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}
