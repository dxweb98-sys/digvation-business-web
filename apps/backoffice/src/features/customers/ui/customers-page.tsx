import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DDataTable,
  DDialog,
  DInput,
  DSelectFilter,
  DSkeleton,
  type TableColumn,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { canAccessBackoffice, canPerformBackofficeAction } from '../../../auth/backoffice-access';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import { useFormState } from '../../../shared/forms/use-form-state';
import {
  RecordDialogFooter,
  RecordDialogTitle,
  RecordInfoTile,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import { CustomersApi, type Customer } from '../api/customers-api';
import { customerQueryKeys, customerQueryScope } from '../api/customer-query-keys';
import { customerCopy } from '../localization/customer-copy';
import {
  sanitizeNationalMemberPhone,
  toCanonicalMemberPhone,
  toNationalMemberPhone,
} from '../../../modules/membership/member-phone';

function useCustomerLocalization() {
  const base = useBackofficeLocalization();
  return { ...base, text: (key: keyof typeof customerCopy) => customerCopy[key][base.locale] };
}

export function CustomersPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { text } = useCustomerLocalization();
  const api = useMemo(
    () => new CustomersApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const pagination = usePaginationState();
  const filters = useFormState<{ q: string; status: '' | Customer['status'] }>({
    q: '',
    status: '',
  });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selectionScope, setSelectionScope] = useState('');
  const scope = customerQueryScope(session);
  const scopeIdentity = JSON.stringify(scope);
  const client = useQueryClient();
  const canMembership = Boolean(session && canAccessBackoffice(session, 'memberships'));
  const canEdit = Boolean(session && canPerformBackofficeAction(session, 'manageCustomer'));
  const customers = useListQuery({
    queryKey: customerQueryKeys.list(scope, filters.values, canMembership),
    pagination,
    queryFn: (page) =>
      api.list({
        ...page!,
        ...(filters.values.q ? { q: filters.values.q } : {}),
        ...(filters.values.status ? { status: filters.values.status } : {}),
      }),
    enabled: Boolean(session),
  });
  const columns: TableColumn<Customer>[] = [
    {
      key: 'name',
      label: text('Name'),
      render: (customer) => <span className="font-medium">{customer.name}</span>,
    },
    { key: 'phoneE164', label: text('Phone') },
    {
      key: 'status',
      label: text('Status'),
      render: (customer) => <CustomerStatus status={customer.status} />,
    },
    ...(canMembership
      ? [
          {
            key: 'membership',
            label: text('Type'),
            render: (customer: Customer) =>
              customer.membership ? text('Member') : text('Regular'),
          },
        ]
      : []),
  ];
  return (
    <BackofficePage>
      <BackofficePageHeader title={text('Customers')} description={text('description')} />
      {customers.isError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-4"
        >
          <p>{text('LoadError')}</p>
          <DButton variant="secondary" onClick={() => void customers.refetch()}>
            {text('Retry')}
          </DButton>
        </div>
      ) : null}
      <DDataTable
        columns={columns}
        data={customers.data?.items ?? []}
        loading={customers.isLoading}
        rowKey="id"
        searchable
        searchPlaceholder={text('search')}
        searchValue={filters.values.q}
        onSearchChange={(q) => {
          filters.setField('q', q);
          pagination.resetPage();
        }}
        filters={
          <DSelectFilter
            label={text('Status')}
            value={filters.values.status || null}
            clearable
            onChange={(value) => {
              filters.setField('status', (value ?? '') as '' | Customer['status']);
              pagination.resetPage();
            }}
            options={[
              { value: 'ACTIVE', label: text('Active') },
              { value: 'INACTIVE', label: text('Inactive') },
            ]}
          />
        }
        emptyMessage={
          filters.values.q || filters.values.status ? text('NoResults') : text('NoCustomers')
        }
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: customers.data?.total ?? 0,
        }}
        onPageChange={pagination.setPage}
        onRowClick={(customer) => {
          setSelectionScope(scopeIdentity);
          setSelected(customer);
        }}
        onPageSizeChange={pagination.setPageSize}
        actions={[
          {
            label: text('Detail'),
            icon: <Eye className="size-4" />,
            onClick: (customer) => {
              setSelectionScope(scopeIdentity);
              setSelected(customer);
            },
          },
          {
            label: text('Edit'),
            icon: <Pencil className="size-4" />,
            onClick: (customer) => {
              setSelectionScope(scopeIdentity);
              setEditing(customer);
            },
            show: () => canEdit,
          },
        ]}
      />
      {selected && selectionScope === scopeIdentity ? (
        <CustomerDetailDialog
          customer={selected}
          scope={scope}
          api={api}
          canEdit={canEdit}
          canMembership={canMembership}
          onClose={() => setSelected(null)}
          onEdit={(customer) => {
            setSelected(null);
            setEditing(customer);
          }}
        />
      ) : null}
      {editing && canEdit && selectionScope === scopeIdentity ? (
        <CustomerEditDialog
          key={editing.id}
          customer={editing}
          api={api}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void client.invalidateQueries({ queryKey: ['customers'] });
            void client.invalidateQueries({ queryKey: ['memberships'] });
          }}
        />
      ) : null}
    </BackofficePage>
  );
}

