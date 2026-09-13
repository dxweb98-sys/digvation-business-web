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
import { ActivityApi, type ActivityEvent } from './activity-api';

const defaultPageSize = 30;
const categoryLabels: Record<string, string> = {
  SECURITY: 'Security',
  CONFIGURATION: 'Configuration',
  FINANCE: 'Finance',
  CATALOG: 'Catalog',
  TAX: 'Tax',
  PRICING: 'Pricing',
  WORKFORCE: 'Workforce',
  SALES: 'Sales',
  PAYMENT: 'Payment',
  FULFILLMENT: 'Fulfillment',
};
const eventLabels: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login succeeded', LOGOUT: 'Logout', BUSINESS_NUMBERING_UPDATED: 'Numbering settings updated',
  EXPENSE_APPROVED: 'Expense approved', EXPENSE_REJECTED: 'Expense rejected', EXPENSE_CREATED: 'Expense created', EXPENSE_UPDATED: 'Expense updated',
  BUSINESS_PROFILE_UPDATED: 'Business profile updated', LOCATION_CREATED: 'Location created', LOCATION_UPDATED: 'Location updated',
  CATALOG_CATEGORY_CREATED: 'Catalog category created', CATALOG_CATEGORY_UPDATED: 'Catalog category updated', CATALOG_ITEM_CREATED: 'Catalog item created', CATALOG_ITEM_UPDATED: 'Catalog item updated', CATALOG_VARIANT_CREATED: 'Catalog variant created', CATALOG_VARIANT_UPDATED: 'Catalog variant updated',
  TAX_PROFILE_UPDATED: 'Tax profile updated', TAX_RULE_CREATED: 'Tax rule created', TAX_RULE_CANCELLED: 'Tax rule cancelled', TAX_CATEGORY_CREATED: 'Tax category created', TAX_CATEGORY_UPDATED: 'Tax category updated',
  PRICE_CREATED: 'Price created', PRICE_CHANGED: 'Price changed', PRICE_CANCELLED: 'Price cancelled',
  EMPLOYEE_POSITION_CREATED: 'Employee position created', EMPLOYEE_POSITION_UPDATED: 'Employee position updated', ATTENDANCE_UPDATED: 'Attendance updated', EMPLOYEE_CREATED: 'Employee created', EMPLOYEE_UPDATED: 'Employee updated',
  FINANCIAL_ACCOUNT_CREATED: 'Financial account added.', FINANCIAL_ACCOUNT_UPDATED: 'Financial account updated.', PAYMENT_ROUTE_CREATED: 'Payment route added.', PAYMENT_ROUTE_UPDATED: 'Payment route updated.', CASH_MOVEMENT_CREATED: 'Cash movement recorded.', SETTLEMENT_CREATED: 'Settlement created.', RECONCILIATION_CREATED: 'Reconciliation recorded.',
  SALE_CREATED: 'Transaction created', SALE_LINE_ADDED: 'Transaction item added', SALE_LINE_QUANTITY_CHANGED: 'Transaction item quantity changed', SALE_LINE_REMOVED: 'Transaction item removed', SALE_LINE_PRICE_OVERRIDDEN: 'Transaction item price overridden', SALE_LINE_PRICE_OVERRIDE_REMOVED: 'Transaction item price override removed', SALE_LINE_DISCOUNT_APPLIED: 'Transaction item discount applied', SALE_LINE_DISCOUNT_REMOVED: 'Transaction item discount removed', SALE_DISCOUNT_APPLIED: 'Transaction discount applied', SALE_DISCOUNT_REMOVED: 'Transaction discount removed', SALE_LINE_ASSIGNMENTS_CHANGED: 'Transaction item assignment changed', SALE_LINE_CONTRIBUTIONS_CHANGED: 'Transaction item contribution changed', SALE_FINALIZED: 'Transaction finalized', SALE_VOIDED: 'Transaction voided',
  PAYMENT_CREATED: 'Payment created', PAYMENT_SUCCEEDED: 'Payment succeeded', PAYMENT_FAILED: 'Payment failed', PAYMENT_CANCELLED: 'Payment cancelled', PAYMENT_EXPIRED: 'Payment expired',
  FULFILLMENT_STARTED: 'Fulfillment started', FULFILLMENT_COMPLETED: 'Fulfillment completed', FULFILLMENT_CANCELLED: 'Fulfillment cancelled',
  OWNER_PROVISIONED: 'Owner provisioned', OWNER_GRANTED: 'Owner role granted', OWNER_REVOKED: 'Owner role revoked', INVITATION_CREATED: 'User invitation created', INVITATION_REVOKED: 'User invitation revoked', INVITATION_ACCEPTED: 'User invitation accepted', USER_ENABLED: 'User enabled', USER_DISABLED: 'User disabled', USER_ROLES_CHANGED: 'User roles changed', ROLE_CREATED: 'Role created', ROLE_UPDATED: 'Role updated', ROLE_STATUS_CHANGED: 'Role status changed', ROLE_PERMISSIONS_CHANGED: 'Role permissions changed', USER_SESSIONS_REVOKED: 'User sessions revoked', PASSWORD_CHANGED: 'Password changed', PASSWORD_RESET_COMPLETED: 'Password reset completed', LOCATION_ACCESS_GRANTED: 'Location access granted', LOCATION_ACCESS_REVOKED: 'Location access revoked',
};
const compositeEventLabels: Record<string, readonly string[]> = {
  SETTLEMENT_COMPLETED: ['Settlement', 'COMPLETED'], SETTLEMENT_CANCELLED: ['Settlement', 'CANCELLED'], RECONCILIATION_UPDATED: ['Reconciliation', 'Updated'],
};
const targetTypeLabels: Record<string, string> = {
  EXPENSE: 'Expense', INVITATION: 'User invitation', NUMBERING_PREFERENCE: 'Numbering', ROLE: 'Role', USER: 'User', LOCATION: 'Location', CATALOG_CATEGORY: 'Category', TAX_PROFILE: 'Tax profile', TAX_RULE: 'Tax rule', TAX_CATEGORY: 'Tax category', CATALOG_PRICE: 'Price', EMPLOYEE: 'Employee', EMPLOYEE_POSITION: 'Employee position', FINANCIAL_ACCOUNT: 'Financial Account', PAYMENT_ROUTE: 'Payment routing', CASH_MOVEMENT: 'Cash movements', SETTLEMENT: 'Settlement', RECONCILIATION: 'Reconciliation', SALE: 'Transaction', SALE_LINE: 'Transaction item', PAYMENT: 'Payment', FULFILLMENT: 'Fulfillment',
};
const namespaceLabels: Record<string, string> = { PRODUCT: 'Product', SERVICE: 'Service', CATEGORY: 'Category', VARIANT: 'Variant', EMPLOYEE: 'Employee', EMPLOYEE_POSITION: 'Employee position', SALE: 'Transaction', INVOICE: 'Invoice' };
const activityLocalized: Record<string, { id: string; en: string }> = {
  Sales: { id: 'Penjualan', en: 'Sales' }, Payment: { id: 'Pembayaran', en: 'Payment' }, Fulfillment: { id: 'Pemenuhan', en: 'Fulfillment' }, Workforce: { id: 'Tenaga kerja', en: 'Workforce' },
  'Transaction item': { id: 'Item transaksi', en: 'Transaction item' },
  'Transaction created': { id: 'Transaksi dibuat', en: 'Transaction created' }, 'Transaction item added': { id: 'Item transaksi ditambahkan', en: 'Transaction item added' }, 'Transaction item quantity changed': { id: 'Jumlah item transaksi diubah', en: 'Transaction item quantity changed' }, 'Transaction item removed': { id: 'Item transaksi dihapus', en: 'Transaction item removed' }, 'Transaction item price overridden': { id: 'Harga item transaksi dioverride', en: 'Transaction item price overridden' }, 'Transaction item price override removed': { id: 'Override harga item transaksi dihapus', en: 'Transaction item price override removed' }, 'Transaction item discount applied': { id: 'Diskon item transaksi diterapkan', en: 'Transaction item discount applied' }, 'Transaction item discount removed': { id: 'Diskon item transaksi dihapus', en: 'Transaction item discount removed' }, 'Transaction discount applied': { id: 'Diskon transaksi diterapkan', en: 'Transaction discount applied' }, 'Transaction discount removed': { id: 'Diskon transaksi dihapus', en: 'Transaction discount removed' }, 'Transaction item assignment changed': { id: 'Penugasan item transaksi diubah', en: 'Transaction item assignment changed' }, 'Transaction item contribution changed': { id: 'Kontribusi item transaksi diubah', en: 'Transaction item contribution changed' }, 'Transaction finalized': { id: 'Transaksi diselesaikan', en: 'Transaction finalized' }, 'Transaction voided': { id: 'Transaksi dibatalkan', en: 'Transaction voided' },
  'Payment created': { id: 'Pembayaran dibuat', en: 'Payment created' }, 'Payment succeeded': { id: 'Pembayaran berhasil', en: 'Payment succeeded' }, 'Payment failed': { id: 'Pembayaran gagal', en: 'Payment failed' }, 'Payment cancelled': { id: 'Pembayaran dibatalkan', en: 'Payment cancelled' }, 'Payment expired': { id: 'Pembayaran kedaluwarsa', en: 'Payment expired' },
  'Fulfillment started': { id: 'Pemenuhan dimulai', en: 'Fulfillment started' }, 'Fulfillment completed': { id: 'Pemenuhan selesai', en: 'Fulfillment completed' }, 'Fulfillment cancelled': { id: 'Pemenuhan dibatalkan', en: 'Fulfillment cancelled' },
};

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, copy, formatDate, locale } = useBackofficeLocalization();
  const api = useMemo(() => new ActivityApi(createApiClient(runtime.apiBaseUrl)), [createApiClient, runtime.apiBaseUrl]);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState('');
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const list = useQuery({ queryKey: ['activity', offset, pageSize, from, to, actorUserId, category, locationId], queryFn: () => api.list({ offset, limit: pageSize, from, to, actorUserId, category, locationId }) });
  const facets = useQuery({ queryKey: ['activity-facets'], queryFn: () => api.facets(), staleTime: 300_000 });
  const resetPage = () => setOffset(0);
  const actorOptions = (facets.data?.actors ?? []).map((actor) => ({ value: actor.id, label: actor.displayName }));
  const locationOptions = (facets.data?.locations ?? []).map((location) => ({ value: location.id, label: `${location.name} · ${location.code}` }));
  const acopy = (value: string) => activityLocalized[value]?.[locale] ?? copy(value);
  const columns: TableColumn<ActivityEvent>[] = [
    { key: 'occurredAt', label: copy('Time'), render: (item) => formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }) },
    { key: 'actor', label: copy('Actor'), render: (item) => item.actor?.displayName ?? copy('System') },
    { key: 'eventType', label: copy('Action'), render: (item) => eventLabel(item.eventType, acopy) },
    { key: 'target', label: copy('Target / reference'), render: (item) => targetSummary(item, acopy) ?? '—' },
    { key: 'category', label: copy('Category'), render: (item) => <DBadge variant="outline">{acopy(categoryLabels[item.category] ?? item.category)}</DBadge> },
    { key: 'location', label: copy('Location'), render: (item) => item.locationName ?? '—' },
  ];
  if (list.isError) return <DConnectionError title={copy('Could not load activity.')} message={copy('Try loading activity again.')} onRetry={() => void list.refetch()} isRetrying={list.isFetching} />;
  const filtered = Boolean(from || to || actorUserId || category || locationId);
  return (
    <BackofficePage>
      <BackofficePageHeader eyebrow={copy('Audit')} title={t('activity')} description={copy('Review important business and access actions safely.')} />
      <section className="mt-6">
        <DDataTable
          columns={columns} data={list.data?.items ?? []} loading={list.isLoading} rowKey="id" onRowClick={setDetail}
          filters={<div className="flex flex-wrap gap-2">
            <DDateRangeFilter from={from} to={to} onFromChange={(value) => { setFrom(value); resetPage(); }} onToChange={(value) => { setTo(value); resetPage(); }} onClear={() => { setFrom(''); setTo(''); resetPage(); }} />
            <DSelectFilter label={copy('User')} placeholder={copy('All users')} value={actorUserId || null} clearable options={actorOptions} onChange={(value) => { setActorUserId(String(value ?? '')); resetPage(); }} />
            <DSelectFilter label={copy('Category')} value={category || null} clearable options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label: acopy(label) }))} onChange={(value) => { setCategory(String(value ?? '')); resetPage(); }} />
            <DSelectFilter label={copy('Location')} placeholder={copy('All locations')} value={locationId || null} clearable options={locationOptions} onChange={(value) => { setLocationId(String(value ?? '')); resetPage(); }} />
          </div>}
          pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total: list.data?.total ?? 0 }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)} onPageSizeChange={(size) => { setPageSize(size); resetPage(); }}
          emptyMessage={copy(filtered ? 'No activity matches the current filters.' : 'No activity has been recorded yet.')}
        />
      </section>
      <ActivityDetail item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityEvent | null; onClose: () => void }) {
  const { copy, formatDate, locale } = useBackofficeLocalization();
  const acopy = (value: string) => activityLocalized[value]?.[locale] ?? copy(value);
  const target = item ? targetSummary(item, acopy) : undefined;
  const technical = item && ((hasBusinessTarget(item) && item.target?.id) || item.correlationId);
  return <DDialog open={Boolean(item)} onClose={onClose} title={item ? eventLabel(item.eventType, acopy) : copy('Activity details')} description={item ? formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }) : undefined} footer={<div className="flex justify-end"><DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton></div>}>
    {item ? <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><DBadge variant="outline">{acopy(categoryLabels[item.category] ?? item.category)}</DBadge><DBadge variant="outline">{outcomeLabel(item.outcome, copy)}</DBadge></div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2"><Fact label={copy('Actor')} value={item.actor?.displayName ?? copy('System')} />{target ? <Fact label={copy('Affected item')} value={target} /> : null}{item.locationName ? <Fact label={copy('Location')} value={item.locationName} /> : null}<Fact label={copy('Source')} value={sourceLabel(item.source, copy)} /></dl>
      {technical ? <section className="border-t border-[var(--color-border)] pt-4"><h3 className="text-sm font-semibold">{copy('Technical information')}</h3><dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">{hasBusinessTarget(item) && item.target?.id ? <Fact label={copy('Target ID')} value={item.target.id} technical /> : null}{item.correlationId ? <Fact label={copy('Request ID')} value={item.correlationId} technical /> : null}</dl></section> : null}
    </div> : null}
  </DDialog>;
}

