import {
  DBadge,
  DButton,
  DDataTable,
  DDialog,
  DInput,
  DStatusFilter,
  DToggle,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import {
  type EmployeePosition,
  EmployeesApi,
} from './employees-api';
import { useWorkforceLocalization } from './workforce-localization';

const positionKey = ['employees', 'positions'] as const;

export function PositionsPanel({
  api,
  canCreate,
  canUpdate,
}: {
  api: EmployeesApi;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const { copy } = useWorkforceLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState<'' | EmployeePosition['status']>('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [editor, setEditor] = useState<EmployeePosition | 'create' | null>(null);

  const positions = useQuery({
    queryKey: [...positionKey, q, status, offset, pageSize],
    queryFn: () =>
      api.listPositions({
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(status ? { status } : {}),
        limit: pageSize,
        offset,
      }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const toggleStatus = async (position: EmployeePosition) => {
    try {
      await api.updatePosition(position, {
        status: position.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      refresh();
      showToast({
        variant: 'success',
        title: copy('Position updated.'),
      });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save position.')).safeMessage,
        });
      }
    }
  };

  const columns: TableColumn<EmployeePosition>[] = [
    { key: 'code', label: copy('Position code') },
    { key: 'name', label: copy('Position name') },
    {
      key: 'serviceAssignmentEnabled',
      label: copy('Service assignment'),
      render: (position) => (
        <DBadge variant={position.serviceAssignmentEnabled ? 'success' : 'secondary'}>
          {copy(position.serviceAssignmentEnabled ? 'Can perform services' : 'Cannot perform services')}
        </DBadge>
      ),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (position) => (
        <DBadge variant={position.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {copy(position.status === 'ACTIVE' ? 'Active' : 'Inactive')}
        </DBadge>
      ),
    },
  ];

  return (
    <>
      <DDataTable
        columns={columns}
        data={positions.data?.items ?? []}
        loading={positions.isLoading}
        rowKey="id"
        searchable
        searchPlaceholder={copy('Search position code or name...')}
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
              setStatus(value as '' | EmployeePosition['status']);
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
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditor('create')}>
              {copy('Add position')}
            </DButton>
          ) : null
        }
        emptyMessage={
          q || status ? copy('No matching positions found.') : copy('No positions are available.')
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total: positions.data?.total ?? 0,
        }}
        onPageChange={(page) => setOffset((page - 1) * pageSize)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setOffset(0);
        }}
        actions={[
          {
            label: copy('Edit position'),
            icon: <Pencil className="size-4" />,
            onClick: (position) => setEditor(position),
            show: () => canUpdate,
          },
          {
            label: copy('Deactivate position'),
            icon: <CircleOff className="size-4" />,
            variant: 'danger',
            onClick: (position) => void toggleStatus(position),
            show: (position) => canUpdate && position.status === 'ACTIVE',
          },
          {
            label: copy('Reactivate position'),
            icon: <CircleCheck className="size-4" />,
            onClick: (position) => void toggleStatus(position),
            show: (position) => canUpdate && position.status === 'INACTIVE',
          },
        ]}
      />

      <PositionEditor
        open={editor !== null}
        position={editor === 'create' ? null : editor}
        api={api}
        onClose={() => setEditor(null)}
        onSaved={refresh}
      />
    </>
  );
}

function PositionEditor({
  open,
  position,
  api,
  onClose,
  onSaved,
}: {
  open: boolean;
  position: EmployeePosition | null;
  api: EmployeesApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useWorkforceLocalization();
  const { showToast } = useToast();
  const fresh = position === null;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [serviceAssignmentEnabled, setServiceAssignmentEnabled] = useState(false);

  useEffect(() => {
    setCode(position?.code ?? '');
    setName(position?.name ?? '');
    setServiceAssignmentEnabled(position?.serviceAssignmentEnabled ?? false);
  }, [position, open]);

  const save = async () => {
    if (!name.trim()) return;
    try {
      if (fresh) {
        await api.createPosition({
          ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
          name: name.trim(),
          serviceAssignmentEnabled,
        });
      } else if (position) {
        await api.updatePosition(position, {
          name: name.trim(),
          serviceAssignmentEnabled,
        });
      }
      onSaved();
      showToast({
        variant: 'success',
        title: copy(fresh ? 'Position added.' : 'Position updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save position.')).safeMessage,
        });
      }
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(fresh ? 'Add position' : 'Edit position')}
      description={copy(
        'Existing historical assignments remain unchanged. New service assignments require an active eligible position.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!name.trim()} onClick={() => void save()}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <DInput
            label={copy('Position code')}
            value={code}
            onChange={setCode}
            disabled={!fresh}
            placeholder={fresh ? 'THERAPIST' : undefined}
          />
          <DInput
            label={copy('Position name')}
            value={name}
            onChange={setName}
            placeholder="Therapist"
          />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <DToggle
            fullWidth
            checked={serviceAssignmentEnabled}
            onChange={setServiceAssignmentEnabled}
            label={copy('Can perform services')}
          />
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {copy('Allow employees in this position to be assigned to service work.')}
          </p>
        </div>
      </div>
    </DDialog>
  );
}
