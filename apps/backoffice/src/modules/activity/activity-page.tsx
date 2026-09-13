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
};
const eventLabels: Record<string, string> = {
  LOGIN_SUCCEEDED: 'Login succeeded',
  LOGOUT: 'Logout',
  BUSINESS_NUMBERING_UPDATED: 'Numbering settings updated',
  EXPENSE_APPROVED: 'Expense approved',
  EXPENSE_REJECTED: 'Expense rejected',
  EXPENSE_CREATED: 'Expense created',
  EXPENSE_UPDATED: 'Expense updated',
  BUSINESS_PROFILE_UPDATED: 'Business profile updated',
  LOCATION_CREATED: 'Location created',
  LOCATION_UPDATED: 'Location updated',
  CATALOG_CATEGORY_CREATED: 'Catalog category created',
  CATALOG_CATEGORY_UPDATED: 'Catalog category updated',
  CATALOG_ITEM_CREATED: 'Catalog item created',
  CATALOG_ITEM_UPDATED: 'Catalog item updated',
  CATALOG_VARIANT_CREATED: 'Catalog variant created',
  CATALOG_VARIANT_UPDATED: 'Catalog variant updated',
  TAX_PROFILE_UPDATED: 'Tax profile updated',
  TAX_RULE_CREATED: 'Tax rule created',
  TAX_RULE_CANCELLED: 'Tax rule cancelled',
  TAX_CATEGORY_CREATED: 'Tax category created',
  TAX_CATEGORY_UPDATED: 'Tax category updated',
  PRICE_CREATED: 'Price created',
  PRICE_CHANGED: 'Price changed',
  PRICE_CANCELLED: 'Price cancelled',
  EMPLOYEE_POSITION_CREATED: 'Employee position created',
  EMPLOYEE_POSITION_UPDATED: 'Employee position updated',
  ATTENDANCE_UPDATED: 'Attendance updated',
  EMPLOYEE_CREATED: 'Employee created',
  EMPLOYEE_UPDATED: 'Employee updated',
  OWNER_PROVISIONED: 'Owner provisioned',
  OWNER_GRANTED: 'Owner role granted',
  OWNER_REVOKED: 'Owner role revoked',
  INVITATION_CREATED: 'User invitation created',
  INVITATION_REVOKED: 'User invitation revoked',
  INVITATION_ACCEPTED: 'User invitation accepted',
  USER_ENABLED: 'User enabled',
  USER_DISABLED: 'User disabled',
  USER_ROLES_CHANGED: 'User roles changed',
  ROLE_CREATED: 'Role created',
  ROLE_UPDATED: 'Role updated',
  ROLE_STATUS_CHANGED: 'Role status changed',
  ROLE_PERMISSIONS_CHANGED: 'Role permissions changed',
  USER_SESSIONS_REVOKED: 'User sessions revoked',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_RESET_COMPLETED: 'Password reset completed',
  LOCATION_ACCESS_GRANTED: 'Location access granted',
  LOCATION_ACCESS_REVOKED: 'Location access revoked',
};
const targetTypeLabels: Record<string, string> = {
  EXPENSE: 'Expense',
  INVITATION: 'User invitation',
  NUMBERING_PREFERENCE: 'Numbering',
  ROLE: 'Role',
  USER: 'User',
  LOCATION: 'Location',
  CATALOG_CATEGORY: 'Category',
  TAX_PROFILE: 'Tax profile',
  TAX_RULE: 'Tax rule',
  TAX_CATEGORY: 'Tax category',
  CATALOG_PRICE: 'Price',
  EMPLOYEE: 'Employee',
  EMPLOYEE_POSITION: 'Employee position',
};
const namespaceLabels: Record<string, string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
  CATEGORY: 'Category',
  VARIANT: 'Variant',
  EMPLOYEE: 'Employee',
  EMPLOYEE_POSITION: 'Employee position',
  SALE: 'Transaction',
  INVOICE: 'Invoice',
};

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, copy, formatDate } = useBackofficeLocalization();
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
  const resetPage = () => setOffset(0);
  const actorOptions = options(
    list.data?.items ?? [],
    (item) => item.actor?.id ?? '',
    (item) => item.actor?.displayName ?? '',
  );
  const locationOptions = options(
    list.data?.items ?? [],
    (item) => item.locationId ?? '',
    (item) => item.locationName ?? '',
  );
  const columns: TableColumn<ActivityEvent>[] = [
    {
      key: 'occurredAt',
      label: copy('Time'),
      render: (item) => formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
    { key: 'actor', label: copy('Actor'), render: (item) => item.actor?.displayName ?? copy('System') },
    { key: 'eventType', label: copy('Action'), render: (item) => eventLabel(item.eventType, copy) },
    { key: 'target', label: copy('Target / reference'), render: (item) => targetSummary(item, copy) ?? '—' },
    {
      key: 'category',
      label: copy('Category'),
      render: (item) => <DBadge variant="outline">{copy(categoryLabels[item.category] ?? item.category)}</DBadge>,
    },
    { key: 'location', label: copy('Location'), render: (item) => item.locationName ?? '—' },
  ];
  if (list.isError) {
    return <DConnectionError title={copy('Could not load activity.')} message={copy('Try loading activity again.')} onRetry={() => void list.refetch()} isRetrying={list.isFetching} />;
  }
  const filtered = Boolean(from || to || actorUserId || category || locationId);
  return (
    <BackofficePage>
      <BackofficePageHeader eyebrow={copy('Audit')} title={t('activity')} description={copy('Review important business and access actions safely.')} />
      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          onRowClick={setDetail}
          filters={
            <div className="flex flex-wrap gap-2">
              <DDateRangeFilter from={from} to={to} onFromChange={(value) => { setFrom(value); resetPage(); }} onToChange={(value) => { setTo(value); resetPage(); }} onClear={() => { setFrom(''); setTo(''); resetPage(); }} />
              <DSelectFilter label={copy('User')} placeholder={copy('All users')} value={actorUserId || null} clearable options={actorOptions} onChange={(value) => { setActorUserId(String(value ?? '')); resetPage(); }} />
              <DSelectFilter label={copy('Category')} value={category || null} clearable options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label: copy(label) }))} onChange={(value) => { setCategory(String(value ?? '')); resetPage(); }} />
              <DSelectFilter label={copy('Location')} placeholder={copy('All locations')} value={locationId || null} clearable options={locationOptions} onChange={(value) => { setLocationId(String(value ?? '')); resetPage(); }} />
            </div>
          }
          pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total: list.data?.total ?? 0 }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)}
          onPageSizeChange={(size) => { setPageSize(size); resetPage(); }}
          emptyMessage={copy(filtered ? 'No activity matches the current filters.' : 'No activity has been recorded yet.')}
        />
      </section>
      <ActivityDetail item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityEvent | null; onClose: () => void }) {
  const { copy, formatDate } = useBackofficeLocalization();
  const target = item ? targetSummary(item, copy) : undefined;
  const technical = item && ((hasBusinessTarget(item) && item.target?.id) || item.correlationId);
  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      title={item ? eventLabel(item.eventType, copy) : copy('Activity details')}
      description={item ? formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }) : undefined}
      footer={<div className="flex justify-end"><DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton></div>}
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="outline">{copy(categoryLabels[item.category] ?? item.category)}</DBadge>
            <DBadge variant="outline">{outcomeLabel(item.outcome, copy)}</DBadge>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Fact label={copy('Actor')} value={item.actor?.displayName ?? copy('System')} />
            {target ? <Fact label={copy('Affected item')} value={target} /> : null}
            {item.locationName ? <Fact label={copy('Location')} value={item.locationName} /> : null}
            <Fact label={copy('Source')} value={sourceLabel(item.source, copy)} />
          </dl>
          {technical ? (
            <section className="border-t border-[var(--color-border)] pt-4">
              <h3 className="text-sm font-semibold">{copy('Technical information')}</h3>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                {hasBusinessTarget(item) && item.target?.id ? <Fact label={copy('Target ID')} value={item.target.id} technical /> : null}
                {item.correlationId ? <Fact label={copy('Request ID')} value={item.correlationId} technical /> : null}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </DDialog>
  );
}

