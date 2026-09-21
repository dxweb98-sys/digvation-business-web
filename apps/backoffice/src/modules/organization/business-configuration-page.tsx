import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DCheckbox,
  DConfirmDialog,
  DDataTable,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DToggle,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleOff, MapPinPlus, Pencil } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  BusinessSettingsApi,
  type BusinessPreferences,
  type BusinessProfile,
  type BusinessTaxConfiguration,
  type NumberingPreference,
  type SellingLocation,
} from './business-settings-api';
import { useBusinessConfigurationI18n } from './business-configuration-i18n';

const keys = {
  configuration: ['business-settings', 'configuration'] as const,
  locations: ['business-settings', 'locations'] as const,
  numbering: ['business-settings', 'numbering'] as const,
};

export function BusinessConfigurationPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy } = useBackofficeLocalization();
  const api = useMemo(
    () => new BusinessSettingsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const canViewProfile = Boolean(
    session && canPerformBackofficeAction(session, 'viewBusinessProfile'),
  );
  const canUpdateProfile = Boolean(
    session && canPerformBackofficeAction(session, 'updateBusinessProfile'),
  );
  const canViewLocations = Boolean(
    session && canPerformBackofficeAction(session, 'viewSellingLocations'),
  );
  const canCreateLocation = Boolean(
    session && canPerformBackofficeAction(session, 'createSellingLocation'),
  );
  const canUpdateLocation = Boolean(
    session && canPerformBackofficeAction(session, 'updateSellingLocation'),
  );

  const configuration = useQuery({
    queryKey: keys.configuration,
    queryFn: () => api.getConfiguration(),
    enabled: canViewProfile,
  });
  const locations = useQuery({
    queryKey: keys.locations,
    queryFn: () => api.listLocations({ limit: 100, offset: 0 }),
    enabled: canViewLocations,
  });
  const numbering = useQuery({
    queryKey: keys.numbering,
    queryFn: () => api.getNumbering(),
    enabled: canViewProfile,
  });

  if (!session) return null;

  const invalidate = (queryKey: readonly string[]) =>
    void queryClient.invalidateQueries({ queryKey });
  const firstTab = canViewProfile ? 'profile' : 'locations';

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Business')}
        description={copy(
          'Manage business identity, locations, localization, and numbering from one authoritative configuration.',
        )}
      />

      <DTabs defaultValue={firstTab} className="mt-6">
        <DTabsList>
          {canViewProfile ? <DTabsTrigger value="profile">{copy('Profile')}</DTabsTrigger> : null}
          {canViewLocations ? (
            <DTabsTrigger value="locations">{copy('Locations')}</DTabsTrigger>
          ) : null}
          {canViewProfile ? (
            <DTabsTrigger value="localization">{copy('Localization')}</DTabsTrigger>
          ) : null}
          {canViewProfile ? <DTabsTrigger value="tax">{copy('Tax')}</DTabsTrigger> : null}
          {canViewProfile ? (
            <DTabsTrigger value="numbering">{copy('Numbering')}</DTabsTrigger>
          ) : null}
        </DTabsList>

        <DTabsContent value="profile" className="mt-5">
          <ProfileSection
            profile={configuration.data?.profile}
            loading={configuration.isLoading}
            canUpdate={canUpdateProfile}
            api={api}
            onChanged={() => invalidate(keys.configuration)}
          />
        </DTabsContent>

        <DTabsContent value="locations" className="mt-5">
          <LocationsSection
            items={locations.data?.items ?? []}
            loading={locations.isLoading}
            canCreate={canCreateLocation}
            canUpdate={canUpdateLocation}
            api={api}
            onChanged={() => invalidate(keys.locations)}
          />
        </DTabsContent>

        <DTabsContent value="localization" className="mt-5">
          <LocalizationSection
            preferences={configuration.data?.preferences}
            loading={configuration.isLoading}
            canUpdate={canUpdateProfile}
            api={api}
            onChanged={() => invalidate(keys.configuration)}
          />
        </DTabsContent>

        <DTabsContent value="tax" className="mt-5">
          <TaxSection
            tax={configuration.data?.tax}
            loading={configuration.isLoading}
            canUpdate={canUpdateProfile}
            api={api}
            onChanged={() => invalidate(keys.configuration)}
          />
        </DTabsContent>

        <DTabsContent value="numbering" className="mt-5">
          <NumberingSection
            preferences={numbering.data ?? []}
            loading={numbering.isLoading}
            canUpdate={canUpdateProfile}
            invoiceApplicable={session.effectiveEntitlements.products.includes('POS')}
            api={api}
            onChanged={() => invalidate(keys.numbering)}
          />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 sm:p-6">
      {children}
    </section>
  );
}

