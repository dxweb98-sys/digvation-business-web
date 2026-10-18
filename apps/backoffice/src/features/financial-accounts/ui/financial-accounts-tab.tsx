import {
  DButton,
  DConnectionError,
  DDataTable,
  DSelectFilter,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { CircleCheck, CircleOff, Eye, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { useFormState } from '../../../shared/forms/use-form-state';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import type {
  FinancialAccount,
  FinancialAccountsApi,
  FinancialAccountType,
  RecordStatus,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  accountDestinationSummary,
  EMPTY_VALUE,
  FINANCIAL_ACCOUNT_TYPES,
} from '../model/financial-account-model';
import { FinancialAccountDetailDialog } from './financial-account-detail-dialog';
import { FinancialAccountDialog } from './financial-account-dialog';
import { RecordIdentity, RecordStatusBadge, useApiErrorToast } from './financial-accounts-shared';

type AccountFilterState = { q: string; type: '' | FinancialAccountType; status: '' | RecordStatus };

export const financialAccountKeys = { list: ['financial-accounts'] as const };

export function FinancialAccountsTab({
  api,
  canCreate,
  canUpdate,
  onAccountsChanged,
}: {
  api: FinancialAccountsApi;
  canCreate: boolean;
  canUpdate: boolean;
  onAccountsChanged: () => void;
}) {
  const { copy } = useFinancialAccountsLocalization();
  const { showToast } = useToast();
  const showApiError = useApiErrorToast();
  const filters = useFormState<AccountFilterState>({ q: '', type: '', status: '' });
  const query = filters.values;
  const pagination = usePaginationState({ initialPageSize: 20 });
  const [editor, setEditor] = useState<FinancialAccount | null | undefined>();
  const [detail, setDetail] = useState<FinancialAccount | null>(null);
  const accounts = useListQuery({
    queryKey: [...financialAccountKeys.list, query],
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    queryFn: (page) =>
      api.listAccounts({ ...toAccountQuery(query), ...(page ?? pagination.request) }),
  });

  const changeFilter = (change: Partial<AccountFilterState>) => {
    pagination.resetPage();
    filters.patch(change);
  };
  const setLifecycle = async (account: FinancialAccount) => {
    const deactivate = account.status === 'ACTIVE';
    try {
      await api.updateAccount(account, { status: deactivate ? 'INACTIVE' : 'ACTIVE' });
      onAccountsChanged();
      showToast({
        variant: 'success',
        title: copy(deactivate ? 'Financial account deactivated.' : 'Financial account activated.'),
      });
    } catch (error) {
      showApiError(error, copy('Could not update financial account.'));
    }
  };

  const columns: TableColumn<FinancialAccount>[] = [
    {
      key: 'name',
      label: copy('Account'),
      render: (account) => <RecordIdentity name={account.name} code={account.code} />,
    },
    {
      key: 'type',
      label: copy('Type'),
      render: (account) => copy(ACCOUNT_TYPE_LABELS[account.type]),
    },
    { key: 'currency', label: copy('Currency') },
    {
      key: 'destination',
      label: copy('Destination'),
      render: (account) =>
        account.type === 'CASH' ? (
          copy('On-site cash')
        ) : (
          <span className="break-words">{accountDestinationSummary(account) ?? EMPTY_VALUE}</span>
        ),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (account) => <RecordStatusBadge status={account.status} />,
    },
  ];

  if (accounts.isError)
    return (
      <DConnectionError
        title={copy('Could not load financial accounts.')}
        message={copy('Try loading the account list again.')}
        onRetry={() => void accounts.refetch()}
        isRetrying={accounts.isFetching}
      />
    );

  return (
    <>
      <DDataTable
        columns={columns}
        data={accounts.data?.items ?? []}
        loading={accounts.isLoading}
        rowKey="id"
        searchable
        searchPlaceholder={copy('Search account code or name...')}
        searchValue={query.q}
        onSearchChange={(q) => changeFilter({ q })}
        filters={
          <>
            <DSelectFilter
              label={copy('Account type')}
              value={query.type || null}
              onChange={(type) => changeFilter({ type: (type ?? '') as '' | FinancialAccountType })}
              clearable
              options={FINANCIAL_ACCOUNT_TYPES.map((value) => ({
                value,
                label: copy(ACCOUNT_TYPE_LABELS[value]),
              }))}
            />
            <DSelectFilter
              label={copy('Status')}
              value={query.status || null}
              onChange={(status) => changeFilter({ status: (status ?? '') as '' | RecordStatus })}
              clearable
              options={[
                { value: 'ACTIVE', label: copy('Active') },
                { value: 'INACTIVE', label: copy('Inactive') },
              ]}
            />
          </>
        }
        headerActions={
          canCreate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditor(null)}>
              {copy('Add account')}
            </DButton>
          ) : null
        }
        emptyMessage={
          query.q || query.type || query.status
            ? copy('No matching financial accounts found.')
            : copy('No financial accounts are configured.')
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: accounts.data?.total ?? 0,
        }}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        actions={[
          {
            label: copy('View details'),
            icon: <Eye className="size-4" />,
            onClick: setDetail,
          },
          {
            label: copy('Edit account'),
            icon: <Pencil className="size-4" />,
            onClick: setEditor,
            show: () => canUpdate,
          },
          {
            label: copy('Deactivate account'),
            icon: <CircleOff className="size-4" />,
            variant: 'danger',
            onClick: (account) => void setLifecycle(account),
            show: (account) => canUpdate && account.status === 'ACTIVE',
          },
          {
            label: copy('Activate account'),
            icon: <CircleCheck className="size-4" />,
            onClick: (account) => void setLifecycle(account),
            show: (account) => canUpdate && account.status === 'INACTIVE',
          },
        ]}
      />
      <FinancialAccountDialog
        key={`editor-${editor?.id ?? (editor === null ? 'new' : 'closed')}`}
        account={editor}
        api={api}
        onClose={() => setEditor(undefined)}
        onSaved={onAccountsChanged}
      />
      <FinancialAccountDetailDialog
        key={`detail-${detail?.id ?? 'closed'}`}
        account={detail}
        canUpdate={canUpdate}
        onClose={() => setDetail(null)}
        onEdit={(account) => {
          setDetail(null);
          setEditor(account);
        }}
      />
    </>
  );
}

function toAccountQuery({ q, type, status }: AccountFilterState) {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };
}
