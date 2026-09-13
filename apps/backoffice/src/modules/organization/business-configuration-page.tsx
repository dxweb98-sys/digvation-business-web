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
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleOff, MapPinPlus, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import {
  BackofficePage,
  BackofficePageHeader,
} from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import type { BackofficeSession } from '../../auth/auth-session';
import {
  isSessionExpiredError,
  useBackofficeAuth,
} from '../../auth/backoffice-auth-context';
import {
  isReportAvailable,
  type ReportType,
} from '../reporting/report-availability';
import {
  BusinessSettingsApi,
  type BusinessExperiencePreferences,
  type BusinessPreferences,
  type BusinessProfile,
  type ConfigurableReport,
  type DashboardWidget,
  type NumberingPreference,
  type SellingLocation,
} from './business-settings-api';

const keys = {
  configuration: ['business-settings', 'configuration'] as const,
  locations: ['business-settings', 'locations'] as const,
  numbering: ['business-settings', 'numbering'] as const,
  experience: ['business-settings', 'experience'] as const,
};

const dashboardOptions: Array<{
  key: DashboardWidget;
  label: string;
  report: ReportType;
}> = [
  { key: 'TOP_ITEMS', label: 'Top catalog items', report: 'catalog-performance' },
  { key: 'PAYMENT_MIX', label: 'Payment mix', report: 'payments' },
  { key: 'RECENT_TRANSACTIONS', label: 'Recent transactions', report: 'transactions' },
  { key: 'TOP_EMPLOYEES', label: 'Top employees', report: 'employee-performance' },
  { key: 'BUSINESS_INSIGHT', label: 'Business insight', report: 'business-performance' },
];

