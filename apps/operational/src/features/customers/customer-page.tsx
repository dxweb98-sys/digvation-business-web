import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DAlert,
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDialog,
  DInput,
  DSelectFilter,
  DSkeleton,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { historyQueryPolicy } from '../../app/data/operational-cache-policy';
import {
  MemberDetailDialog,
  MemberTransactionCard,
} from '../../modules/membership/operational-members-page';
import { OperationalMembersApi } from '../../modules/membership/operational-members-api';
import {
  sanitizeNationalPhoneInput,
  toCanonicalPhone,
  toLocalPhoneDisplay,
} from '../sell/customer-input';
import { canReadCustomerMembership } from './customer-access';
import { CUSTOMER_PAGE_SIZE, OperationalCustomersApi, type Customer } from './customer-api';
import { useCustomerLocalization } from './customer-copy';

const customerKey = ['operational-customers'] as const;

export function OperationalCustomersPage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const client = useMemo(
    () =>
      new ApiClient({
        baseUrl: bootstrap.apiBaseUrl,
        applicationSurface: 'operational',
        ...(authPort.getAccessToken
          ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
          : {}),
      }),
    [authPort, bootstrap.apiBaseUrl],
  );
  const api = useMemo(() => new OperationalCustomersApi(client), [client]);
  const memberApi = useMemo(() => new OperationalMembersApi(client), [client]);
  const cacheScope = JSON.stringify([
    session.business.tenantId,
    session.identity.userId,
    session.contextVersion,
    session.access.capabilities,
  ]);
  return (
    <OperationalCustomersView
      key={cacheScope}
      cacheScope={cacheScope}
      api={api}
      memberApi={memberApi}
      canEdit={session.access.permissions.includes('customers:manage')}
      canReadMembership={canReadCustomerMembership(
        session.access.permissions,
        session.access.capabilities,
      )}
    />
  );
}

export function OperationalCustomersView({
  api,
  memberApi,
  canEdit,
  canReadMembership,
  cacheScope = 'test',
}: {
  api: OperationalCustomersApi;
  memberApi: OperationalMembersApi;
  canEdit: boolean;
  canReadMembership: boolean;
  cacheScope?: string;
}) {
  const { copy, label } = useCustomerLocalization();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | 'REGULAR' | 'MEMBER'>('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Customer | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const visibleType = canReadMembership ? type : '';
  const list = useQuery({
    queryKey: [...customerKey, cacheScope, q, visibleType, offset, canReadMembership],
    queryFn: ({ signal }) =>
      api.list({ q, ...(visibleType ? { type: visibleType } : {}), offset }, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[1] === cacheScope ? previous : undefined,
    ...historyQueryPolicy,
  });
  const columns: TableColumn<Customer>[] = [
    {
      key: 'customer',
      label: copy('Customers'),
      render: (customer) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-(--color-text)">{customer.name}</p>
          <p className="truncate text-xs text-(--color-text-muted)">{customer.phoneE164}</p>
        </div>
      ),
    },
    ...(canReadMembership
      ? [
          {
            key: 'type',
            label: copy('Customer type'),
            render: (customer: Customer) => (
              <DBadge variant="outline">
                {copy(customer.membership ? 'Member' : 'Regular Customer')}
              </DBadge>
            ),
          },
        ]
      : []),
    {
      key: 'status',
      label: copy('Status'),
      render: (customer) => (
        <DBadge variant={customer.status === 'ACTIVE' ? 'success' : 'outline'}>
          {label(customer.status)}
        </DBadge>
      ),
    },
  ];
  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Customers')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Customers')}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {copy('Browse customers and their recent transactions.')}
        </p>
      </header>
      <section className="mt-6">
        {list.isError && !list.data ? (
          <DConnectionError
            title={copy('Could not load customers.')}
            message={copy('Try loading customers again.')}
            onRetry={() => void list.refetch()}
          />
        ) : (
          <DDataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search name or phone')}
            searchValue={search}
            onSearchChange={setSearch}
            onRowClick={setSelected}
            filters={
              canReadMembership ? (
                <DSelectFilter
                  label={copy('Customer type')}
                  value={type || null}
                  clearable
                  onChange={(value) => {
                    setType((value ?? '') as typeof type);
                    setOffset(0);
                  }}
                  options={[
                    { value: '', label: copy('All') },
                    { value: 'REGULAR', label: copy('Regular Customer') },
                    { value: 'MEMBER', label: copy('Member') },
                  ]}
                />
              ) : undefined
            }
            pagination={{
              page: offset / CUSTOMER_PAGE_SIZE + 1,
              pageSize: CUSTOMER_PAGE_SIZE,
              total: list.data?.total ?? 0,
            }}
            onPageChange={(page) => setOffset((page - 1) * CUSTOMER_PAGE_SIZE)}
            emptyMessage={copy(q ? 'No customers match your search.' : 'No customers yet.')}
          />
        )}
      </section>
      {selected ? (
        canReadMembership && selected.membership ? (
          <MemberDetailDialog
            key={selected.id}
            api={memberApi}
            membershipId={selected.membership.id}
            cacheScope={cacheScope}
            canEdit={canEdit}
            onClose={() => setSelected(null)}
          />
        ) : (
          <CustomerDetailDialog
            key={selected.id}
            api={api}
            customerId={selected.id}
            cacheScope={cacheScope}
            canEdit={canEdit}
            onClose={() => setSelected(null)}
          />
        )
      ) : null}
    </div>
  );
}

