import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDialog,
  DDataTable,
  DInput,
  DSkeleton,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleOff, MapPinPlus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useRuntime } from '@digvation/pos-runtime';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  BusinessSettingsApi,
  type BusinessProfile,
  type SellingLocation,
} from './business-settings-api';

const businessSettingsKeys = {
  profile: ['business-settings', 'profile'] as const,
  locations: ['business-settings', 'locations'] as const,
};

const locationPageLimit = 20;

export function BusinessSettingsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const api = useMemo(
    () => new BusinessSettingsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const [editingProfile, setEditingProfile] = useState<BusinessProfile | null>(null);
  const [editingLocation, setEditingLocation] = useState<SellingLocation | null | undefined>(
    undefined,
  );
  const [deactivatingLocation, setDeactivatingLocation] = useState<SellingLocation | null>(null);
  const [locationsOffset, setLocationsOffset] = useState(0);
  const [locationsPageSize, setLocationsPageSize] = useState(locationPageLimit);

  const canViewProfile = session
    ? canPerformBackofficeAction(session, 'viewBusinessProfile')
    : false;
  const canUpdateProfile = session
    ? canPerformBackofficeAction(session, 'updateBusinessProfile')
    : false;
  const canViewLocations = session
    ? canPerformBackofficeAction(session, 'viewSellingLocations')
    : false;
  const canCreateLocation = session
    ? canPerformBackofficeAction(session, 'createSellingLocation')
    : false;
  const canUpdateLocation = session
    ? canPerformBackofficeAction(session, 'updateSellingLocation')
    : false;
  const profileQuery = useQuery({
    queryKey: businessSettingsKeys.profile,
    queryFn: () => api.getProfile(),
    enabled: canViewProfile,
  });
  const locationsQuery = useQuery({
    queryKey: [...businessSettingsKeys.locations, locationsOffset, locationsPageSize],
    queryFn: () => api.listLocations({ limit: locationsPageSize, offset: locationsOffset }),
    enabled: canViewLocations,
  });
  const invalidateProfile = () =>
    void queryClient.invalidateQueries({ queryKey: businessSettingsKeys.profile });
  const invalidateLocations = () =>
    void queryClient.invalidateQueries({ queryKey: businessSettingsKeys.locations });

  if (!session) return null;

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title="Business"
        description={copy('Set your business identity and manage the selling locations available to this workspace.')}
      />

      {canViewProfile ? (
        <ProfileCard
          profile={profileQuery.data}
          isLoading={profileQuery.isLoading}
          canUpdate={canUpdateProfile}
          onEdit={setEditingProfile}
        />
      ) : null}
      {canViewLocations ? (
        <LocationsPanel
          locations={locationsQuery.data?.items}
          total={locationsQuery.data?.total ?? 0}
          isLoading={locationsQuery.isLoading}
          canCreate={canCreateLocation}
          canUpdate={canUpdateLocation}
          onCreate={() => setEditingLocation(null)}
          onEdit={setEditingLocation}
          onDeactivate={setDeactivatingLocation}
          offset={locationsQuery.data?.offset ?? locationsOffset}
          pageSize={locationsPageSize}
          onPageChange={(page) => setLocationsOffset((page - 1) * locationsPageSize)}
          onPageSizeChange={(pageSize) => { setLocationsPageSize(pageSize); setLocationsOffset(0); }}
        />
      ) : null}
      <ProfileEditor
        key={editingProfile?.version ?? 'closed'}
        profile={editingProfile}
        api={api}
        onClose={() => setEditingProfile(null)}
        onChanged={invalidateProfile}
      />
      <LocationEditor
        key={editingLocation?.id ?? (editingLocation === null ? 'new' : 'closed')}
        location={editingLocation}
        api={api}
        canUpdate={canUpdateLocation}
        onClose={() => setEditingLocation(undefined)}
        onChanged={invalidateLocations}
      />
      <DConfirmDialog
        open={Boolean(deactivatingLocation)}
        onClose={() => setDeactivatingLocation(null)}
        onConfirm={() => {
          if (deactivatingLocation)
            void api
              .updateLocation(deactivatingLocation, { status: 'INACTIVE' })
              .then(() => {
                invalidateLocations();
                showToast({
                  variant: 'success',
                  title: copy('Selling location deactivated.'),
                });
                setDeactivatingLocation(null);
              })
              .catch((error) => {
                if (!isSessionExpiredError(error))
                  showToast({
                    variant: 'danger',
                    title: normalizeBackofficeApiError(
                      error,
                      copy('Could not save selling location.'),
                    ).safeMessage,
                  });
              });
        }}
        title={copy('Deactivate selling location?')}
        message="This location will remain in historical records but cannot be used as an active selling location."
        confirmLabel={copy('Deactivate')}
        variant="danger"
      />
    </BackofficePage>
  );
}