function Fact({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return <div><dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt><dd className={`mt-1 break-words text-[var(--color-text)]${technical ? ' font-mono text-xs' : ''}`}>{value}</dd></div>;
}

function targetSummary(item: ActivityEvent, copy: (value: string) => string): string | undefined {
  if (!item.target || !hasBusinessTarget(item)) return undefined;
  const display = item.target.displayName;
  const reference = item.target.reference
    ? copy(namespaceLabels[item.target.reference] ?? item.target.reference)
    : undefined;
  const fallback = copy(targetTypeLabels[item.target.type] ?? item.target.type);
  return [display ?? fallback, reference].filter(Boolean).join(' · ');
}

function hasBusinessTarget(item: ActivityEvent) {
  return item.eventType !== 'LOGIN_SUCCEEDED' && item.eventType !== 'LOGOUT';
}

function outcomeLabel(value: string, copy: (value: string) => string) {
  return copy({ SUCCEEDED: 'Succeeded', REJECTED: 'Rejected', FAILED: 'Failed' }[value] ?? value);
}

function sourceLabel(value: ActivityEvent['source'], copy: (value: string) => string) {
  return copy(value === 'OPERATIONAL' ? 'Operational' : value === 'SYSTEM' ? 'System' : 'Backoffice');
}

function options(items: readonly ActivityEvent[], id: (item: ActivityEvent) => string, label: (item: ActivityEvent) => string) {
  return [...new Map(items.filter((item) => id(item) && label(item)).map((item) => [id(item), { value: id(item), label: label(item) }])).values()];
}

function eventLabel(value: string, copy: (value: string) => string) {
  return copy(eventLabels[value] ?? value.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' '));
}
