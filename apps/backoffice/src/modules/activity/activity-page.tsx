import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDateRangeFilter,
  DDialog,
  DSelectFilter,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useRuntime } from '@digvation/business-runtime';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { ActivityApi, type ActivityActor, type ActivityEvent } from './activity-api';

const defaultPageSize = 30;

type LocalizedLabel = { id: string; en: string };

const categoryLabels: Record<string, LocalizedLabel> = {
  SECURITY: { id: 'Keamanan', en: 'Security' },
  CONFIGURATION: { id: 'Konfigurasi', en: 'Configuration' },
  FINANCE: { id: 'Keuangan', en: 'Finance' },
  CATALOG: { id: 'Katalog', en: 'Catalog' },
  TAX: { id: 'Pajak', en: 'Tax' },
  PRICING: { id: 'Harga', en: 'Pricing' },
  WORKFORCE: { id: 'Tenaga kerja', en: 'Workforce' },
  SALES: { id: 'Penjualan', en: 'Sales' },
  PAYMENT: { id: 'Pembayaran', en: 'Payment' },
  FULFILLMENT: { id: 'Pengerjaan', en: 'Fulfillment' },
};

const eventLabels: Record<string, LocalizedLabel> = {
  LOGIN_SUCCEEDED: { id: 'Login berhasil', en: 'Login succeeded' },
  LOGOUT: { id: 'Logout', en: 'Logout' },
  BUSINESS_NUMBERING_UPDATED: { id: 'Pengaturan penomoran diperbarui', en: 'Numbering settings updated' },
  EXPENSE_APPROVED: { id: 'Pengeluaran disetujui', en: 'Expense approved' },
  EXPENSE_REJECTED: { id: 'Pengeluaran ditolak', en: 'Expense rejected' },
  EXPENSE_CREATED: { id: 'Pengeluaran dibuat', en: 'Expense created' },
  EXPENSE_UPDATED: { id: 'Pengeluaran diperbarui', en: 'Expense updated' },
  BUSINESS_PROFILE_UPDATED: { id: 'Profil bisnis diperbarui', en: 'Business profile updated' },
  BUSINESS_LOCALIZATION_UPDATED: { id: 'Pengaturan bahasa dan waktu diperbarui', en: 'Localization and time settings updated' },
  LOCATION_CREATED: { id: 'Lokasi dibuat', en: 'Location created' },
  LOCATION_UPDATED: { id: 'Lokasi diperbarui', en: 'Location updated' },
  CATALOG_CATEGORY_CREATED: { id: 'Kategori katalog dibuat', en: 'Catalog category created' },
  CATALOG_CATEGORY_UPDATED: { id: 'Kategori katalog diperbarui', en: 'Catalog category updated' },
  CATALOG_ITEM_CREATED: { id: 'Item katalog dibuat', en: 'Catalog item created' },
  CATALOG_ITEM_UPDATED: { id: 'Item katalog diperbarui', en: 'Catalog item updated' },
  CATALOG_VARIANT_CREATED: { id: 'Varian katalog dibuat', en: 'Catalog variant created' },
  CATALOG_VARIANT_UPDATED: { id: 'Varian katalog diperbarui', en: 'Catalog variant updated' },
  EMPLOYEE_POSITION_CREATED: { id: 'Jabatan karyawan dibuat', en: 'Employee position created' },
  EMPLOYEE_POSITION_UPDATED: { id: 'Jabatan karyawan diperbarui', en: 'Employee position updated' },
  ATTENDANCE_UPDATED: { id: 'Absensi diperbarui', en: 'Attendance updated' },
  EMPLOYEE_CREATED: { id: 'Karyawan dibuat', en: 'Employee created' },
  EMPLOYEE_UPDATED: { id: 'Karyawan diperbarui', en: 'Employee updated' },
  LOCATION_ACCESS_REPLACED: { id: 'Akses lokasi pengguna diperbarui', en: 'User location access updated' },
  TAX_PROFILE_UPDATED: { id: 'Profil pajak diperbarui', en: 'Tax profile updated' },
  TAX_RULE_CREATED: { id: 'Aturan pajak dibuat', en: 'Tax rule created' },
  TAX_RULE_CANCELLED: { id: 'Aturan pajak dibatalkan', en: 'Tax rule cancelled' },
  TAX_CATEGORY_CREATED: { id: 'Kategori pajak dibuat', en: 'Tax category created' },
  TAX_CATEGORY_UPDATED: { id: 'Kategori pajak diperbarui', en: 'Tax category updated' },
  PRICE_CREATED: { id: 'Harga dibuat', en: 'Price created' },
  PRICE_CHANGED: { id: 'Harga diubah', en: 'Price changed' },
  PRICE_CANCELLED: { id: 'Harga dibatalkan', en: 'Price cancelled' },
  FINANCIAL_ACCOUNT_CREATED: { id: 'Akun keuangan dibuat', en: 'Financial account created' },
  FINANCIAL_ACCOUNT_UPDATED: { id: 'Akun keuangan diperbarui', en: 'Financial account updated' },
  PAYMENT_ROUTE_CREATED: { id: 'Rute pembayaran dibuat', en: 'Payment route created' },
  PAYMENT_ROUTE_UPDATED: { id: 'Rute pembayaran diperbarui', en: 'Payment route updated' },
  CASH_MOVEMENT_CREATED: { id: 'Pergerakan kas dicatat', en: 'Cash movement recorded' },
  SETTLEMENT_CREATED: { id: 'Settlement dibuat', en: 'Settlement created' },
  SETTLEMENT_COMPLETED: { id: 'Settlement diselesaikan', en: 'Settlement completed' },
  SETTLEMENT_CANCELLED: { id: 'Settlement dibatalkan', en: 'Settlement cancelled' },
  RECONCILIATION_CREATED: { id: 'Rekonsiliasi dibuat', en: 'Reconciliation created' },
  RECONCILIATION_UPDATED: { id: 'Rekonsiliasi diperbarui', en: 'Reconciliation updated' },
  SALE_CREATED: { id: 'Transaksi dibuat', en: 'Transaction created' },
  SALE_LINE_ADDED: { id: 'Item transaksi ditambahkan', en: 'Transaction item added' },
  SALE_LINE_QUANTITY_CHANGED: { id: 'Jumlah item transaksi diubah', en: 'Transaction item quantity changed' },
  SALE_LINE_REMOVED: { id: 'Item transaksi dihapus', en: 'Transaction item removed' },
  SALE_LINE_PRICE_OVERRIDDEN: { id: 'Harga item transaksi dioverride', en: 'Transaction item price overridden' },
  SALE_LINE_PRICE_OVERRIDE_REMOVED: { id: 'Override harga item transaksi dihapus', en: 'Transaction item price override removed' },
  SALE_LINE_DISCOUNT_APPLIED: { id: 'Diskon item transaksi diterapkan', en: 'Transaction item discount applied' },
  SALE_LINE_DISCOUNT_REMOVED: { id: 'Diskon item transaksi dihapus', en: 'Transaction item discount removed' },
  SALE_DISCOUNT_APPLIED: { id: 'Diskon transaksi diterapkan', en: 'Transaction discount applied' },
  SALE_DISCOUNT_REMOVED: { id: 'Diskon transaksi dihapus', en: 'Transaction discount removed' },
  SALE_LINE_ASSIGNMENTS_CHANGED: { id: 'Penugasan item transaksi diubah', en: 'Transaction item assignment changed' },
  SALE_LINE_CONTRIBUTIONS_CHANGED: { id: 'Kontribusi item transaksi diubah', en: 'Transaction item contribution changed' },
  SALE_FINALIZED: { id: 'Transaksi diselesaikan', en: 'Transaction finalized' },
  SALE_VOIDED: { id: 'Transaksi dibatalkan', en: 'Transaction voided' },
  SALE_QUEUED: { id: 'Transaksi masuk antrian', en: 'Transaction queued' },
  SALE_WORK_STARTED: { id: 'Pengerjaan transaksi dimulai', en: 'Transaction work started' },
  PAYMENT_CREATED: { id: 'Pembayaran dibuat', en: 'Payment created' },
  PAYMENT_SUCCEEDED: { id: 'Pembayaran berhasil', en: 'Payment succeeded' },
  PAYMENT_FAILED: { id: 'Pembayaran gagal', en: 'Payment failed' },
  PAYMENT_CANCELLED: { id: 'Pembayaran dibatalkan', en: 'Payment cancelled' },
  PAYMENT_EXPIRED: { id: 'Pembayaran kedaluwarsa', en: 'Payment expired' },
  FULFILLMENT_STARTED: { id: 'Pengerjaan item dimulai', en: 'Fulfillment started' },
  FULFILLMENT_COMPLETED: { id: 'Pengerjaan item selesai', en: 'Fulfillment completed' },
  FULFILLMENT_CANCELLED: { id: 'Pengerjaan item dibatalkan', en: 'Fulfillment cancelled' },
  OWNER_PROVISIONED: { id: 'Owner disiapkan', en: 'Owner provisioned' },
  OWNER_GRANTED: { id: 'Peran Owner diberikan', en: 'Owner role granted' },
  OWNER_REVOKED: { id: 'Peran Owner dicabut', en: 'Owner role revoked' },
  INVITATION_CREATED: { id: 'Undangan pengguna dibuat', en: 'User invitation created' },
  INVITATION_RESENT: { id: 'Undangan pengguna dikirim ulang', en: 'User invitation resent' },
  INVITATION_REVOKED: { id: 'Undangan pengguna dibatalkan', en: 'User invitation revoked' },
  INVITATION_ACCEPTED: { id: 'Undangan pengguna diterima', en: 'User invitation accepted' },
  USER_UPDATED: { id: 'Pengguna diperbarui', en: 'User updated' },
  USER_ENABLED: { id: 'Pengguna diaktifkan', en: 'User enabled' },
  USER_DISABLED: { id: 'Pengguna dinonaktifkan', en: 'User disabled' },
  USER_ROLES_CHANGED: { id: 'Peran pengguna diubah', en: 'User roles changed' },
  ROLE_CREATED: { id: 'Peran dibuat', en: 'Role created' },
  ROLE_UPDATED: { id: 'Peran diperbarui', en: 'Role updated' },
  ROLE_STATUS_CHANGED: { id: 'Status peran diubah', en: 'Role status changed' },
  ROLE_PERMISSIONS_CHANGED: { id: 'Izin peran diubah', en: 'Role permissions changed' },
  USER_SESSIONS_REVOKED: { id: 'Sesi pengguna dicabut', en: 'User sessions revoked' },
  PASSWORD_CHANGED: { id: 'Kata sandi diubah', en: 'Password changed' },
  PASSWORD_RESET_COMPLETED: { id: 'Reset kata sandi selesai', en: 'Password reset completed' },
  LOCATION_ACCESS_GRANTED: { id: 'Akses lokasi diberikan', en: 'Location access granted' },
  LOCATION_ACCESS_REVOKED: { id: 'Akses lokasi dicabut', en: 'Location access revoked' },
};

