import {
  DBadge,
  DButton,
  DDataTable,
  DDatePicker,
  DDialog,
  DRangeDatePicker,
  DSelect,
  DSkeleton,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

import type {
  EmployeesApi,
  AttendanceStatus,
  Employee,
  EmployeeAttendance,
  EmployeeDetail,
  EmployeeStatusHistoryEntry,
} from './employees-api';
import { AttendanceBadge } from './attendance-panel';
import { useWorkforceLocalization } from './workforce-localization';

type AttendancePeriodMode = 'DAY' | 'MONTH' | 'RANGE';
type AttendanceStatusFilter = 'ALL' | AttendanceStatus;

const attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'SICK'];

export function EmployeeDetailDialog({
  open,
  employee,
  isLoading,
  isError,
  api,
  attendanceEnabled,
  onClose,
}: {
  open: boolean;
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  api: EmployeesApi;
  attendanceEnabled: boolean;
  onClose: () => void;
}) {
  const { copy, formatDate, locale } = useWorkforceLocalization();
  const today = dateKey(new Date());
  const [attendanceMode, setAttendanceMode] = useState<AttendancePeriodMode>('MONTH');
  const [attendanceDay, setAttendanceDay] = useState(today);
  const [attendanceMonth, setAttendanceMonth] = useState(today.slice(0, 7));
  const [attendanceFrom, setAttendanceFrom] = useState(startOfMonth(today));
  const [attendanceTo, setAttendanceTo] = useState(today);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatusFilter>('ALL');
  const [attendanceOffset, setAttendanceOffset] = useState(0);
  const [attendancePageSize, setAttendancePageSize] = useState(20);
  const attendanceRange = useMemo(
    () =>
      resolveAttendanceRange({
        mode: attendanceMode,
        day: attendanceDay,
        month: attendanceMonth,
        from: attendanceFrom,
        to: attendanceTo,
      }),
    [attendanceDay, attendanceFrom, attendanceMode, attendanceMonth, attendanceTo],
  );
  const monthOptions = useMemo(
    () => createMonthOptions(locale === 'id' ? 'id-ID' : 'en-US'),
    [locale],
  );

  const attendance = useQuery({
    queryKey: [
      'employees',
      'detail-attendance',
      employee?.id,
      attendanceRange.from,
      attendanceRange.to,
      attendanceStatus,
      attendanceOffset,
      attendancePageSize,
    ],
    queryFn: () =>
      api.listAttendance({
        employeeId: employee!.id,
        from: attendanceRange.from,
        to: attendanceRange.to,
        ...(attendanceStatus !== 'ALL' ? { status: attendanceStatus } : {}),
        limit: attendancePageSize,
        offset: attendanceOffset,
      }),
    enabled: Boolean(open && employee && attendanceEnabled),
  });

  const attendanceCounts = useQuery({
    queryKey: [
      'employees',
      'detail-attendance',
      'counts',
      employee?.id,
      attendanceRange.from,
      attendanceRange.to,
    ],
    queryFn: async () => {
      const pages = await Promise.all(
        attendanceStatuses.map((status) =>
          api.listAttendance({
            employeeId: employee!.id,
            from: attendanceRange.from,
            to: attendanceRange.to,
            status,
            limit: 1,
            offset: 0,
          }),
        ),
      );
      return attendanceStatuses.reduce<Record<AttendanceStatus, number>>(
        (result, status, index) => {
          result[status] = pages[index]?.total ?? 0;
          return result;
        },
        { PRESENT: 0, ABSENT: 0, LEAVE: 0, SICK: 0 },
      );
    },
    enabled: Boolean(open && employee && attendanceEnabled),
  });

  const counts = attendanceCounts.data ?? {
    PRESENT: 0,
    ABSENT: 0,
    LEAVE: 0,
    SICK: 0,
  };
  const totalRecords = counts.PRESENT + counts.ABSENT + counts.LEAVE + counts.SICK;

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={copy('Employee details')}
      description={
        employee
          ? `${employee.code} · ${employee.position?.name ?? copy('Position not set')}`
          : undefined
      }
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <DSkeleton className="h-36 w-full" />
          <DSkeleton className="h-44 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Could not load employee details.')}
        </p>
      ) : (
        employee && (
          <div>
            <section className="border-b border-[var(--color-border)] pb-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                    {employee.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {employee.code} · {employee.position?.name ?? copy('Position not set')}
                  </p>
                </div>
                <EmployeeStatusBadge status={employee.status} />
              </div>
              <dl className="mt-5 grid gap-x-6 gap-y-5 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
                <Field
                  label={copy('Position')}
                  value={employee.position?.name ?? copy('Not set')}
                  emphasized
                />
                <Field
                  label={copy('Join date')}
                  value={formatJoinedOn(employee.joinedOn, formatDate, copy)}
                />
                <Field label={copy('Tenure')} value={formatTenure(employee.joinedOn, copy)} />
              </dl>
            </section>

            <section className="border-b border-[var(--color-border)] py-5">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                {copy('Employment information')}
              </h3>
              <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
                {copy(
                  'Service eligibility is controlled by the employee position. Catalog service assignment mode still decides whether assignment is optional or required.',
                )}
              </p>
              <DetailGrid>
                <Field label={copy('Employee code')} value={employee.code} />
                <Field label={copy('Display name')} value={employee.displayName} />
                <Field
                  label={copy('Position')}
                  value={employee.position?.name ?? copy('Not set')}
                />
                <Field
                  label={copy('Service assignment')}
                  value={
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
                    )
                  }
                />
                <Field
                  label={copy('Current status')}
                  value={<EmployeeStatusBadge status={employee.status} />}
                />
                <Field
                  label={copy('Join date')}
                  value={formatJoinedOn(employee.joinedOn, formatDate, copy)}
                />
              </DetailGrid>
            </section>

            {attendanceEnabled ? (
              <section className="border-b border-[var(--color-border)] py-5">
                <h3 className="text-base font-semibold text-[var(--color-text)]">
                  {copy('Attendance history')}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {copy('Review attendance history by day, month, or a custom date range.')}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <DSelect
                    label={copy('Period')}
                    value={attendanceMode}
                    clearable={false}
                    options={[
                      { value: 'DAY', label: copy('Daily') },
                      { value: 'MONTH', label: copy('Monthly') },
                      { value: 'RANGE', label: copy('Date range') },
                    ]}
                    onValueChange={(value) => {
                      setAttendanceMode(value as AttendancePeriodMode);
                      setAttendanceOffset(0);
                    }}
                  />

                  {attendanceMode === 'DAY' ? (
                    <DDatePicker
                      label={copy('Attendance date')}
                      value={attendanceDay}
                      onChange={(value) => {
                        if (!value) return;
                        setAttendanceDay(value);
                        setAttendanceOffset(0);
                      }}
                      variant="date"
                    />
                  ) : null}

                  {attendanceMode === 'MONTH' ? (
                    <DSelect
                      label={copy('Month')}
                      value={attendanceMonth}
                      clearable={false}
                      options={monthOptions}
                      onValueChange={(value) => {
                        if (typeof value !== 'string') return;
                        setAttendanceMonth(value);
                        setAttendanceOffset(0);
                      }}
                    />
                  ) : null}

                  {attendanceMode === 'RANGE' ? (
                    <DRangeDatePicker
                      label={copy('Date range')}
                      value={{ start: attendanceFrom, end: attendanceTo }}
                      clearable={false}
                      onChange={(value) => {
                        if (!value.start || !value.end) return;
                        setAttendanceFrom(value.start);
                        setAttendanceTo(value.end);
                        setAttendanceOffset(0);
                      }}
                    />
                  ) : null}

                  <DSelect
                    label={copy('Attendance status')}
                    value={attendanceStatus}
                    clearable={false}
                    options={[
                      { value: 'ALL', label: copy('All statuses') },
                      { value: 'PRESENT', label: copy('Present') },
                      { value: 'ABSENT', label: copy('Absent') },
                      { value: 'LEAVE', label: copy('Leave') },
                      { value: 'SICK', label: copy('Sick') },
                    ]}
                    onValueChange={(value) => {
                      setAttendanceStatus(value as AttendanceStatusFilter);
                      setAttendanceOffset(0);
                    }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {attendanceCounts.isLoading ? '—' : totalRecords} {copy('attendance records')}
                  </p>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label={copy('Present')}
                    value={attendanceCounts.isLoading ? '—' : String(counts.PRESENT)}
                  />
                  <Field
                    label={copy('Absent')}
                    value={attendanceCounts.isLoading ? '—' : String(counts.ABSENT)}
                  />
                  <Field
                    label={copy('Leave')}
                    value={attendanceCounts.isLoading ? '—' : String(counts.LEAVE)}
                  />
                  <Field
                    label={copy('Sick')}
                    value={attendanceCounts.isLoading ? '—' : String(counts.SICK)}
                  />
                </dl>
                <div className="mt-4">
                  {attendance.isError || attendanceCounts.isError ? (
                    <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                      {copy('Could not load attendance history.')}
                    </p>
                  ) : null}
                  <DDataTable
                    columns={attendanceColumns(copy, formatDate)}
                    data={attendance.data?.items ?? []}
                    loading={attendance.isLoading}
                    rowKey="id"
                    emptyMessage={copy('No attendance history is available.')}
                    pagination={{
                      page: Math.floor(attendanceOffset / attendancePageSize) + 1,
                      pageSize: attendancePageSize,
                      total: attendance.data?.total ?? 0,
                    }}
                    onPageChange={(page) => setAttendanceOffset((page - 1) * attendancePageSize)}
                    onPageSizeChange={(nextPageSize) => {
                      setAttendancePageSize(nextPageSize);
                      setAttendanceOffset(0);
                    }}
                  />
                </div>
              </section>
            ) : null}

            <section className="border-b border-[var(--color-border)] py-5">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                {copy('Lifecycle history')}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {copy(
                  'Status changes remain auditable and do not remove historical employee references.',
                )}
              </p>
              <div className="mt-4">
                <LifecycleHistory employee={employee} copy={copy} formatDate={formatDate} />
              </div>
            </section>

            <section className="pt-5">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                {copy('System information')}
              </h3>
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
            </section>
          </div>
        )
      )}
    </DDialog>
  );
}