export function CustomerDetailDialog({
  api,
  customerId,
  canEdit,
  onClose,
  cacheScope = 'test',
}: {
  api: OperationalCustomersApi;
  customerId: string;
  canEdit: boolean;
  onClose: () => void;
  cacheScope?: string;
}) {
  const { copy, label, locale, formatDate, formatMoney } = useCustomerLocalization();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: [...customerKey, cacheScope, 'detail', customerId],
    queryFn: ({ signal }) => api.detail(customerId, signal),
    ...historyQueryPolicy,
  });
  const customer = detail.data?.customer;
  const save = useMutation({
    mutationFn: () => api.update(customer!, { name, phone: toCanonicalPhone(phone) ?? phone }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: customerKey });
      setEditing(false);
      setError(null);
      showToast({ variant: 'success', title: copy('Customer profile updated.') });
    },
    onError: () => setError(copy('Could not update the customer profile.')),
  });
  return (
    <DDialog
      open
      onClose={onClose}
      title={editing ? copy('Edit profile') : copy('Customer detail')}
      ariaLabel={editing ? copy('Edit profile') : copy('Customer detail')}
      className={editing ? 'w-full max-w-md' : 'w-full max-w-lg'}
      footer={
        customer ? (
          <div className="flex justify-end gap-2">
            {editing ? (
              <>
                <DButton
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => setEditing(false)}
                >
                  {copy('Cancel')}
                </DButton>
                <DButton
                  loading={save.isPending}
                  disabled={!name.trim() || !phone.trim()}
                  onClick={() => save.mutate()}
                >
                  {copy('Save')}
                </DButton>
              </>
            ) : (
              <>
                <DButton variant="secondary" onClick={onClose}>
                  {copy('Close')}
                </DButton>
                {canEdit ? (
                  <DButton
                    onClick={() => {
                      setName(customer.name);
                      setPhone(toLocalPhoneDisplay(customer.phoneE164));
                      setError(null);
                      setEditing(true);
                    }}
                  >
                    {copy('Edit profile')}
                  </DButton>
                ) : null}
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {detail.isLoading ? (
        <div aria-busy="true">
          <DSkeleton height={72} count={3} />
        </div>
      ) : detail.isError || !detail.data || !customer ? (
        <DConnectionError
          title={copy('Could not load customer detail.')}
          message={copy('Try loading customers again.')}
          onRetry={() => void detail.refetch()}
        />
      ) : editing ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <DInput label={copy('Name')} value={name} onChange={setName} disabled={save.isPending} />
            <DInput
              label={copy('Phone number')}
              value={phone}
              onChange={(value) => setPhone(sanitizeNationalPhoneInput(value))}
              type="tel"
              inputMode="tel"
              disabled={save.isPending}
            />
          </div>
          {error ? <DAlert variant="danger">{error}</DAlert> : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-4 sm:gap-5">
          <section className="shrink-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-(--color-text)">{customer.name}</h2>
                <p className="text-sm text-(--color-text-muted)">{customer.phoneE164}</p>
              </div>
              <DBadge variant={customer.status === 'ACTIVE' ? 'success' : 'outline'}>
                {label(customer.status)}
              </DBadge>
            </div>
          </section>
          <section className="border-t border-(--color-border) pt-4 sm:pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">{copy('Recent transactions')}</h3>
              <span className="shrink-0 text-xs text-(--color-text-muted)">
                {detail.data.transactionTotal}
              </span>
            </div>
            <div className="mt-3 max-h-[min(360px,45dvh)] overflow-y-auto">
              {detail.data.recentTransactions.length ? (
                <ul className="space-y-2">
                  {detail.data.recentTransactions.map((transaction) => (
                    <MemberTransactionCard
                      key={transaction.saleId}
                      transaction={transaction}
                      showPoints={false}
                      locale={locale}
                      dateTime={formatDate}
                      formatMoney={formatMoney}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-(--color-text-muted)">
                  {copy('No finalized transactions yet.')}
                </p>
              )}
            </div>
            {detail.data.transactionTotal > detail.data.recentTransactions.length ? (
              <p className="mt-3 text-xs text-(--color-text-muted)">
                {copy('Showing')} {detail.data.recentTransactions.length} /{' '}
                {detail.data.transactionTotal} {copy('most recent transactions')}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </DDialog>
  );
}
