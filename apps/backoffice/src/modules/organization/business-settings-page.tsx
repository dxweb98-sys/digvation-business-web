import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDialog,
  DDataTable,
  DInput,
  DSelect,
  DSkeleton,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleOff, MapPinPlus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useRuntime } from '@digvation/business-runtime';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import {
  isSessionExpiredError,
  useBackofficeAuth,
} from '../../auth/backoffice-auth-context';
import {
  BackofficePage,
  BackofficePageHeader,
} from '../../app/layout/backoffice-page';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  BusinessSettingsApi,
  type BusinessPreferences,
  type BusinessProfile,
  type SellingLocation,
} from './business-settings-api';

const businessSettingsKeys = {
  configuration: ['business-settings', 'configuration'] as const,
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
  const [editingPreferences, setEditingPreferences] =
    useState<BusinessPreferences | null>(null);
  const [editingLocation, setEditingLocation] = useState<
    SellingLocation | null | undefined
  >(undefined);
  const [deactivatingLocation, setDeactivatingLocation] =
    useState<SellingLocation | null>(null);
  const [locationsOffset, setLocationsOffset] = useState(0);
  const [locationsPageSize, setLocationsPageSize] =
    useState(locationPageLimit);

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
  const configurationQuery = useQuery({
    queryKey: businessSettingsKeys.configuration,
    queryFn: () => api.getConfiguration(),
    enabled: canViewProfile,
  });
  const locationsQuery = useQuery({
    queryKey: [
      ...businessSettingsKeys.locations,
      locationsOffset,
      locationsPageSize,
    ],
    queryFn: () =>
      api.listLocations({
        limit: locationsPageSize,
        offset: locationsOffset,
      }),
    enabled: canViewLocations,
  });
  const invalidateConfiguration = () =>
    void queryClient.invalidateQueries({
      queryKey: businessSettingsKeys.configuration,
    });
  const invalidateLocations = () =>
    void queryClient.invalidateQueries({
      queryKey: businessSettingsKeys.locations,
    });

  if (!session) return null;

  const currentMainLocation = locationsQuery.data?.items.find(
    (location) => location.isMain,
  );
  const hasLocations = (locationsQuery.data?.total ?? 0) > 0;

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Business')}
        description={copy(
          'Set your business identity and manage the selling locations available to this workspace.',
        )}
      />

      <DTabs defaultValue="profile" className="mt-6">
        <DTabsList>
          <DTabsTrigger value="profile">{copy('Profile')}</DTabsTrigger>
          <DTabsTrigger value="localization">
            {copy('Localization')}
          </DTabsTrigger>
        </DTabsList>
        <DTabsContent value="profile" className="mt-4">
          {canViewProfile ? (
            <ProfileCard
              profile={configurationQuery.data?.profile}
              isLoading={configurationQuery.isLoading}
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
              onPageChange={(page) =>
                setLocationsOffset((page - 1) * locationsPageSize)
              }
              onPageSizeChange={(pageSize) => {
                setLocationsPageSize(pageSize);
                setLocationsOffset(0);
              }}
            />
          ) : null}
        </DTabsContent>
        <DTabsContent value="localization" className="mt-4">
          {canViewProfile ? (
            <LocalizationPanel
              preferences={configurationQuery.data?.preferences}
              isLoading={configurationQuery.isLoading}
              canUpdate={canUpdateProfile}
              onEdit={setEditingPreferences}
            />
          ) : null}
        </DTabsContent>
      </DTabs>
      <ProfileEditor
        key={editingProfile?.version ?? 'closed'}
        profile={editingProfile}
        api={api}
        onClose={() => setEditingProfile(null)}
        onChanged={invalidateConfiguration}
      />
      <LocalizationEditor
        key={editingPreferences?.version ?? 'closed'}
        preferences={editingPreferences}
        api={api}
        onClose={() => setEditingPreferences(null)}
        onChanged={invalidateConfiguration}
      />
      <LocationEditor
        key={editingLocation?.id ?? (editingLocation === null ? 'new' : 'closed')}
        location={editingLocation}
        api={api}
        canUpdate={canUpdateLocation}
        hasLocations={hasLocations}
        currentMainLocation={currentMainLocation}
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
              {copy('The business name used by your POS records.')}
            </p>
          </div>
        </div>
        {canUpdate && profile ? (
          <DButton
            variant="secondary"
            size="sm"
            onClick={() => onEdit(profile)}
          >
            {copy('Edit profile')}
          </DButton>
        ) : null}
      </div>
      {isLoading ? (
        <DSkeleton className="mt-5 h-6 w-52" />
      ) : (
        <p className="mt-5 text-lg font-semibold">
          {profile?.name ?? copy('Not configured')}
        </p>
      )}
    </section>
  );
}

