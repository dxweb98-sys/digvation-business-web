import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDataTable,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { CircleOff, MapPinPlus, Pencil } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type { BusinessSettingsApi, SellingLocation } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { BusinessLocationDialog } from './business-location-dialog';
import { BusinessListHeading } from './business-section-layout';

export function BusinessLocationsSection({
  items,
  loading,
  canCreate,
  canUpdate,
  api,
  onChanged,
}: {
  items: SellingLocation[];
  loading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<SellingLocation | null | undefined>();
  const [deactivating, setDeactivating] = useState<SellingLocation | null>(null);

  const columns: TableColumn<SellingLocation>[] = [
    {
      key: 'name',
      label: copy('Location'),
      render: (item) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-(--color-text)">{item.name}</span>
            {item.isMain ? <DBadge variant="info">{copy('Main branch')}</DBadge> : null}
          </div>
          <p className="mt-0.5 font-mono text-xs text-(--color-text-muted)">{item.code}</p>
        </div>
      ),
    },
    {
      key: 'address',
      label: copy('Address'),
      render: (item) =>
        item.address ? (
          <span className="text-sm">{item.address}</span>
        ) : (
          <span className="text-sm text-(--color-text-muted)">{copy('Not set')}</span>
        ),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (item) => (
        <DBadge variant={item.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {copy(item.status === 'ACTIVE' ? 'Active' : 'Inactive')}
        </DBadge>
      ),
    },
  ];

  const deactivate = async () => {
    if (!deactivating) return;
    try {
      await api.updateLocation(deactivating, { status: 'INACTIVE' });
      onChanged();
      setDeactivating(null);
      showToast({ variant: 'success', title: copy('Selling location deactivated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save selling location.'))
            .safeMessage,
        });
    }
  };

  return (
    <section aria-label={copy('Selling locations')} className="space-y-3">
      <BusinessListHeading
        title={copy('Selling locations')}
        description={copy(
          'Branches where sales take place. Deactivated locations stay in history.',
        )}
      />
      <DDataTable
        columns={columns}
        data={items}
        loading={loading}
        rowKey="id"
        emptyMessage={copy('No selling locations have been created yet.')}
        headerActions={
          canCreate ? (
            <DButton leftIcon={<MapPinPlus className="size-4" />} onClick={() => setEditing(null)}>
              {copy('Add location')}
            </DButton>
          ) : null
        }
        actions={
          canUpdate
            ? [
                {
                  label: copy('Edit selling location'),
                  icon: <Pencil className="size-4" />,
                  onClick: (item) => setEditing(item),
                },
                {
                  label: copy('Deactivate selling location'),
                  icon: <CircleOff className="size-4" />,
                  variant: 'danger',
                  onClick: (item) => setDeactivating(item),
                  show: (item) => item.status === 'ACTIVE' && !item.isMain,
                },
              ]
            : []
        }
      />
      {editing !== undefined ? (
        <BusinessLocationDialog
          key={editing?.id ?? 'new'}
          location={editing}
          items={items}
          api={api}
          onClose={() => setEditing(undefined)}
          onChanged={onChanged}
        />
      ) : null}
      <DConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={() => void deactivate()}
        title={copy('Deactivate selling location?')}
        message={copy(
          'This location remains in historical records but cannot be used for new operations.',
        )}
        confirmLabel={copy('Deactivate')}
        variant="danger"
      />
    </section>
  );
}