function attendanceColumns(
  copy: (value: string) => string,
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string,
): TableColumn<EmployeeAttendance>[] {
  return [
    {
      key: 'attendanceDate',
      label: copy('Date'),
      render: (record) =>
        formatDate(new Date(`${record.attendanceDate}T00:00:00`), { dateStyle: 'medium' }),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (record) => <AttendanceBadge status={record.status} />,
    },
    {
      key: 'checkInAt',
      label: copy('Check in'),
      render: (record) =>
        record.checkInAt
          ? formatDate(new Date(record.checkInAt), { timeStyle: 'short' })
          : copy('Not set'),
    },
    {
      key: 'checkOutAt',
      label: copy('Check out'),
      render: (record) =>
        record.checkOutAt
          ? formatDate(new Date(record.checkOutAt), { timeStyle: 'short' })
          : copy('Not set'),
    },
    {
      key: 'source',
      label: copy('Source'),
      render: (record) => copy(record.source === 'LOCAL' ? 'Local' : 'HRIS'),
    },
  ];
}

function EmployeeStatusBadge({ status }: { status: Employee['status'] }) {
  const { copy } = useWorkforceLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {copy(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
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

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

function Field({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[var(--color-text)] ${
          emphasized ? 'text-base font-semibold' : 'text-sm font-medium'
        }`}
      >
        {value}
      </dd>
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

function resolveAttendanceRange(input: {
  mode: AttendancePeriodMode;
  day: string;
  month: string;
  from: string;
  to: string;
}) {
  if (input.mode === 'DAY') return { from: input.day, to: input.day };
  if (input.mode === 'MONTH') return monthRange(input.month);
  return input.from <= input.to
    ? { from: input.from, to: input.to }
    : { from: input.to, to: input.from };
}

function monthRange(month: string) {
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
  return Array.from({ length: 24 }, (unused, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: formatter.format(date) };
  });
}

function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