function ProfileSection({
  profile,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  profile?: (BusinessProfile & { configured?: boolean }) | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? profile?.name ?? '';
  const close = () => {
    setOpen(false);
    setDraftName(null);
  };

  const save = async () => {
    if (!profile || !name.trim()) return;
    try {
      await api.updateProfile(profile, name.trim());
      onChanged();
      close();
      showToast({ variant: 'success', title: copy('Business profile updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update business profile.'))
            .safeMessage,
        });
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Business profile')}</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {copy(
              'This identity is the tenant business authority used by Backoffice and Operational.',
            )}
          </p>
        </div>
        {canUpdate && profile ? (
          <DButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {copy('Edit profile')}
          </DButton>
        ) : null}
      </div>
      {loading ? (
        <DSkeleton className="mt-5 h-7 w-56" />
      ) : (
        <p className="mt-5 text-lg font-semibold">{profile?.name ?? copy('Not configured')}</p>
      )}
      <DDialog
        open={open}
        onClose={close}
        title={copy('Business profile')}
        description={copy('Update the business identity consumed by authenticated applications.')}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={close}>
              {copy('Cancel')}
            </DButton>
            <DButton onClick={() => void save()} disabled={!name.trim()}>
              {copy('Save profile')}
            </DButton>
          </div>
        }
      >
        <DInput label={copy('Business name')} value={name} onChange={setDraftName} autoFocus />
      </DDialog>
    </Card>
  );
}

function percentageFromTaxRate(rate: string): string {
  const [whole = '0', fraction = ''] = rate.trim().split('.');
  if (whole === '1') return '100';
  const padded = fraction.padEnd(2, '0');
  const integer = padded.slice(0, 2).replace(/^0+(?=\d)/, '') || '0';
  const decimal = padded.slice(2).replace(/0+$/, '');
  return decimal ? `${integer}.${decimal}` : integer;
}

function taxRateFromPercentage(value: string): string {
  const [rawWhole = '0', fraction = ''] = value.trim().split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  if (whole === '100') return '1';
  const digits = `${whole.padStart(2, '0')}${fraction}`.replace(/0+$/, '');
  return digits ? `0.${digits}` : '0';
}