const reportOptions: Array<{ key: ConfigurableReport; label: string }> = [
  { key: 'business-performance', label: 'Business Performance Summary' },
  { key: 'transactions', label: 'Transaction Report' },
  { key: 'catalog-performance', label: 'Catalog Performance' },
  { key: 'employee-performance', label: 'Employee Performance' },
  { key: 'attendance', label: 'Attendance Report' },
  { key: 'payments', label: 'Payment Report' },
  { key: 'expenses', label: 'Expense Report' },
  { key: 'cash', label: 'Cash Report' },
  { key: 'settlements', label: 'Settlement Report' },
  { key: 'reconciliations', label: 'Reconciliation Report' },
  { key: 'tax', label: 'Tax Report' },
  { key: 'locations', label: 'Selling Location Performance' },
];

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

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
  const experience = useQuery({
    queryKey: keys.experience,
    queryFn: () => api.getExperience(),
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
          'Manage business identity, locations, localization, numbering, and visible business experiences from one authoritative configuration.',
        )}
      />

      <DTabs defaultValue={firstTab} className="mt-6">
        <DTabsList>
          {canViewProfile ? (
            <DTabsTrigger value="profile">{copy('Profile')}</DTabsTrigger>
          ) : null}
          {canViewLocations ? (
            <DTabsTrigger value="locations">{copy('Locations')}</DTabsTrigger>
          ) : null}
          {canViewProfile ? (
            <DTabsTrigger value="localization">
              {copy('Localization')}
            </DTabsTrigger>
          ) : null}
          {canViewProfile ? (
            <DTabsTrigger value="numbering">{copy('Numbering')}</DTabsTrigger>
          ) : null}
          {canViewProfile ? (
            <DTabsTrigger value="dashboard-reports">
              {copy('Dashboard & Reports')}
            </DTabsTrigger>
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

        <DTabsContent value="dashboard-reports" className="mt-5">
          <ExperienceSection
            preferences={experience.data}
            loading={experience.isLoading}
            canUpdate={canUpdateProfile}
            session={session}
            api={api}
            onChanged={() => invalidate(keys.experience)}
          />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
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
  profile?: BusinessProfile & { configured?: boolean };
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => setName(profile?.name ?? ''), [profile?.name]);

  const save = async () => {
    if (!profile || !name.trim()) return;
    try {
      await api.updateProfile(profile, name.trim());
      onChanged();
      setOpen(false);
      showToast({ variant: 'success', title: copy('Business profile updated.') });
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
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Business profile')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
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
        <p className="mt-5 text-lg font-semibold">
          {profile?.name ?? copy('Not configured')}
        </p>
      )}
      <DDialog
        open={open}
        onClose={() => setOpen(false)}
        title={copy('Business profile')}
        description={copy(
          'Update the business identity consumed by authenticated applications.',
        )}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setOpen(false)}>
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
          autoFocus
        />
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
  preferences?: BusinessPreferences;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] =
    useState<BusinessPreferences['defaultLocale']>('id-ID');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [dateFormat, setDateFormat] =
    useState<BusinessPreferences['dateFormat']>('DD/MM/YYYY');
  const [timeFormat, setTimeFormat] =
    useState<BusinessPreferences['timeFormat']>('HH:mm');

  useEffect(() => {
    if (!preferences) return;
    setLocale(preferences.defaultLocale);
    setTimezone(preferences.timezone);
    setDateFormat(preferences.dateFormat);
    setTimeFormat(preferences.timeFormat);
  }, [preferences]);

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
      setOpen(false);
      showToast({ variant: 'success', title: copy('Localization updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not update localization.'),
          ).safeMessage,
        });
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Localization')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
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
        onClose={() => setOpen(false)}
        title={copy('Localization')}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setOpen(false)}>
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
            onValueChange={(value) =>
              setLocale(value as BusinessPreferences['defaultLocale'])
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
            options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((value) => ({
              value,
              label: value,
            }))}
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
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
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
          {item.isMain ? (
            <DBadge variant="secondary">{copy('Main Branch')}</DBadge>
          ) : null}
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
          title: normalizeBackofficeApiError(
            error,
            copy('Could not save selling location.'),
          ).safeMessage,
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
            <DButton
              leftIcon={<MapPinPlus className="size-4" />}
              onClick={() => setEditing(null)}
            >
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
      <LocationDialog
        location={editing}
        items={items}
        api={api}
        onClose={() => setEditing(undefined)}
        onChanged={onChanged}
      />
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
  const [name, setName] = useState('');
  const [main, setMain] = useState(false);

  useEffect(() => {
    setName(location?.name ?? '');
    setCode('');
    setMain(Boolean(location?.isMain) || (location === null && items.length === 0));
  }, [location, items.length]);

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
      title={copy(isNew ? 'Add selling location' : 'Edit selling location')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            onClick={() => void save()}
            disabled={!name.trim() || (isNew && !code.trim())}
          >
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
  const visible = preferences.filter(
    (item) => item.namespace !== 'INVOICE' || invoiceApplicable,
  );
  const labels: Record<NumberingPreference['namespace'], string> = {
    SALE: copy('Sale / Transaction'),
    EMPLOYEE: copy('Employee'),
    INVOICE: copy('Invoice'),
  };

  return (
    <Card>
      <h2 className="font-semibold">{copy('Numbering')}</h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {copy(
          'Configure presentation only. Runtime remains the sequence authority and current sequence cannot be reset here.',
        )}
      </p>
      {loading ? (
        <DSkeleton className="mt-5 h-32" />
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {visible.map((item) => (
            <div
              key={item.namespace}
              className="rounded-lg border border-[var(--color-border)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{labels[item.namespace]}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {item.prefix} · {copy('Padding')} {item.padding}
                  </p>
                </div>
                {canUpdate ? (
                  <DButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(item)}
                  >
                    {copy('Edit')}
                  </DButton>
                ) : null}
              </div>
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                {copy('Current sequence')}
              </p>
              <p className="mt-1 font-mono font-semibold">{item.currentSequence}</p>
            </div>
          ))}
        </div>
      )}
      <NumberingDialog
        preference={editing}
        api={api}
        onClose={() => setEditing(null)}
        onChanged={() => {
          onChanged();
          showToast({ variant: 'success', title: copy('Numbering updated.') });
        }}
      />
    </Card>
  );
}

