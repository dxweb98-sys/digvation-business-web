import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDialog,
  DInput,
  DPagination,
  DSelect,
  DSelectFilter,
  DStatusFilter,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Eye, Pencil, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useRuntime } from '@digvation/business-runtime';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  FinancialAccountsApi,
  type FinancialAccount,
  type FinancialAccountType,
  type PaymentMethod,
  type PaymentRoute,
  type RecordStatus,
} from './financial-accounts-api';

const pageLimit = 20;
const accountKey = ['financial-accounts'] as const;
const routeKey = ['payment-routing'] as const;
const accountTypes: FinancialAccountType[] = ['CASH', 'BANK', 'E_WALLET'];
const paymentMethods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'WALLET', 'QRIS'];
const compatibleTypes: Record<PaymentMethod, FinancialAccountType[]> = {
  CASH: ['CASH'],
  BANK_TRANSFER: ['BANK'],
  WALLET: ['E_WALLET'],
  QRIS: ['BANK', 'E_WALLET'],
};

export function FinancialAccountsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy } = useBackofficeLocalization();
  const api = useMemo(
    () => new FinancialAccountsApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  if (!session) return null;
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Finance')}
        title={copy('Financial Accounts')}
        description={copy(
          'Configure settlement destinations and location-specific payment routing.',
        )}
      />
      <DTabs defaultValue="accounts" className="mt-6">
        <DTabsList className="max-w-full overflow-x-auto">
          <DTabsTrigger value="accounts">{copy('Accounts')}</DTabsTrigger>
          <DTabsTrigger value="routing">{copy('Payment routing')}</DTabsTrigger>
        </DTabsList>
        <DTabsContent value="accounts" className="mt-4">
          <AccountsPanel api={api} />
        </DTabsContent>
        <DTabsContent value="routing" className="mt-4">
          <RoutingPanel api={api} />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}