function TaxSection({
  tax,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  tax?: BusinessTaxConfiguration | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBusinessConfigurationI18n();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftPercent, setDraftPercent] = useState('11');
  const [saving, setSaving] = useState(false);

  const configuredPercent = tax ? percentageFromTaxRate(tax.rate) : '11';

  const edit = () => {
    if (!tax) return;
    setDraftEnabled(tax.enabled);
    setDraftPercent(configuredPercent);
    setOpen(true);
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
  };

  const percent = Number(draftPercent);
  const validPercent =
    draftPercent.trim().length > 0 && Number.isFinite(percent) && percent >= 0 && percent <= 100;

  const save = async () => {
    if (!tax || saving || !validPercent) return;
    setSaving(true);
    try {
      await api.updateTax(tax, {
        enabled: draftEnabled,
        rate: taxRateFromPercentage(draftPercent),
      });
      onChanged();
      setOpen(false);
      showToast({ variant: 'success', title: copy('Tax configuration updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update tax configuration.'))
            .safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Tax')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-(--color-text-muted)">
            {copy(
              'Tax is configured once for the business and applied by Runtime to transaction totals.',
            )}
          </p>
        </div>
        {canUpdate && tax ? (
          <DButton variant="secondary" size="sm" onClick={edit}>
            {copy('Edit tax')}
          </DButton>
        ) : null}
      </div>

      {loading ? (
        <DSkeleton className="mt-5 h-16" />
      ) : tax ? (
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <Fact label={copy('Enable tax')} value={copy(tax.enabled ? 'Active' : 'Inactive')} />
          <Fact label={copy('Tax percentage')} value={`${configuredPercent}%`} />
        </dl>
      ) : null}

      <DDialog
        open={open}
        onClose={close}
        title={copy('Tax')}
        description={copy(
          'New transactions use this business tax. Existing finalized transactions keep their recorded tax.',
        )}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={close} disabled={saving}>
              {copy('Cancel')}
            </DButton>
            <DButton onClick={() => void save()} loading={saving} disabled={!validPercent}>
              {copy('Save tax')}
            </DButton>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-5 rounded-(--radius-control) border border-(--color-border) px-4 py-3">
            <div>
              <p className="text-sm font-medium">{copy('Enable tax')}</p>
              <p className="mt-1 text-xs text-(--color-text-muted)">
                {copy('When disabled, new transactions have zero tax.')}
              </p>
            </div>
            <DToggle
              checked={draftEnabled}
              onChange={setDraftEnabled}
              ariaLabel={copy('Enable tax')}
            />
          </div>
          <DInput
            label={copy('Tax percentage')}
            inputMode="decimal"
            value={draftPercent}
            onChange={setDraftPercent}
            placeholder="11"
            hint={copy('Enter a percentage from 0 to 100.')}
            error={validPercent ? undefined : copy('Tax percentage must be between 0 and 100.')}
          />
        </div>
      </DDialog>
    </Card>
  );
}

function LocalizationSection({
  preferences,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  preferences?: BusinessPreferences | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draftLocale, setDraftLocale] = useState<BusinessPreferences['defaultLocale'] | null>(null);
  const [draftTimezone, setDraftTimezone] = useState<string | null>(null);
  const [draftDateFormat, setDraftDateFormat] = useState<BusinessPreferences['dateFormat'] | null>(
    null,
  );
  const [draftTimeFormat, setDraftTimeFormat] = useState<BusinessPreferences['timeFormat'] | null>(
    null,
  );
  const locale = draftLocale ?? preferences?.defaultLocale ?? 'id-ID';
  const timezone = draftTimezone ?? preferences?.timezone ?? 'Asia/Jakarta';
  const dateFormat = draftDateFormat ?? preferences?.dateFormat ?? 'DD/MM/YYYY';
  const timeFormat = draftTimeFormat ?? preferences?.timeFormat ?? 'HH:mm';
  const close = () => {
    setOpen(false);
    setDraftLocale(null);
    setDraftTimezone(null);
    setDraftDateFormat(null);
    setDraftTimeFormat(null);
  };

  const save = async () => {
    if (!preferences || !timezone.trim()) return;
    try {
      await api.updatePreferences(preferences, {
        defaultLocale: locale,
        timezone: timezone.trim(),
        dateFormat,
        timeFormat,
      });
      onChanged();
      close();
      showToast({ variant: 'success', title: copy('Localization updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update localization.'))
            .safeMessage,
        });
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Localization')}</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {copy('Persisted values become the tenant default after save.')}
          </p>
        </div>
        {canUpdate && preferences ? (
          <DButton variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {copy('Edit localization')}
          </DButton>
        ) : null}
      </div>
      {loading ? (
        <DSkeleton className="mt-5 h-20" />
      ) : preferences ? (
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label={copy('Default language')} value={preferences.defaultLocale} />
          <Fact label={copy('Timezone')} value={preferences.timezone} />
          <Fact label={copy('Date format')} value={preferences.dateFormat} />
          <Fact label={copy('Time format')} value={preferences.timeFormat} />
        </dl>
      ) : null}
      <DDialog
        open={open}
        onClose={close}
        title={copy('Localization')}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={close}>
              {copy('Cancel')}
            </DButton>
            <DButton onClick={() => void save()} disabled={!timezone.trim()}>
              {copy('Save localization')}
            </DButton>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DSelect
            label={copy('Default language')}
            value={locale}
            clearable={false}
            options={[
              { value: 'id-ID', label: copy('Indonesian') },
              { value: 'en-US', label: copy('English') },
            ]}
            onValueChange={(value) => {
              if (value === 'id-ID' || value === 'en-US') setDraftLocale(value);
            }}
          />
          <DInput
            label={copy('Timezone')}
            value={timezone}
            onChange={setDraftTimezone}
            placeholder="Asia/Jakarta"
          />
          <DSelect
            label={copy('Date format')}
            value={dateFormat}
            clearable={false}
            options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((value) => ({
              value,
              label: value,
            }))}
            onValueChange={(value) => {
              if (value === 'DD/MM/YYYY' || value === 'MM/DD/YYYY' || value === 'YYYY-MM-DD')
                setDraftDateFormat(value);
            }}
          />
          <DSelect
            label={copy('Time format')}
            value={timeFormat}
            clearable={false}
            options={[
              { value: 'HH:mm', label: '24-hour (HH:mm)' },
              { value: 'hh:mm a', label: '12-hour (hh:mm a)' },
            ]}
            onValueChange={(value) => {
              if (value === 'HH:mm' || value === 'hh:mm a') setDraftTimeFormat(value);
            }}
          />
        </div>
      </DDialog>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-(--color-text-muted)">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function LocationsSection({
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
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<SellingLocation | null | undefined>();
  const [deactivating, setDeactivating] = useState<SellingLocation | null>(null);

  const columns: TableColumn<SellingLocation>[] = [
    {
      key: 'name',
      label: copy('Selling location'),
      render: (item) => (
        <div className="flex gap-2">
          <span className="font-medium">{item.name}</span>
          {item.isMain ? <DBadge variant="secondary">{copy('Main Branch')}</DBadge> : null}
        </div>
      ),
    },
    { key: 'code', label: copy('Code') },
    {
      key: 'status',
      label: copy('Status'),
      render: (item) => (
        <DBadge variant={item.status === 'ACTIVE' ? 'outline' : 'secondary'}>
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
    <>
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
        <LocationDialog
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
    </>
  );
}

function LocationDialog({
  location,
  items,
  api,
  onClose,
  onChanged,
}: {
  location: SellingLocation | null | undefined;
  items: SellingLocation[];
  api: BusinessSettingsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const isNew = location === null;
  const [code, setCode] = useState('');
  const [name, setName] = useState(location?.name ?? '');
  const [main, setMain] = useState(
    Boolean(location?.isMain) || (location === null && items.length === 0),
  );

  const save = async () => {
    if (!name.trim() || (isNew && !code.trim())) return;
    try {
      if (isNew)
        await api.createLocation({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          setAsMain: main || undefined,
        });
      else if (location)
        await api.updateLocation(location, {
          name: name.trim(),
          setAsMain: main && !location.isMain ? true : undefined,
        });
      onChanged();
      onClose();
      showToast({
        variant: 'success',
        title: copy(isNew ? 'Selling location added.' : 'Selling location updated.'),
      });
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
    <DDialog
      open={location !== undefined}
      onClose={onClose}
      title={copy(isNew ? 'Add selling location' : 'Edit selling location')}
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
      <div className="space-y-4">
        {isNew ? (
          <DInput label={copy('Location code')} value={code} onChange={setCode} />
        ) : (
          <DInput
            label={copy('Location code')}
            value={location?.code ?? ''}
            onChange={() => undefined}
            disabled
          />
        )}
        <DInput label={copy('Selling location')} value={name} onChange={setName} />
        <label className="flex items-center gap-2 text-sm">
          <DCheckbox
            checked={main}
            onChange={() => setMain((value) => !value)}
            disabled={Boolean(location?.isMain)}
          />
          {copy('Use as Main Branch')}
        </label>
      </div>
    </DDialog>
  );
}

function NumberingSection({
  preferences,
  loading,
  canUpdate,
  invoiceApplicable,
  api,
  onChanged,
}: {
  preferences: NumberingPreference[];
  loading: boolean;
  canUpdate: boolean;
  invoiceApplicable: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<NumberingPreference | null>(null);
  const visible = preferences.filter((item) => item.namespace !== 'INVOICE' || invoiceApplicable);
  const labels: Record<NumberingPreference['namespace'], string> = {
    PRODUCT: copy('Product'),
    SERVICE: copy('Service'),
    CATEGORY: copy('Category'),
    VARIANT: copy('Variant'),
    EMPLOYEE: copy('Employee'),
    EMPLOYEE_POSITION: copy('Employee Position'),
    SALE: copy('Sale / Transaction'),
    INVOICE: copy('Invoice'),
  };

  return (
    <Card>
      <h2 className="font-semibold">{copy('Numbering')}</h2>
      <p className="mt-1 text-sm text-(--color-text-muted)">
        {copy(
          'Configure presentation only. Runtime remains the sequence authority and current sequence cannot be reset here.',
        )}
      </p>
      {loading ? (
        <DSkeleton className="mt-5 h-32" />
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <div key={item.namespace} className="rounded-lg border border-(--color-border) p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{labels[item.namespace]}</p>
                  <p className="mt-1 text-sm text-(--color-text-muted)">
                    {item.prefix} · {copy('Padding')} {item.padding}
                  </p>
                </div>
                {canUpdate ? (
                  <DButton variant="secondary" size="sm" onClick={() => setEditing(item)}>
                    {copy('Edit')}
                  </DButton>
                ) : null}
              </div>
              <p className="mt-4 text-xs text-(--color-text-muted)">{copy('Current sequence')}</p>
              <p className="mt-1 font-mono font-semibold">{item.currentSequence}</p>
            </div>
          ))}
        </div>
      )}
      {editing ? (
        <NumberingDialog
          key={editing.namespace}
          preference={editing}
          api={api}
          onClose={() => setEditing(null)}
          onChanged={() => {
            onChanged();
            showToast({ variant: 'success', title: copy('Numbering updated.') });
          }}
        />
      ) : null}
    </Card>
  );
}

function NumberingDialog({
  preference,
  api,
  onClose,
  onChanged,
}: {
  preference: NumberingPreference;
  api: BusinessSettingsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [prefix, setPrefix] = useState(preference.prefix);
  const [padding, setPadding] = useState(String(preference.padding));

  const valid =
    /^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(prefix) &&
    Number.isInteger(Number(padding)) &&
    Number(padding) >= 1 &&
    Number(padding) <= 12;

  const save = async () => {
    if (!valid) return;
    try {
      await api.updateNumbering(preference, {
        prefix,
        padding: Number(padding),
      });
      onChanged();
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update numbering.'))
            .safeMessage,
        });
    }
  };

  return (
    <DDialog
      open
      onClose={onClose}
      title={copy('Edit numbering')}
      description={copy(
        'Prefix and padding affect future official values only. Current sequence is read-only.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton onClick={() => void save()} disabled={!valid}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DInput
          label={copy('Prefix')}
          value={prefix}
          onChange={(value) => setPrefix(value.toUpperCase())}
        />
        <DInput label={copy('Padding')} value={padding} onChange={setPadding} />
      </div>
      <p className="mt-4 text-sm text-(--color-text-muted)">
        {copy('Current sequence')}: {preference.currentSequence}
      </p>
    </DDialog>
  );
}