function NumberingDialog({
  preference,
  api,
  onClose,
  onChanged,
}: {
  preference: NumberingPreference | null;
  api: BusinessSettingsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [prefix, setPrefix] = useState('');
  const [padding, setPadding] = useState('6');

  useEffect(() => {
    setPrefix(preference?.prefix ?? '');
    setPadding(String(preference?.padding ?? 6));
  }, [preference]);

  const valid =
    /^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(prefix) &&
    Number.isInteger(Number(padding)) &&
    Number(padding) >= 1 &&
    Number(padding) <= 12;

  const save = async () => {
    if (!preference || !valid) return;
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
          title: normalizeBackofficeApiError(
            error,
            copy('Could not update numbering.'),
          ).safeMessage,
        });
    }
  };

  return (
    <DDialog
      open={Boolean(preference)}
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
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        {copy('Current sequence')}: {preference?.currentSequence ?? 0}
      </p>
    </DDialog>
  );
}

function ExperienceSection({
  preferences,
  loading,
  canUpdate,
  session,
  api,
  onChanged,
}: {
  preferences?: BusinessExperiencePreferences;
  loading: boolean;
  canUpdate: boolean;
  session: BackofficeSession;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidget[]>([]);
  const [hiddenReports, setHiddenReports] = useState<ConfigurableReport[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setHiddenWidgets([...preferences.hiddenDashboardWidgets]);
    setHiddenReports([...preferences.hiddenReports]);
  }, [preferences]);

  const availableWidgets = dashboardOptions.filter((item) =>
    isReportAvailable(session, item.report),
  );
  const availableReports = reportOptions.filter((item) =>
    isReportAvailable(session, item.key),
  );

  const save = async () => {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      await api.updateExperience({
        ...preferences,
        hiddenDashboardWidgets: hiddenWidgets,
        hiddenReports,
      });
      onChanged();
      showToast({
        variant: 'success',
        title: copy('Dashboard and report visibility updated.'),
      });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(
            error,
            copy('Could not update visibility preferences.'),
          ).safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Card>
        <DSkeleton className="h-40" />
      </Card>
    );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Dashboard & Reports')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy(
              'These preferences can hide available experiences. They never grant entitlement, permission, or location access.',
            )}
          </p>
        </div>
        {canUpdate && preferences ? (
          <DButton onClick={() => void save()} disabled={saving}>
            {copy('Save visibility')}
          </DButton>
        ) : null}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <VisibilityGroup
          title={copy('Dashboard')}
          items={availableWidgets.map((item) => ({
            key: item.key,
            label: copy(item.label),
            hidden: hiddenWidgets.includes(item.key),
          }))}
          disabled={!canUpdate}
          onToggle={(key) =>
            setHiddenWidgets((values) =>
              toggleValue(values, key as DashboardWidget),
            )
          }
        />
        <VisibilityGroup
          title={copy('Reports')}
          items={availableReports.map((item) => ({
            key: item.key,
            label: copy(item.label),
            hidden: hiddenReports.includes(item.key),
          }))}
          disabled={!canUpdate}
          onToggle={(key) =>
            setHiddenReports((values) =>
              toggleValue(values, key as ConfigurableReport),
            )
          }
        />
      </div>
    </Card>
  );
}

function VisibilityGroup({
  title,
  items,
  disabled,
  onToggle,
}: {
  title: string;
  items: Array<{ key: string; label: string; hidden: boolean }>;
  disabled: boolean;
  onToggle: (key: string) => void;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <span>{item.label}</span>
              <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <DCheckbox
                  checked={!item.hidden}
                  onChange={() => onToggle(item.key)}
                  disabled={disabled}
                />
                {copy(item.hidden ? 'Hidden' : 'Visible')}
              </span>
            </label>
          ))
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('No available items for the current tenant and role.')}
          </p>
        )}
      </div>
    </div>
  );
}