function AccountsPanel({ api }: { api: FinancialAccountsApi }) {
  const { session } = useBackofficeAuth();
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQuery] = useState('');
  const [status, setStatus] = useState<'' | RecordStatus>('');
  const [type, setType] = useState<'' | FinancialAccountType>('');
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(pageLimit);
  const [editor, setEditor] = useState<FinancialAccount | 'create' | null>(null);
  const [detail, setDetail] = useState<FinancialAccount | null>(null);
  const accounts = useQuery({
    queryKey: [...accountKey, q, status, type, offset, pageSize],
    queryFn: () =>
      api.listAccounts({
        q: q.trim() || undefined,
        status: status || undefined,
        type: type || undefined,
        limit: pageSize,
        offset,
      }),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: accountKey });
  const canCreate = canPerformBackofficeAction(session!, 'createFinancialAccount');
  const canUpdate = canPerformBackofficeAction(session!, 'updateFinancialAccount');
  const setLifecycle = async (account: FinancialAccount) => {
    try {
      await api.updateAccount(account, {
        status: account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      refresh();
      showToast({
        variant: 'success',
        title: copy(
          account.status === 'ACTIVE'
            ? 'Financial account deactivated.'
            : 'Financial account activated.',
        ),
      });
    } catch (error) {
      showApiError(error, copy, showToast, copy('Could not update financial account.'));
    }
  };
  const columns: TableColumn<FinancialAccount>[] = [
    { key: 'code', label: copy('Account code') },
    { key: 'name', label: copy('Account name') },
    {
      key: 'type',
      label: copy('Account type'),
      render: (account) => copy(accountTypeLabel(account.type)),
    },
    { key: 'currency', label: copy('Currency') },
    {
      key: 'destination',
      label: copy('Destination'),
      render: (account) =>
        account.type === 'CASH'
          ? copy('On-site cash')
          : `${account.institutionName} · ${account.accountReference}`,
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (account) => <StatusBadge status={account.status} />,
    },
  ];
  if (accounts.isError)
    return (
      <div className="mt-6">
        <DConnectionError
          title={copy('Could not load financial accounts.')}
          message={copy('Try loading the account list again.')}
          onRetry={() => void accounts.refetch()}
          isRetrying={accounts.isFetching}
        />
      </div>
    );
  return (
    <section>
      <DDataTable
        columns={columns}
        data={accounts.data?.items ?? []}
        loading={accounts.isLoading}
        rowKey="id"
        searchable
        searchValue={q}
        searchPlaceholder={copy('Search account code or name...')}
        onSearchChange={(value) => {
          setQuery(value);
          setOffset(0);
        }}
        filters={
          <div className="flex flex-wrap gap-2">
            <DStatusFilter
              label={copy('Status')}
              value={status}
              allLabel={copy('All')}
              options={[
                { value: 'ACTIVE', label: copy('Active') },
                { value: 'INACTIVE', label: copy('Inactive') },
              ]}
              onChange={(value) => {
                setStatus(value as '' | RecordStatus);
                setOffset(0);
              }}
            />
            <DSelectFilter
              label={copy('Account type')}
              value={type}
              clearable
              options={accountTypes.map((value) => ({
                value,
                label: copy(accountTypeLabel(value)),
              }))}
              onChange={(value) => {
                setType((value ?? '') as '' | FinancialAccountType);
                setOffset(0);
              }}
            />
          </div>
        }
        headerActions={
          canCreate ? (
            <DButton
              leftIcon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setEditor('create')}
            >
              {copy('Add account')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total: accounts.data?.total ?? 0,
        }}
        onPageChange={(page) => setOffset((page - 1) * pageSize)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setOffset(0);
        }}
        emptyMessage={
          q || status || type
            ? copy('No matching financial accounts found.')
            : copy('No financial accounts are configured.')
        }
        actions={[
          {
            label: copy('View details'),
            icon: <Eye aria-hidden="true" className="size-4" />,
            onClick: setDetail,
          },
          {
            label: copy('Edit account'),
            icon: <Pencil aria-hidden="true" className="size-4" />,
            onClick: setEditor,
            show: () => canUpdate,
          },
          {
            label: copy('Deactivate account'),
            icon: <CircleOff aria-hidden="true" className="size-4" />,
            variant: 'danger',
            onClick: (account) => void setLifecycle(account),
            show: (account) => canUpdate && account.status === 'ACTIVE',
          },
          {
            label: copy('Activate account'),
            icon: <CircleCheck aria-hidden="true" className="size-4" />,
            onClick: (account) => void setLifecycle(account),
            show: (account) => canUpdate && account.status === 'INACTIVE',
          },
        ]}
      />
      <AccountEditor
        key={editor === 'create' ? 'create' : (editor?.id ?? 'closed')}
        open={editor !== null}
        account={editor === 'create' ? null : editor}
        api={api}
        onClose={() => setEditor(null)}
        onSaved={refresh}
      />
      <AccountDetail account={detail} onClose={() => setDetail(null)} />
    </section>
  );
}