function CustomerStatus({ status }: { status: Customer['status'] }) {
  const { text } = useCustomerLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {text(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
  );
}

function CustomerDetailDialog({
  customer,
  scope,
  api,
  canEdit,
  canMembership,
  onClose,
  onEdit,
}: {
  customer: Customer;
  scope: readonly string[];
  api: CustomersApi;
  canEdit: boolean;
  canMembership: boolean;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}) {
  const { text, formatMoney, formatDateTime } = useCustomerLocalization();
  const navigate = useNavigate();
  const detail = useQuery({
    queryKey: customerQueryKeys.detail(scope, customer.id, canMembership),
    queryFn: () => api.detail(customer.id),
  });
  const profile = detail.data?.customer ?? customer;
  const membership = canMembership ? detail.data?.membership : undefined;
  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={
        <RecordDialogTitle title={text('Detail')}>
          <CustomerStatus status={profile.status} />
        </RecordDialogTitle>
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {text('Close')}
          </DButton>
          {canEdit ? (
            <DButton leftIcon={<Pencil className="size-4" />} onClick={() => onEdit(profile)}>
              {text('Edit')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <RecordSectionLabel>{text('Identity')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile label={text('Name')} value={profile.name} />
            <RecordInfoTile label={text('Phone')} value={profile.phoneE164} />
          </div>
        </RecordPanel>
        {membership ? (
          <RecordPanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <RecordSectionLabel>{text('MemberNumber')}</RecordSectionLabel>
                <p className="mt-2 font-mono font-semibold">{membership.memberNumber}</p>
                <CustomerStatus status={membership.status} />
              </div>
              <DButton variant="secondary" onClick={() => navigate('/memberships')}>
                {text('Membership')}
              </DButton>
            </div>
          </RecordPanel>
        ) : null}
        <RecordPanel>
          <RecordSectionLabel>{text('Transactions')}</RecordSectionLabel>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {text('HistoryNote')}
            {detail.data ? ` (${detail.data.transactionTotal})` : ''}
          </p>
          {detail.isLoading ? (
            <DSkeleton className="mt-4 h-24 w-full" />
          ) : detail.isError ? (
            <div role="alert" className="mt-4">
              <p>{text('LoadError')}</p>
              <DButton variant="secondary" onClick={() => void detail.refetch()}>
                {text('Retry')}
              </DButton>
            </div>
          ) : detail.data?.recentTransactions.length ? (
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              {detail.data.recentTransactions.map((sale) => (
                <div key={sale.saleId} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {sale.saleNumber ?? sale.saleId}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {formatDateTime(sale.finalizedAt)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatMoney(sale.totalAmount, sale.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">{text('NoTransactions')}</p>
          )}
        </RecordPanel>
      </div>
    </DDialog>
  );
}

function CustomerEditDialog({
  customer,
  api,
  onClose,
  onSaved,
}: {
  customer: Customer;
  api: CustomersApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { text } = useCustomerLocalization();
  const draft = useFormState({ name: customer.name, phone: toNationalMemberPhone(customer.phoneE164) });
  const [validation, setValidation] = useState(false);
  const save = useMutation({
    mutationFn: () => api.update(customer, {
      name: draft.values.name,
      phone: toCanonicalMemberPhone(draft.values.phone) ?? draft.values.phone,
    }),
    onSuccess: onSaved,
  });
  const valid =
    draft.values.name.trim().length > 0 &&
    draft.values.name.trim().length <= 160 &&
    Boolean(toCanonicalMemberPhone(draft.values.phone));
  return (
    <DDialog
      open
      onClose={save.isPending ? () => undefined : onClose}
      title={<RecordDialogTitle title={text('Edit')} />}
      size="lg"
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => {
            setValidation(!valid);
            if (valid) save.mutate();
          }}
          saving={save.isPending}
          disabled={save.isPending}
          saveLabel={text('Save')}
        />
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <RecordSectionLabel>{text('Identity')}</RecordSectionLabel>
          <div className="mt-4 space-y-4">
            <DInput
              label={text('Name')}
              value={draft.values.name}
              maxLength={160}
              onChange={(value) => draft.setField('name', value)}
            />
            <DInput
              label={text('Phone')}
              value={draft.values.phone}
              onChange={(value) => draft.setField('phone', sanitizeNationalMemberPhone(value))}
              type="tel"
              inputMode="tel"
            />
            <p className="text-xs text-[var(--color-text-muted)]">{text('NationalPhone')}</p>
          </div>
        </RecordPanel>
        <p className="text-sm text-[var(--color-text-muted)]">{text('ProfileNote')}</p>
        {validation ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {text('Validation')}
          </p>
        ) : null}
        {save.isError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {normalizeBackofficeApiError(save.error).safeMessage}
          </p>
        ) : null}
      </div>
    </DDialog>
  );
}