function LocalizationPanel({
  preferences,
  isLoading,
  canUpdate,
  onEdit,
}: {
  preferences?: BusinessPreferences | undefined;
  isLoading: boolean;
  canUpdate: boolean;
  onEdit: (preferences: BusinessPreferences) => void;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Localization')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy(
              'Set the default language, timezone, and time formats for this business.',
            )}
          </p>
        </div>
        {canUpdate && preferences ? (
          <DButton
            variant="secondary"
            size="sm"
            onClick={() => onEdit(preferences)}
          >
            {copy('Edit localization')}
          </DButton>
        ) : null}
      </div>
      {isLoading ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DSkeleton className="h-11" />
          <DSkeleton className="h-11" />
        </div>
      ) : preferences ? (
        <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <PreferenceFact
            label={copy('Default language')}
            value={localizeLocale(preferences.defaultLocale, copy)}
          />
          <PreferenceFact label={copy('Timezone')} value={preferences.timezone} />
          <PreferenceFact label={copy('Date format')} value={preferences.dateFormat} />
          <PreferenceFact label={copy('Time format')} value={preferences.timeFormat} />
        </dl>
      ) : null}
    </section>
  );
}

function PreferenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function localizeLocale(
  locale: BusinessPreferences['defaultLocale'],
  copy: (value: string) => string,
) {
  return locale === 'id-ID' ? copy('Indonesian') : copy('English');
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
    {
      key: 'name',
      label: copy('Selling location'),
      render: (location) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{location.name}</span>
          {location.isMain ? (
            <DBadge variant="secondary">{copy('Main Branch')}</DBadge>
          ) : null}
        </div>
      ),
    },
    { key: 'code', label: copy('Code') },
    {
      key: 'status',
      label: copy('Status'),
      render: (location) => (
        <DBadge
          variant={location.status === 'ACTIVE' ? 'outline' : 'secondary'}
        >
          {copy(location.status === 'ACTIVE' ? 'Active' : 'Inactive')}
        </DBadge>
      ),
    },
  ];
  return (
    <section className="mt-6">
      <DDataTable
        columns={columns}
        data={locations ?? []}
        loading={isLoading}
        rowKey="id"
        emptyMessage={copy('No selling locations have been created yet.')}
        headerActions={
          canCreate ? (
            <DButton
              leftIcon={<MapPinPlus className="size-4" />}
              onClick={onCreate}
            >
              {copy('Add location')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total,
        }}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        actions={
          canUpdate
            ? [
                {
                  label: copy('Edit selling location'),
                  icon: <Pencil className="size-4" />,
                  onClick: onEdit,
                },
                {
                  label: copy('Deactivate selling location'),
                  icon: <CircleOff className="size-4" />,
                  variant: 'danger',
                  onClick: onDeactivate,
                  show: (location) =>
                    location.status === 'ACTIVE' && !location.isMain,
                },
              ]
            : []
        }
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
      showToast({
        variant: 'success',
        title: copy('Business profile updated.'),
      });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not update business profile.'),
          ).safeMessage,
        });
    }
  };
  return (
    <DDialog
      open={Boolean(profile)}
      onClose={onClose}
      title={copy('Business profile')}
      description={copy(
        'Set the name that identifies this business in POS records.',
      )}
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

function LocalizationEditor({
  preferences,
  api,
  onClose,
  onChanged,
}: {
  preferences: BusinessPreferences | null;
  api: BusinessSettingsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const [defaultLocale, setDefaultLocale] = useState<BusinessPreferences['defaultLocale']>(
    preferences?.defaultLocale ?? 'id-ID',
  );
  const [timezone, setTimezone] = useState(preferences?.timezone ?? 'Asia/Jakarta');
  const [dateFormat, setDateFormat] = useState<BusinessPreferences['dateFormat']>(
    preferences?.dateFormat ?? 'DD/MM/YYYY',
  );
  const [timeFormat, setTimeFormat] = useState<BusinessPreferences['timeFormat']>(
    preferences?.timeFormat ?? 'HH:mm',
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!preferences || !timezone.trim() || saving) return;
    setSaving(true);
    try {
      await api.updatePreferences(preferences, {
        defaultLocale,
        timezone: timezone.trim(),
        dateFormat,
        timeFormat,
      });
      onChanged();
      showToast({ variant: 'success', title: copy('Localization updated.') });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not update localization.'),
          ).safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={Boolean(preferences)}
      onClose={onClose}
      title={copy('Localization')}
      description={copy(
        'Set the default language and time presentation for this business.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            onClick={() => void save()}
            disabled={!timezone.trim() || saving}
          >
            {copy('Save localization')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={copy('Default language')}
          value={defaultLocale}
          clearable={false}
          options={[
            { value: 'id-ID', label: copy('Indonesian') },
            { value: 'en-US', label: copy('English') },
          ]}
          onValueChange={(value) =>
            setDefaultLocale(value as BusinessPreferences['defaultLocale'])
          }
        />
        <DInput
          label={copy('Timezone')}
          value={timezone}
          onChange={setTimezone}
          placeholder="Asia/Jakarta"
        />
        <DSelect
          label={copy('Date format')}
          value={dateFormat}
          clearable={false}
          options={[
            { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
            { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
            { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
          ]}
          onValueChange={(value) =>
            setDateFormat(value as BusinessPreferences['dateFormat'])
          }
        />
        <DSelect
          label={copy('Time format')}
          value={timeFormat}
          clearable={false}
          options={[
            { value: 'HH:mm', label: '24-hour (HH:mm)' },
            { value: 'hh:mm a', label: '12-hour (hh:mm a)' },
          ]}
          onValueChange={(value) =>
            setTimeFormat(value as BusinessPreferences['timeFormat'])
          }
        />
      </div>
    </DDialog>
  );
}

function LocationEditor({
  location,
  api,
  canUpdate,
  hasLocations,
  currentMainLocation,
  onClose,
  onChanged,
}: {
  location: SellingLocation | null | undefined;
  api: BusinessSettingsApi;
  canUpdate: boolean;
  hasLocations: boolean;
  currentMainLocation?: SellingLocation | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const { copy } = useBackofficeLocalization();
  const isNew = location === null;
  const isCurrentMain = Boolean(location?.isMain);
  const firstLocation = isNew && !hasLocations;
  const [code, setCode] = useState('');
  const [name, setName] = useState(location?.name ?? '');
  const [setAsMain, setSetAsMain] = useState(isCurrentMain || firstLocation);
  const [confirmMainChange, setConfirmMainChange] = useState(false);

  const persist = async () => {
    if (!name.trim()) return;
    try {
      if (isNew) {
        if (!code.trim()) return;
        await api.createLocation({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          setAsMain: setAsMain || undefined,
        });
      } else if (location && canUpdate) {
        await api.updateLocation(location, {
          name: name.trim(),
          setAsMain: setAsMain && !location.isMain ? true : undefined,
        });
      }
      onChanged();
      showToast({
        variant: 'success',
        title:
          setAsMain && !isCurrentMain
            ? copy('Main Branch updated.')
            : isNew
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

  const save = () => {
    if (!name.trim() || (isNew && !code.trim())) return;
    const movesExistingMain =
      setAsMain && !isCurrentMain && hasLocations && !firstLocation;
    if (movesExistingMain) {
      setConfirmMainChange(true);
      return;
    }
    void persist();
  };

  const nextMainName = name.trim() || copy('This location');
  const currentMainName = currentMainLocation?.name;
  const confirmationMessage = currentMainName
    ? `${nextMainName} will become the new Main Branch. ${currentMainName} will remain active but will no longer be the Main Branch. Dashboard and default business location will use ${nextMainName}.`
    : `${nextMainName} will become the new Main Branch. The current Main Branch will remain active but will no longer be the Main Branch. Dashboard and default business location will use ${nextMainName}.`;

  return (
    <>
      <DDialog
        open={location !== undefined}
        onClose={onClose}
        title={
          isNew ? copy('Add selling location') : copy('Edit selling location')
        }
        description={
          isNew
            ? copy(
                'A selling location is the branch context for POS sales and location-specific prices.',
              )
            : copy('Location codes are permanent once created.')
        }
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={onClose}>
              {copy('Cancel')}
            </DButton>
            <DButton
              onClick={save}
              disabled={!name.trim() || (isNew && !code.trim())}
            >
              {copy('Save location')}
            </DButton>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {isNew ? (
            <DInput
              label={copy('Location code')}
              value={code}
              onChange={setCode}
              placeholder="MAIN"
            />
          ) : (
            <DInput
              label={copy('Location code')}
              value={location?.code ?? ''}
              disabled
            />
          )}
          <DInput
            label={copy('Location name')}
            value={name}
            onChange={setName}
            placeholder={copy('For example, Central Jakarta')}
            autoFocus
          />
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
          <input
            type="checkbox"
            checked={setAsMain}
            disabled={isCurrentMain || firstLocation}
            onChange={(event) => setSetAsMain(event.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-brand)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {copy('Set as Main Branch')}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
              {isCurrentMain
                ? copy(
                    'This is the current Main Branch. Choose another active location to move the Main Branch.',
                  )
                : firstLocation
                  ? copy('The first active location becomes Main Branch automatically.')
                  : copy(
                      'Main Branch is used as the default location for Dashboard and other business workflows.',
                    )}
            </span>
          </span>
        </label>
      </DDialog>

      <DConfirmDialog
        open={confirmMainChange}
        onClose={() => setConfirmMainChange(false)}
        onConfirm={() => {
          setConfirmMainChange(false);
          void persist();
        }}
        title={copy('Change Main Branch?')}
        message={confirmationMessage}
        confirmLabel={copy('Change Main Branch')}
      />
    </>
  );
}
