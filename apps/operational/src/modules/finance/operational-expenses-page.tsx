import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DConnectionError,
  DCurrencyInput,
  DDataTable,
  DDialog,
  DSelect,
  DTextarea,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { OperationalExpenseApi, type OperationalExpense } from './operational-expense-api';

const PAGE_SIZE = 20;

export function OperationalExpensesPage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, locale, formatDate, formatMoney } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [financialAccountId, setFinancialAccountId] = useState('');
  const [categoryCode, setCategoryCode] = useState('OPERATIONS');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const api = useMemo(
    () =>
      new OperationalExpenseApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          applicationSurface: 'operational',
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );
  const canCreate =
    session.access.permissions.includes('expenses:create') &&
    session.access.permissions.includes('financial-accounts:read');

  const expenses = useQuery({
    queryKey: ['operational-expenses', selectedLocationId, offset],
    enabled: Boolean(selectedLocationId),
    queryFn: () =>
      api.list({
        limit: PAGE_SIZE,
        offset,
        sellingLocationId: selectedLocationId ?? undefined,
      }),
  });
  const accounts = useQuery({
    queryKey: ['operational-expense-accounts', selectedLocationId],
    enabled: Boolean(selectedLocationId && canCreate && isCreateOpen),
    queryFn: () => api.listEligibleAccounts(selectedLocationId!),
  });
  const eligibleAccounts = accounts.data?.items ?? [];
  const createExpense = useMutation({
    mutationFn: () =>
      api.create({
        sellingLocationId: selectedLocationId!,
        financialAccountId,
        categoryCode: categoryCode.trim().toUpperCase(),
        amount,
        occurredAt: new Date().toISOString(),
        note: note.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operational-expenses'] });
      setCreateOpen(false);
      setFinancialAccountId('');
      setAmount('');
      setNote('');
      showToast({ variant: 'success', title: copy('Expense submitted.') });
    },
    onError: () => showToast({ variant: 'danger', title: copy('Could not submit expense.') }),
  });

  if (expenses.isError)
    return (
      <div className="p-5 md:p-6 lg:p-8">
        <DConnectionError
          title={copy('Could not load expenses.')}
          message={copy('Try loading expenses again.')}
          onRetry={() => void expenses.refetch()}
        />
      </div>
    );

  const columns: TableColumn<OperationalExpense>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (row) =>
        formatDate(new Date(row.occurredAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
    {
      key: 'category',
      label: copy('Category'),
      render: (row) => label(row.categoryCode),
    },
    {
      key: 'account',
      label: copy('Account'),
      render: (row) => row.financialAccountName,
    },
    {
      key: 'amount',
      label: copy('Amount'),
      render: (row) => formatMoney(row.amount, row.currency),
    },
    {
      key: 'description',
      label: copy('Description'),
      render: (row) => row.note || '-',
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={row.status === 'APPROVED' ? 'success' : 'outline'}>
          {label(row.status)}
        </DBadge>
      ),
    },
  ];

  const pageTitle = locale === 'id-ID' ? 'Pengeluaran' : 'Expenses';
  const pageDescription =
    locale === 'id-ID'
      ? 'Pengeluaran operasional pada lokasi aktif yang diizinkan.'
      : 'Operational expenses for the active authorized location.';

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
            {copy('Operations')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{pageDescription}</p>
        </div>
        {canCreate ? (
          <DButton
            leftIcon={<Plus className="size-4" />}
            disabled={!selectedLocationId}
            onClick={() => setCreateOpen(true)}
          >
            {copy('New expense')}
          </DButton>
        ) : null}
      </header>

      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={expenses.data?.items ?? []}
          loading={expenses.isLoading || !selectedLocationId}
          rowKey="id"
          pagination={{
            page: Math.floor(offset / PAGE_SIZE) + 1,
            pageSize: PAGE_SIZE,
            total: expenses.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
          emptyMessage={copy('No operational expenses yet.')}
        />
      </section>

      <DDialog
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        title={copy('New expense')}
        className="w-full max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setCreateOpen(false)}>
              {copy('Cancel')}
            </DButton>
            <DButton
              loading={createExpense.isPending}
              disabled={
                !selectedLocationId ||
                !financialAccountId ||
                !categoryCode.trim() ||
                !/^\d+(\.\d{1,4})?$/.test(amount)
              }
              onClick={() => createExpense.mutate()}
            >
              {copy('Save')}
            </DButton>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DSelect
            label={copy('Account')}
            value={financialAccountId}
            clearable={false}
            options={eligibleAccounts.map((account) => ({
              value: account.id,
              label: `${account.name} (${account.currency})`,
            }))}
            onValueChange={(value) => setFinancialAccountId(String(value ?? ''))}
          />
          <DSelect
            label={copy('Category')}
            value={categoryCode}
            placeholder={copy('Select expense category')}
            options={[
              { value: 'OPERATIONS', label: copy('Operations') },
              { value: 'TRANSPORT', label: copy('Transport') },
              { value: 'SUPPLIES', label: copy('Supplies') },
              { value: 'OTHER', label: copy('Other') },
            ]}
            onChange={(x) => setCategoryCode(String(x))}
          />
          <DCurrencyInput
            label={copy('Amount')}
            value={amount}
            onValueChange={setAmount}
            placeholder={copy('For example, 150000')}
          />
          <DTextarea
            label={copy('Note')}
            value={note}
            onChange={setNote}
            placeholder={copy('For example, Additional notes')}
            containerClassName="sm:col-span-2"
          />
        </div>
      </DDialog>
    </div>
  );
}