const targetTypeLabels: Record<string, LocalizedLabel> = {
  EXPENSE: { id: 'Pengeluaran', en: 'Expense' },
  INVITATION: { id: 'Undangan pengguna', en: 'User invitation' },
  NUMBERING_PREFERENCE: { id: 'Penomoran', en: 'Numbering' },
  BUSINESS_PREFERENCES: { id: 'Pengaturan bahasa, tanggal & waktu', en: 'Localization and time settings' },
  ROLE: { id: 'Peran', en: 'Role' },
  USER: { id: 'Pengguna', en: 'User' },
  LOCATION: { id: 'Lokasi', en: 'Location' },
  CATALOG_CATEGORY: { id: 'Kategori', en: 'Category' },
  CATALOG_ITEM: { id: 'Item katalog', en: 'Catalog item' },
  CATALOG_VARIANT: { id: 'Varian katalog', en: 'Catalog variant' },
  TAX_PROFILE: { id: 'Profil pajak', en: 'Tax profile' },
  TAX_RULE: { id: 'Aturan pajak', en: 'Tax rule' },
  TAX_CATEGORY: { id: 'Kategori pajak', en: 'Tax category' },
  CATALOG_PRICE: { id: 'Harga', en: 'Price' },
  EMPLOYEE: { id: 'Karyawan', en: 'Employee' },
  EMPLOYEE_POSITION: { id: 'Jabatan karyawan', en: 'Employee position' },
  FINANCIAL_ACCOUNT: { id: 'Akun keuangan', en: 'Financial account' },
  PAYMENT_ROUTE: { id: 'Rute pembayaran', en: 'Payment routing' },
  CASH_MOVEMENT: { id: 'Pergerakan kas', en: 'Cash movement' },
  SETTLEMENT: { id: 'Settlement', en: 'Settlement' },
  RECONCILIATION: { id: 'Rekonsiliasi', en: 'Reconciliation' },
  SALE: { id: 'Transaksi', en: 'Transaction' },
  SALE_LINE: { id: 'Item transaksi', en: 'Transaction item' },
  PAYMENT: { id: 'Pembayaran', en: 'Payment' },
  FULFILLMENT: { id: 'Pengerjaan', en: 'Fulfillment' },
};

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, copy, formatDateTime, locale } = useBackofficeLocalization();
  const api = useMemo(
    () => new ActivityApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState('');
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const list = useQuery({
    queryKey: ['activity', offset, pageSize, from, to, actorUserId, category, locationId],
    queryFn: () => api.list({ offset, limit: pageSize, from, to, actorUserId, category, locationId }),
  });
  const facets = useQuery({
    queryKey: ['activity-facets'],
    queryFn: () => api.facets(),
    staleTime: 300_000,
  });
  const resetPage = () => setOffset(0);
  const actorOptions = (facets.data?.actors ?? []).map((actor) => ({
    value: actor.id,
    label: actorCompactLabel(actor),
  }));
  const locationOptions = (facets.data?.locations ?? []).map((location) => ({
    value: location.id,
    label: `${location.name} · ${location.code}`,
  }));
  const localized = (label: LocalizedLabel | undefined, fallback: string) =>
    label?.[locale] ?? fallback;
  const columns: TableColumn<ActivityEvent>[] = [
    {
      key: 'occurredAt',
      label: copy('Time'),
      render: (item) => formatDateTime(item.occurredAt),
    },
    {
      key: 'actor',
      label: copy('Actor'),
      render: (item) => <ActorIdentity actor={item.actor} systemLabel={copy('System')} />,
    },
    {
      key: 'eventType',
      label: copy('Action'),
      render: (item) => eventLabel(item.eventType, locale),
    },
    {
      key: 'target',
      label: copy('Target / reference'),
      render: (item) => targetSummary(item, locale) ?? '—',
    },
    {
      key: 'category',
      label: copy('Category'),
      render: (item) => (
        <DBadge variant="outline">
          {localized(categoryLabels[item.category], humanize(item.category))}
        </DBadge>
      ),
    },
    {
      key: 'location',
      label: copy('Location'),
      render: (item) => (
        <div>
          <div>{item.locationName ?? '—'}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {sourceLabel(item.source, locale)}
          </div>
        </div>
      ),
    },
    {
      key: 'outcome',
      label: copy('Outcome'),
      render: (item) => <DBadge variant="outline">{outcomeLabel(item.outcome, locale)}</DBadge>,
    },
  ];
  if (list.isError) {
    return (
      <DConnectionError
        title={copy('Could not load activity.')}
        message={copy('Try loading activity again.')}
        onRetry={() => void list.refetch()}
        isRetrying={list.isFetching}
      />
    );
  }
  const filtered = Boolean(from || to || actorUserId || category || locationId);
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Audit')}
        title={t('activity')}
        description={copy('Review important business and access actions safely.')}
      />
      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          onRowClick={setDetail}
          filters={
            <div className="flex flex-wrap gap-2">
              <DDateRangeFilter
                from={from}
                to={to}
                onFromChange={(value) => { setFrom(value); resetPage(); }}
                onToChange={(value) => { setTo(value); resetPage(); }}
                onClear={() => { setFrom(''); setTo(''); resetPage(); }}
              />
              <DSelectFilter
                label={copy('User')}
                placeholder={copy('All users')}
                value={actorUserId || null}
                clearable
                options={actorOptions}
                onChange={(value) => { setActorUserId(String(value ?? '')); resetPage(); }}
              />
              <DSelectFilter
                label={copy('Category')}
                value={category || null}
                clearable
                options={Object.entries(categoryLabels).map(([value, label]) => ({
                  value,
                  label: label[locale],
                }))}
                onChange={(value) => { setCategory(String(value ?? '')); resetPage(); }}
              />
              <DSelectFilter
                label={copy('Location')}
                placeholder={copy('All locations')}
                value={locationId || null}
                clearable
                options={locationOptions}
                onChange={(value) => { setLocationId(String(value ?? '')); resetPage(); }}
              />
            </div>
          }
          pagination={{
            page: Math.floor(offset / pageSize) + 1,
            pageSize,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)}
          onPageSizeChange={(size) => { setPageSize(size); resetPage(); }}
          emptyMessage={copy(
            filtered
              ? 'No activity matches the current filters.'
              : 'No activity has been recorded yet.',
          )}
        />
      </section>
      <ActivityDetail item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityEvent | null; onClose: () => void }) {
  const { copy, formatDateTime, locale } = useBackofficeLocalization();
  const target = item ? targetSummary(item, locale) : undefined;
  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      title={item ? eventLabel(item.eventType, locale) : copy('Activity details')}
      description={item ? formatDateTime(item.occurredAt) : undefined}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton>
        </div>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="outline">
              {categoryLabels[item.category]?.[locale] ?? humanize(item.category)}
            </DBadge>
            <DBadge variant="outline">{outcomeLabel(item.outcome, locale)}</DBadge>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Fact label={copy('Actor')} value={actorCompactLabel(item.actor) || copy('System')} />
            {target ? <Fact label={copy('Affected item')} value={target} /> : null}
            {item.locationName ? <Fact label={copy('Location')} value={item.locationName} /> : null}
            <Fact label={copy('Source')} value={sourceLabel(item.source, locale)} />
          </dl>
          {item.correlationId ? (
            <section className="border-t border-[var(--color-border)] pt-4">
              <h3 className="text-sm font-semibold">{copy('Technical information')}</h3>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                <Fact label={copy('Request ID')} value={item.correlationId} technical />
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </DDialog>
  );
}

function ActorIdentity({ actor, systemLabel }: { actor: ActivityActor | null; systemLabel: string }) {
  if (!actor) return <span>{systemLabel}</span>;
  const context = actorContext(actor);
  return (
    <div>
      <div className="font-medium text-[var(--color-text)]">{actor.displayName}</div>
      {context ? (
        <div className="text-xs text-[var(--color-text-muted)]">{context}</div>
      ) : null}
    </div>
  );
}

function actorContext(actor: Pick<ActivityActor, 'username' | 'roleNames'>): string {
  return [actor.username ? `@${actor.username}` : null, actor.roleNames.join(', ') || null]
    .filter(Boolean)
    .join(' · ');
}

function actorCompactLabel(actor: Pick<ActivityActor, 'displayName' | 'username' | 'roleNames'> | null): string {
  if (!actor) return '';
  const username = actor.username ? `(@${actor.username})` : '';
  const roles = actor.roleNames.length ? ` · ${actor.roleNames.join(', ')}` : '';
  return `${actor.displayName}${username ? ` ${username}` : ''}${roles}`;
}

function Fact({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className={`mt-1 break-words text-[var(--color-text)]${technical ? ' font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function targetSummary(item: ActivityEvent, locale: 'id' | 'en'): string | undefined {
  if (!item.target || item.eventType === 'LOGIN_SUCCEEDED' || item.eventType === 'LOGOUT')
    return undefined;
  const fallback = targetTypeLabels[item.target.type]?.[locale] ?? humanize(item.target.type);
  return [item.target.displayName ?? fallback, item.target.reference]
    .filter(Boolean)
    .join(' · ');
}

function outcomeLabel(value: string, locale: 'id' | 'en') {
  const labels: Record<string, LocalizedLabel> = {
    SUCCEEDED: { id: 'Berhasil', en: 'Succeeded' },
    REJECTED: { id: 'Ditolak', en: 'Rejected' },
    FAILED: { id: 'Gagal', en: 'Failed' },
  };
  return labels[value]?.[locale] ?? humanize(value);
}

function sourceLabel(value: ActivityEvent['source'], locale: 'id' | 'en') {
  const labels: Record<ActivityEvent['source'], LocalizedLabel> = {
    BACKOFFICE: { id: 'Backoffice', en: 'Backoffice' },
    OPERATIONAL: { id: 'Operasional', en: 'Operational' },
    SYSTEM: { id: 'Sistem', en: 'System' },
  };
  return labels[value][locale];
}

function eventLabel(value: string, locale: 'id' | 'en') {
  return eventLabels[value]?.[locale] ?? humanize(value);
}

function humanize(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');
}