function Fact({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) { return <div><dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt><dd className={`mt-1 break-words text-[var(--color-text)]${technical ? ' font-mono text-xs' : ''}`}>{value}</dd></div>; }
function targetSummary(item: ActivityEvent, copy: (value: string) => string): string | undefined { if (!item.target || !hasBusinessTarget(item)) return undefined; const display = item.target.displayName; const reference = item.target.reference ? copy(namespaceLabels[item.target.reference] ?? item.target.reference) : undefined; const fallback = copy(targetTypeLabels[item.target.type] ?? item.target.type); return [display ?? fallback, reference].filter(Boolean).join(' · '); }
function hasBusinessTarget(item: ActivityEvent) { return item.eventType !== 'LOGIN_SUCCEEDED' && item.eventType !== 'LOGOUT'; }
function outcomeLabel(value: string, copy: (value: string) => string) { return copy({ SUCCEEDED: 'Succeeded', REJECTED: 'Rejected', FAILED: 'Failed' }[value] ?? value); }
function sourceLabel(value: ActivityEvent['source'], copy: (value: string) => string) { return copy(value === 'OPERATIONAL' ? 'Operational' : value === 'SYSTEM' ? 'System' : 'Backoffice'); }
function eventLabel(value: string, copy: (value: string) => string) { const composite = compositeEventLabels[value]; if (composite) return composite.map(copy).join(' · '); return copy(eventLabels[value] ?? value.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' ')); }