function ProfileCard({
  profile,
  isLoading,
  canUpdate,
  onEdit,
}: {
  profile?: BusinessProfile | undefined;
  isLoading: boolean;
  canUpdate: boolean;
  onEdit: (profile: BusinessProfile) => void;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Building2 className="size-[18px]" />
          </span>
          <div>
            <h2 className="font-semibold">{copy('Business profile')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              The business name used by your POS records.
            </p>
          </div>
        </div>
        {canUpdate && profile ? (
          <DButton variant="secondary" size="sm" onClick={() => onEdit(profile)}>
            {copy('Edit profile')}
          </DButton>
        ) : null}
      </div>
      {isLoading ? (
        <DSkeleton className="mt-5 h-6 w-52" />
      ) : (
        <p className="mt-5 text-lg font-semibold">{profile?.name ?? copy('Not configured')}</p>
      )}
    </section>
  );
}

function LocationsPanel({
  locations,
  isLoading,
  canCreate,
  canUpdate,
  onCreate,
  onEdit,
  onDeactivate,
  offset,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  locations?: SellingLocation[] | undefined;
  total: number;
  isLoading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  onCreate: () => void;
  onEdit: (location: SellingLocation) => void;
  onDeactivate: (location: SellingLocation) => void;
  offset: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { copy } = useBackofficeLocalization();
  const columns: TableColumn<SellingLocation>[] = [
    { key: 'name', label: copy('Selling location') },
    { key: 'code', label: copy('Code') },
    { key: 'status', label: copy('Status'), render: (location) => <DBadge variant={location.status === 'ACTIVE' ? 'outline' : 'secondary'}>{copy(location.status === 'ACTIVE' ? 'Active' : 'Inactive')}</DBadge> },
  ];
  return (
    <section className="mt-6">
      <DDataTable
        columns={columns}
        data={locations ?? []}
        loading={isLoading}
        rowKey="id"
        emptyMessage={copy('No selling locations have been created yet.')}
        headerActions={canCreate ? <DButton leftIcon={<MapPinPlus className="size-4" />} onClick={onCreate}>{copy('Add location')}</DButton> : null}
        pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        actions={canUpdate ? [
          { label: copy('Edit selling location'), icon: <Pencil className="size-4" />, onClick: onEdit },
          { label: copy('Deactivate selling location'), icon: <CircleOff className="size-4" />, variant: 'danger', onClick: onDeactivate, show: (location) => location.status === 'ACTIVE' },
        ] : []}
      />
    </section>
  );
}

function ProfileEditor({
  profile,
  api,
  onClose,
  onChanged,
}: {
  profile: BusinessProfile | null;
  api: BusinessSettingsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const [name, setName] = useState(profile?.name ?? '');
  const save = async () => {
    if (!profile || !name.trim()) return;
    try {
      await api.updateProfile(profile, name.trim());
      onChanged();
      showToast({ variant: 'success', title: copy('Business profile updated.') });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update business profile.')).safeMessage,
        });
    }
  };
  return (
    <DDialog
      open={Boolean(profile)}
      onClose={onClose}
      title={copy('Business profile')}
      description={copy('Set the name that identifies this business in POS records.')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void save()} disabled={!name.trim()}>
            {copy('Save profile')}
          </DButton>
        </div>
      }
    >
      <DInput
        label={copy('Business name')}
        value={name}
        onChange={setName}
        placeholder={copy('For example, Main Store')}
        autoFocus
      />
    </DDialog>
  );
}

function LocationEditor({
  location,
  api,
  canUpdate,
  onClose,
  onChanged,
}: {
  location: SellingLocation | null | undefined;
  api: BusinessSettingsApi;
  canUpdate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const isNew = location === null;
  const [code, setCode] = useState('');
  const [name, setName] = useState(location?.name ?? '');
  const save = async () => {
    if (!name.trim()) return;
    try {
      if (isNew) {
        if (!code.trim()) return;
        await api.createLocation({ code: code.trim().toUpperCase(), name: name.trim() });
      } else if (location && canUpdate) await api.updateLocation(location, { name: name.trim() });
      onChanged();
      showToast({
        variant: 'success',
        title: isNew
          ? copy('Selling location added.')
          : copy('Selling location updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not save selling location.'),
          ).safeMessage,
        });
    }
  };
  return (
    <DDialog
      open={location !== undefined}
      onClose={onClose}
      title={isNew ? copy('Add selling location') : copy('Edit selling location')}
      description={
        isNew
          ? copy('A selling location is the branch context for POS sales and location-specific prices.')
          : copy('Location codes are permanent once created.')
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void save()} disabled={!name.trim() || (isNew && !code.trim())}>
            {copy('Save location')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew ? (
          <DInput label={copy('Location code')} value={code} onChange={setCode} placeholder="MAIN" />
        ) : (
          <DInput label={copy('Location code')} value={location?.code ?? ''} disabled />
        )}
        {<DInput label={copy('Location name')} value={name} onChange={setName} placeholder={copy('For example, Central Jakarta')} autoFocus />}
      </div>
    </DDialog>
  );
}
