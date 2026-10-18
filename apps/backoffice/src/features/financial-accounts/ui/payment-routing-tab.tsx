import {
  DButton,
  DConnectionError,
  DDataTable,
  DSelectFilter,
  type TableColumn,
} from '@digvation/ui';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { useFormState } from '../../../shared/forms/use-form-state';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import type {
  FinancialAccountsApi,
  PaymentMethod,
  PaymentRoute,
  RecordStatus,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '../model/financial-account-model';
import { PaymentRouteDialog } from './payment-route-dialog';
import { RecordIdentity, RecordStatusBadge } from './financial-accounts-shared';

type RouteFilterState = { paymentMethod: '' | PaymentMethod; status: '' | RecordStatus };

export const paymentRouteKeys = { list: ['payment-routing'] as const };

export function PaymentRoutingTab({
  api,
  canUpdate,
  onRoutesChanged,
}: {
  api: FinancialAccountsApi;
  canUpdate: boolean;
  onRoutesChanged: () => void;
}) {
  const { copy } = useFinancialAccountsLocalization();
  const filters = useFormState<RouteFilterState>({ paymentMethod: '', status: '' });
  const query = filters.values;
  const pagination = usePaginationState({ initialPageSize: 20 });
  const [editor, setEditor] = useState<PaymentRoute | null | undefined>();
  const routes = useListQuery({
    queryKey: [...paymentRouteKeys.list, query],
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    queryFn: (page) =>
      api.listRoutes({
        ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(page ?? pagination.request),
      }),
  });

  const changeFilter = (change: Partial<RouteFilterState>) => {
    pagination.resetPage();
    filters.patch(change);
  };

  const columns: TableColumn<PaymentRoute>[] = [
    {
      key: 'location',
      label: copy('Selling location'),
      render: (route) => (
        <RecordIdentity name={route.sellingLocationName} code={route.sellingLocationCode} />
      ),
    },
    {
      key: 'paymentMethod',
      label: copy('Payment method'),
      render: (route) => copy(PAYMENT_METHOD_LABELS[route.paymentMethod]),
    },
    {
      key: 'destination',
      label: copy('Settlement destination'),
      render: (route) => (
        <RecordIdentity
          name={route.financialAccountName}
          code={route.financialAccountCode}
          meta={copy(ACCOUNT_TYPE_LABELS[route.financialAccountType])}
        />
      ),
    },
    { key: 'currency', label: copy('Currency') },
    {
      key: 'status',
      label: copy('Status'),
      render: (route) => <RecordStatusBadge status={route.status} />,
    },
  ];

  if (routes.isError)
    return (
      <DConnectionError
        title={copy('Could not load payment routing.')}
        message={copy('Try loading the routing list again.')}
        onRetry={() => void routes.refetch()}
        isRetrying={routes.isFetching}
      />
    );

  return (
    <>
      <DDataTable
        columns={columns}
        data={routes.data?.items ?? []}
        loading={routes.isLoading}
        rowKey="id"
        filters={
          <>
            <DSelectFilter
              label={copy('Payment method')}
              value={query.paymentMethod || null}
              onChange={(paymentMethod) =>
                changeFilter({ paymentMethod: (paymentMethod ?? '') as '' | PaymentMethod })
              }
              clearable
              options={PAYMENT_METHODS.map((value) => ({
                value,
                label: copy(PAYMENT_METHOD_LABELS[value]),
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
          canUpdate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditor(null)}>
              {copy('Add route')}
            </DButton>
          ) : null
        }
        emptyMessage={
          query.paymentMethod || query.status
            ? copy('No matching payment routes found.')
            : copy('No payment routes are configured.')
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: routes.data?.total ?? 0,
        }}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        actions={[
          {
            label: copy('Edit route'),
            icon: <Pencil className="size-4" />,
            onClick: setEditor,
            show: () => canUpdate,
          },
        ]}
      />
      <PaymentRouteDialog
        key={editor?.id ?? (editor === null ? 'new' : 'closed')}
        route={editor}
        api={api}
        onClose={() => setEditor(undefined)}
        onSaved={onRoutesChanged}
      />
    </>
  );
}
