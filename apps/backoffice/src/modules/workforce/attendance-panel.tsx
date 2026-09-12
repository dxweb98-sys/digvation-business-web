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
import { Clock3, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import {
  type AttendanceStatus,
  type Employee,
  type EmployeeAttendance,
  EmployeesApi,
} from './employees-api';
import { useWorkforceLocalization } from './workforce-localization';

const attendanceKey = ['employees', 'attendance'] as const;
const employeesKey = ['employees', 'attendance-roster'] as const;

export function AttendancePanel({
  api,
  canManage,
}: {
  api: EmployeesApi;
  canManage: boolean;
}) {
  const { copy, formatDate } = useWorkforceLocalization();
  const [date, setDate] = useState(localDateKey(new Date()));
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [target, setTarget] = useState<Employee | null>(null);

  const employees = useQuery({
    queryKey: [...employeesKey, offset, pageSize],
    queryFn: () =>
      api.list({
        status: 'ACTIVE',
        limit: pageSize,
        offset,
      }),
  });
  const attendance = useQuery({
    queryKey: [...attendanceKey, date],
    queryFn: () => api.listAttendance({ from: date, to: date, limit: 100, offset: 0 }),
  });

  const attendanceByEmployee = useMemo(
    () => new Map((attendance.data?.items ?? []).map((record) => [record.employeeId, record])),
    [attendance.data?.items],
  );
  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LEAVE: 0,
      SICK: 0,
    };
    for (const record of attendance.data?.items ?? []) result[record.status] += 1;
    return result;
  }, [attendance.data?.items]);

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
        return record ? <AttendanceBadge status={record.status} /> : copy('Not set');
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
        return source ? copy(source === 'LOCAL' ? 'Local' : 'HRIS') : copy('Not set');
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-xs">
          <DDatePicker
            label={copy('Attendance date')}
            value={date}
            onChange={(value) => {
              if (value) setDate(value);
            }}
            variant="date"
          />
        </div>
        <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
          {copy(
            'Attendance is recorded by authorized supervisors or managers. HRIS-sourced records remain read-only locally.',
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AttendanceStat label={copy('Present')} value={counts.PRESENT} />
        <AttendanceStat label={copy('Absent')} value={counts.ABSENT} />
        <AttendanceStat label={copy('Leave')} value={counts.LEAVE} />
        <AttendanceStat label={copy('Sick')} value={counts.SICK} />
      </div>

      <DDataTable
        columns={columns}
        data={employees.data?.items ?? []}
        loading={employees.isLoading || attendance.isLoading}
        rowKey="id"
        emptyMessage={copy('No employees are available.')}
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
              canManage && attendanceByEmployee.get(employee.id)?.source === 'LOCAL',
          },
        ]}
      />

      <AttendanceEditor
        open={target !== null}
        employee={target}
        date={date}
        existing={target ? attendanceByEmployee.get(target.id) : undefined}
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
        checkInAt: status === 'PRESENT' && checkIn ? toIso(date, checkIn) : null,
        checkOutAt: status === 'PRESENT' && checkOut ? toIso(date, checkOut) : null,
        note: note.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: attendanceKey });
      showToast({ variant: 'success', title: copy('Attendance saved.') });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save attendance.')).safeMessage,
        });
      }
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(existing ? 'Edit attendance' : 'Record attendance')}
      description={employee ? `${employee.code} · ${employee.displayName} · ${date}` : undefined}
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
          onValueChange={(value) => setStatus(value as AttendanceStatus)}
        />
        {status === 'PRESENT' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <DTimePicker
              label={copy('Check in')}
              value={checkIn}
              onChange={setCheckIn}
              onClear={() => setCheckIn('')}
            />
            <DTimePicker
              label={copy('Check out')}
              value={checkOut}
              onChange={setCheckOut}
              onClear={() => setCheckOut('')}
            />
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
    <DBadge variant={status === 'PRESENT' ? 'success' : status === 'ABSENT' ? 'danger' : 'secondary'}>
      {copy(label)}
    </DBadge>
  );
}

function AttendanceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}