function AccountEditor({
  open,
  account,
  api,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: FinancialAccount | null;
  api: FinancialAccountsApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [code, setCode] = useState(account?.code ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<FinancialAccountType>(account?.type ?? 'CASH');
  const [currency, setCurrency] = useState(account?.currency ?? 'IDR');
  const [institutionName, setInstitutionName] = useState(account?.institutionName ?? '');
  const [accountReference, setAccountReference] = useState(account?.accountReference ?? '');
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? '');
  const valid = Boolean(
    name.trim() &&
    /^[A-Z]{3}$/.test(currency.trim().toUpperCase()) &&
    (type === 'CASH' || (institutionName.trim() && accountReference.trim())),
  );
  const save = async () => {
    if (!valid) return;
    try {
      const details =
        type === 'CASH'
          ? { institutionName: null, accountReference: null, accountHolderName: null }
          : {
              institutionName: institutionName.trim(),
              accountReference: accountReference.trim(),
              accountHolderName: accountHolderName.trim() || null,
            };
      const saved = account
        ? await api.updateAccount(account, { name: name.trim(), ...details })
        : await api.createAccount({
            code: code.trim().toUpperCase() || null,
            name: name.trim(),
            type,
            currency: currency.trim().toUpperCase(),
            ...details,
          });
      let checkoutProvisioned = false;
      try {
        checkoutProvisioned = await provisionDefaultCheckoutRoute(api, saved);
      } catch {
        checkoutProvisioned = false;
      }
      onSaved();
      onClose();
      showToast({
        variant: 'success',
        title: copy(account ? 'Financial account updated.' : 'Financial account added.'),
      });
      if (!checkoutProvisioned && saved.status === 'ACTIVE') {
        showToast({
          variant: 'warning',
          title: copy(
            'Configure payment routing if this account should be available in Operational checkout.',
          ),
        });
      }
    } catch (error) {
      showApiError(error, copy, showToast, copy('Could not save financial account.'));
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(account ? 'Edit account' : 'Add account')}
      description={copy(
        account
          ? 'Account code, type, and currency cannot be changed.'
          : 'Create a destination for collected payments.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!valid} onClick={() => void save()}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DInput
          label={copy('Account code (optional)')}
          value={code}
          onChange={setCode}
          disabled={Boolean(account)}
          placeholder={copy('For example, BANK-SETTLEMENT')}
          autoFocus
        />
        <DInput
          label={copy('Account name')}
          value={name}
          onChange={setName}
          placeholder={copy('For example, Main settlement account')}
        />
        <DSelect
          label={copy('Account type')}
          value={type}
          disabled={Boolean(account)}
          options={accountTypes.map((value) => ({ value, label: copy(accountTypeLabel(value)) }))}
          onChange={(value) => setType(value as FinancialAccountType)}
        />
        <DInput
          label={copy('Currency')}
          value={currency}
          onChange={(value) => setCurrency(value.toUpperCase())}
          disabled={Boolean(account)}
          maxLength={3}
          placeholder="IDR"
        />
        {type !== 'CASH' ? (
          <>
            <DInput
              label={copy(type === 'BANK' ? 'Bank / institution' : 'Wallet provider')}
              value={institutionName}
              onChange={setInstitutionName}
              placeholder={copy(type === 'BANK' ? 'For example, BCA' : 'For example, GoPay')}
            />
            <DInput
              label={copy(type === 'BANK' ? 'Account number' : 'Wallet account')}
              value={accountReference}
              onChange={setAccountReference}
              placeholder={copy(
                type === 'BANK' ? 'For example, 1234567890' : 'For example, 081234567890',
              )}
            />
            <DInput
              label={copy('Account holder name')}
              value={accountHolderName}
              onChange={setAccountHolderName}
              placeholder={copy('For example, PT Digvation Indonesia')}
              containerClassName="sm:col-span-2"
            />
          </>
        ) : null}
      </div>
    </DDialog>
  );
}

function AccountDetail({
  account,
  onClose,
}: {
  account: FinancialAccount | null;
  onClose: () => void;
}) {
  const { copy, formatDate } = useBackofficeLocalization();
  return (
    <DDialog
      open={Boolean(account)}
      onClose={onClose}
      title={account?.name ?? copy('Financial account details')}
      description={
        account ? `${account.code} · ${copy(accountTypeLabel(account.type))}` : undefined
      }
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {account ? (
        <div>
          <section className="border-b border-[var(--color-border)] pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {account.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {account.code} · {copy(accountTypeLabel(account.type))}
                </p>
              </div>
              <StatusBadge status={account.status} />
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-5 border-t border-[var(--color-border)] pt-4 sm:grid-cols-3">
              <Fact label={copy('Currency')} value={account.currency} emphasized />
              <Fact label={copy('Account type')} value={copy(accountTypeLabel(account.type))} />
              <Fact
                label={copy('Destination')}
                value={
                  account.type === 'CASH'
                    ? copy('On-site cash')
                    : `${account.institutionName ?? copy('Not set')} · ${account.accountReference ?? copy('Not set')}`
                }
              />
            </dl>
          </section>

          <section className="pt-5">
            <h3 className="text-base font-semibold text-[var(--color-text)]">
              {copy('Account information')}
            </h3>
            <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Fact label={copy('Account code')} value={account.code} />
              <Fact label={copy('Status')} value={<StatusBadge status={account.status} />} />
              {account.type !== 'CASH' ? (
                <>
                  <Fact
                    label={copy(account.type === 'BANK' ? 'Bank / institution' : 'Wallet provider')}
                    value={account.institutionName ?? copy('Not set')}
                  />
                  <Fact
                    label={copy(account.type === 'BANK' ? 'Account number' : 'Wallet account')}
                    value={account.accountReference ?? copy('Not set')}
                  />
                  <Fact
                    label={copy('Account holder name')}
                    value={account.accountHolderName ?? copy('Not set')}
                  />
                </>
              ) : null}
              <Fact
                label={copy('Updated')}
                value={formatDate(new Date(account.updatedAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
            </dl>
          </section>
        </div>
      ) : null}
    </DDialog>
  );
}

function RoutingPanel({ api }: { api: FinancialAccountsApi }) {
  const { session } = useBackofficeAuth();
  const { copy } = useBackofficeLocalization();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(pageLimit);
  const [status, setStatus] = useState<'' | RecordStatus>('');
  const [method, setMethod] = useState<'' | PaymentMethod>('');
  const [editor, setEditor] = useState<PaymentRoute | 'create' | null>(null);
  const routes = useQuery({
    queryKey: [...routeKey, status, method, offset, pageSize],
    queryFn: () =>
      api.listRoutes({
        status: status || undefined,
        paymentMethod: method || undefined,
        limit: pageSize,
        offset,
      }),
  });
  const canUpdate = canPerformBackofficeAction(session!, 'updatePaymentRouting');
  const columns: TableColumn<PaymentRoute>[] = [
    {
      key: 'location',
      label: copy('Selling location'),
      render: (route) => `${route.sellingLocationName} · ${route.sellingLocationCode}`,
    },
    {
      key: 'paymentMethod',
      label: copy('Payment method'),
      render: (route) => copy(paymentMethodLabel(route.paymentMethod)),
    },
    {
      key: 'destination',
      label: copy('Settlement destination'),
      render: (route) => `${route.financialAccountName} · ${route.financialAccountCode}`,
    },
    { key: 'currency', label: copy('Currency') },
    {
      key: 'status',
      label: copy('Status'),
      render: (route) => <StatusBadge status={route.status} />,
    },
  ];
  if (routes.isError)
    return (
      <div className="mt-6">
        <DConnectionError
          title={copy('Could not load payment routing.')}
          message={copy('Try loading the routing list again.')}
          onRetry={() => void routes.refetch()}
          isRetrying={routes.isFetching}
        />
      </div>
    );
  return (
    <section>
      <DDataTable
        columns={columns}
        data={routes.data?.items ?? []}
        loading={routes.isLoading}
        rowKey="id"
        emptyMessage={copy('No payment routes are configured.')}
        filters={
          <div className="flex flex-wrap gap-2">
            <DStatusFilter
              label={copy('Status')}
              value={status}
              allLabel={copy('All')}
              options={[
                { value: 'ACTIVE', label: copy('Active') },
                { value: 'INACTIVE', label: copy('Inactive') },
              ]}
              onChange={(value) => {
                setStatus(value as '' | RecordStatus);
                setOffset(0);
              }}
            />
            <DSelectFilter
              label={copy('Payment method')}
              value={method}
              clearable
              options={paymentMethods.map((value) => ({
                value,
                label: copy(paymentMethodLabel(value)),
              }))}
              onChange={(value) => {
                setMethod((value ?? '') as '' | PaymentMethod);
                setOffset(0);
              }}
            />
          </div>
        }
        headerActions={
          canUpdate ? (
            <DButton
              leftIcon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setEditor('create')}
            >
              {copy('Add route')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total: routes.data?.total ?? 0,
        }}
        onPageChange={(page) => setOffset((page - 1) * pageSize)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setOffset(0);
        }}
        actions={
          canUpdate
            ? [
                {
                  label: copy('Edit route'),
                  icon: <Pencil aria-hidden="true" className="size-4" />,
                  onClick: setEditor,
                },
              ]
            : []
        }
      />
      <RouteEditor
        key={editor === 'create' ? 'create' : (editor?.id ?? 'closed')}
        open={editor !== null}
        route={editor === 'create' ? null : editor}
        api={api}
        onClose={() => setEditor(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: routeKey })}
      />
    </section>
  );
}

function RouteEditor({
  open,
  route,
  api,
  onClose,
  onSaved,
}: {
  open: boolean;
  route: PaymentRoute | null;
  api: FinancialAccountsApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [locationId, setLocationId] = useState(route?.sellingLocationId ?? '');
  const [method, setMethod] = useState<PaymentMethod>(route?.paymentMethod ?? 'CASH');
  const [accountId, setAccountId] = useState(route?.financialAccountId ?? '');
  const [status, setStatus] = useState<RecordStatus>(route?.status ?? 'ACTIVE');
  const [locationOffset, setLocationOffset] = useState(0);
  const [accountOffset, setAccountOffset] = useState(0);
  const locations = useQuery({
    queryKey: ['payment-routing-locations', locationOffset],
    queryFn: () => api.listLocations(pageLimit, locationOffset),
    enabled: open && !route,
  });
  const accounts = useQuery({
    queryKey: ['payment-routing-accounts', accountOffset],
    queryFn: () => api.listAccounts({ status: 'ACTIVE', limit: pageLimit, offset: accountOffset }),
    enabled: open,
  });
  const accountOptions = (accounts.data?.items ?? []).map((account) => ({
    value: account.id,
    label: `${account.name} · ${account.code} · ${account.currency}`,
    disabled: !compatibleTypes[method].includes(account.type),
  }));
  if (route && !accountOptions.some((option) => option.value === route.financialAccountId))
    accountOptions.unshift({
      value: route.financialAccountId,
      label: `${route.financialAccountName} · ${route.financialAccountCode} · ${route.currency}`,
      disabled: false,
    });
  const valid = Boolean((route || locationId) && accountId);
  const save = async () => {
    if (!valid) return;
    try {
      if (route) await api.updateRoute(route, { financialAccountId: accountId, status });
      else {
        const account = (accounts.data?.items ?? []).find((item) => item.id === accountId);
        const existing = await api.listRoutes({
          sellingLocationId: locationId,
          paymentMethod: method,
          limit: 100,
          offset: 0,
        });
        const sameAccountRoute = existing.items.find(
          (item) =>
            item.currency === account?.currency &&
            item.financialAccountId === accountId,
        );
        if (sameAccountRoute)
          await api.updateRoute(sameAccountRoute, { status: 'ACTIVE' });
        else
          await api.createRoute({
            sellingLocationId: locationId,
            paymentMethod: method,
            financialAccountId: accountId,
          });
      }
      onSaved();
      onClose();
      showToast({
        variant: 'success',
        title: copy(route ? 'Payment route updated.' : 'Payment route added.'),
      });
    } catch (error) {
      showApiError(error, copy, showToast, copy('Could not save payment route.'));
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(route ? 'Edit route' : 'Add route')}
      description={copy('Route collected payments to the configured settlement destination.')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            disabled={!valid || locations.isLoading || accounts.isLoading}
            onClick={() => void save()}
          >
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        {route ? (
          <DInput
            label={copy('Selling location')}
            value={`${route.sellingLocationName} · ${route.sellingLocationCode}`}
            disabled
          />
        ) : (
          <PagedSelect
            label={copy('Selling location')}
            value={locationId}
            onChange={setLocationId}
            options={(locations.data?.items ?? []).map((location) => ({
              value: location.id,
              label: `${location.name} · ${location.code}`,
              disabled: location.status !== 'ACTIVE',
            }))}
            loading={locations.isLoading}
            offset={locationOffset}
            count={locations.data?.items.length ?? 0}
            hasNext={Boolean(
              locations.data && locations.data.items.length === locations.data.limit,
            )}
            onOffsetChange={setLocationOffset}
            copy={copy}
          />
        )}
        <DSelect
          label={copy('Payment method')}
          value={method}
          disabled={Boolean(route)}
          options={paymentMethods.map((value) => ({
            value,
            label: copy(paymentMethodLabel(value)),
          }))}
          onChange={(value) => {
            setMethod(value as PaymentMethod);
            setAccountId('');
            setAccountOffset(0);
          }}
        />
        <PagedSelect
          label={copy('Settlement destination')}
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
          loading={accounts.isLoading}
          offset={accountOffset}
          count={accounts.data?.items.length ?? 0}
          hasNext={Boolean(accounts.data && accounts.data.items.length === accounts.data.limit)}
          onOffsetChange={setAccountOffset}
          copy={copy}
        />
        {route ? (
          <DSelect
            label={copy('Status')}
            value={status}
            options={[
              { value: 'ACTIVE', label: copy('Active') },
              { value: 'INACTIVE', label: copy('Inactive') },
            ]}
            onChange={(value) => setStatus(value as RecordStatus)}
          />
        ) : null}
      </div>
    </DDialog>
  );
}

function PagedSelect({
  label,
  value,
  onChange,
  options,
  loading,
  offset,
  count,
  hasNext,
  onOffsetChange,
  copy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  loading: boolean;
  offset: number;
  count: number;
  hasNext: boolean;
  onOffsetChange: (offset: number) => void;
  copy: (value: string) => string;
}) {
  return (
    <div>
      <DSelect
        label={label}
        value={value}
        placeholder={copy('Select an option')}
        options={options}
        loading={loading}
        onChange={(next) => onChange(String(next ?? ''))}
      />
      <PageFooter
        offset={offset}
        count={count}
        hasNext={hasNext}
        onChange={onOffsetChange}
        copy={copy}
        compact
      />
    </div>
  );
}

function PageFooter({
  offset,
  count,
  hasNext,
  onChange,
  copy,
  compact = false,
}: {
  offset: number;
  count: number;
  hasNext: boolean;
  onChange: (offset: number) => void;
  copy: (value: string) => string;
  compact?: boolean;
}) {
  if (!count) return null;
  const page = Math.floor(offset / pageLimit) + 1;
  return (
    <div className={`${compact ? 'mt-2' : 'mt-4'} flex flex-wrap items-center justify-end gap-3`}>
      <span className="mr-auto text-xs text-[var(--color-text-muted)]">
        {copy('Showing')} {offset + 1}–{offset + count}
      </span>
      <DPagination
        page={page}
        totalPages={page + (hasNext ? 1 : 0)}
        onChange={(next) => onChange((next - 1) * pageLimit)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: RecordStatus }) {
  const { copy } = useBackofficeLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {copy(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
  );
}
function Fact({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[var(--color-text)] ${
          emphasized ? 'text-base font-semibold' : 'text-sm font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
async function provisionDefaultCheckoutRoute(
  api: FinancialAccountsApi,
  account: FinancialAccount,
): Promise<boolean> {
  if (account.status !== 'ACTIVE') return false;
  const method: PaymentMethod =
    account.type === 'BANK'
      ? 'BANK_TRANSFER'
      : account.type === 'E_WALLET'
        ? 'WALLET'
        : 'CASH';
  const locations = await api.listLocations(100, 0);
  const activeLocations = locations.items.filter((location) => location.status === 'ACTIVE');
  if (activeLocations.length !== 1) return false;

  const location = activeLocations[0]!;
  const existing = await api.listRoutes({
    sellingLocationId: location.id,
    paymentMethod: method,
    limit: 100,
    offset: 0,
  });
  const sameAccountRoute = existing.items.find(
    (route) =>
      route.financialAccountId === account.id &&
      route.currency === account.currency,
  );
  if (sameAccountRoute) {
    if (sameAccountRoute.status !== 'ACTIVE')
      await api.updateRoute(sameAccountRoute, { status: 'ACTIVE' });
    return true;
  }
  await api.createRoute({
    sellingLocationId: location.id,
    paymentMethod: method,
    financialAccountId: account.id,
  });
  return true;
}

function accountTypeLabel(type: FinancialAccountType) {
  return type === 'CASH' ? 'Cash account' : type === 'BANK' ? 'Bank account' : 'E-wallet account';
}
function paymentMethodLabel(method: PaymentMethod) {
  return method === 'CASH'
    ? 'Cash'
    : method === 'BANK_TRANSFER'
      ? 'Bank transfer'
      : method === 'WALLET'
        ? 'E-wallet'
        : 'QRIS';
}
function showApiError(
  error: unknown,
  copy: (value: string) => string,
  showToast: (input: { variant: 'danger' | 'warning'; title: string }) => void,
  fallback: string,
) {
  if (isSessionExpiredError(error)) return;
  const normalized = normalizeBackofficeApiError(error, fallback);
  showToast({
    variant: normalized.code === 'VERSION_CONFLICT' ? 'warning' : 'danger',
    title: copy(normalized.safeMessage),
  });
}
