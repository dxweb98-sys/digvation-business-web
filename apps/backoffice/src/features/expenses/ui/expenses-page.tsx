import { DButton, DConnectionError, DDataTable, useToast, type TableColumn } from '@digvation/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRuntime } from '@digvation/business-runtime';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { canPerformBackofficeAction } from '../../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import { ExpenseApi, type Expense } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';
import {
  expenseCategoryLabel,
  expenseDescription,
  isExpenseEditable,
} from '../model/expense-model';
import { ExpenseDetailDialog } from './expense-detail-dialog';
import { ExpenseDialog } from './expense-dialog';
import {
  EMPTY_EXPENSE_FILTERS,
  ExpenseFilters,
  hasActiveExpenseFilters,
  toExpenseQuery,
  type ExpenseFilterState,
} from './expense-filters';
import { ExpenseSourceAccount, ExpenseStatusBadge } from './expense-presentation';
import { ExpenseRejectDialog } from './expense-reject-dialog';

export const expenseKeys = { list: ['expenses'] as const };

export function ExpensesPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, labels, formatDate, formatMoney } = useExpensesLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new ExpenseApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const can = (action: Parameters<typeof canPerformBackofficeAction>[1]) =>
    Boolean(session && canPerformBackofficeAction(session, action));

  const filters = useFormState<ExpenseFilterState>(EMPTY_EXPENSE_FILTERS);
  const query = filters.values;
  const pagination = usePaginationState({ initialPageSize: 20 });
  const [editor, setEditor] = useState<Expense | null | undefined>();
  const [detail, setDetail] = useState<Expense | null>(null);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const expenses = useListQuery({
    queryKey: [...expenseKeys.list, query],
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    queryFn: (page) => api.list({ ...toExpenseQuery(query), ...(page ?? pagination.request) }),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: expenseKeys.list });
  const changeFilter = (change: Partial<ExpenseFilterState>) => {
    pagination.resetPage();
    filters.patch(change);
  };
  const showFailure = (error: unknown, fallback: string) => {
    if (isSessionExpiredError(error)) return;
    const failure = normalizeBackofficeApiError(error, fallback);
    showToast({
      variant: failure.code === 'VERSION_CONFLICT' ? 'warning' : 'danger',
      title: copy(failure.safeMessage),
    });
  };
  const approve = async (expense: Expense) => {
    try {
      await api.approve(expense);
      refresh();
      showToast({ variant: 'success', title: copy('Expense approved.') });
    } catch (error) {
      showFailure(error, copy('Could not approve expense.'));
    }
  };
  const reject = async (expense: Expense, note: string) => {
    try {
      await api.reject(expense, note);
      refresh();
      showToast({ variant: 'success', title: copy('Expense rejected.') });
      return true;
    } catch (error) {
      showFailure(error, copy('Could not reject expense.'));
      return false;
    }
  };

  const columns: TableColumn<Expense>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (expense) => (
        <span className="whitespace-nowrap">
          {formatDate(new Date(expense.occurredAt), { dateStyle: 'medium' })}
        </span>
      ),
    },
    {
      key: 'location',
      label: copy('Selling location'),
      render: (expense) => expense.sellingLocationName,
    },
    {
      key: 'account',
      label: copy('Source account'),
      render: (expense) => <ExpenseSourceAccount expense={expense} />,
    },
    {
      key: 'category',
      label: copy('Category'),
      render: (expense) => expenseCategoryLabel(expense.categoryCode, labels),
    },
    {
      key: 'description',
      label: copy('Description'),
      render: (expense) => {
        const description = expenseDescription(expense.note);
        return (
          <span className="line-clamp-2 break-words" title={expense.note ?? undefined}>
            {description}
          </span>
        );
      },
    },
    {
      key: 'amount',
      label: copy('Amount'),
      align: 'right',
      render: (expense) => (
        <span className="whitespace-nowrap font-medium tabular-nums">
          {formatMoney(expense.amount, expense.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (expense) => <ExpenseStatusBadge status={expense.status} />,
    },
  ];

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Finance')}
        title={copy('Expenses')}
        description={copy('Record, review, and approve Finance expenses.')}
      />
      <section className="mt-6">
        {expenses.isError ? (
          <DConnectionError
            title={copy('Could not load expenses.')}
            message={copy('Try loading the expense list again.')}
            onRetry={() => void expenses.refetch()}
            isRetrying={expenses.isFetching}
          />
        ) : (
          <DDataTable
            columns={columns}
            data={expenses.data?.items ?? []}
            loading={expenses.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search description, account, or location...')}
            searchValue={query.q}
            onSearchChange={(q) => changeFilter({ q })}
            filters={
              <ExpenseFilters
                api={api}
                value={query}
                rows={expenses.data?.items ?? []}
                onChange={changeFilter}
              />
            }
            headerActions={
              can('createExpense') ? (
                <DButton
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setEditor(null)}
                >
                  {copy('Record expense')}
                </DButton>
              ) : null
            }
            actions={[
              {
                label: copy('View expense'),
                icon: <Eye aria-hidden="true" className="size-4" />,
                onClick: setDetail,
              },
              {
                label: copy('Edit expense'),
                icon: <Pencil aria-hidden="true" className="size-4" />,
                onClick: setEditor,
                show: (expense) => isExpenseEditable(expense) && can('updateExpense'),
              },
              {
                label: copy('Approve expense'),
                icon: <Check aria-hidden="true" className="size-4" />,
                onClick: (expense) => void approve(expense),
                show: (expense) => expense.status === 'PENDING' && can('approveExpense'),
              },
              {
                label: copy('Reject expense'),
                icon: <X aria-hidden="true" className="size-4" />,
                variant: 'danger',
                onClick: setRejecting,
                show: (expense) => expense.status === 'PENDING' && can('rejectExpense'),
              },
            ]}
            pagination={{
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: expenses.data?.total ?? 0,
            }}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            emptyMessage={
              hasActiveExpenseFilters(query)
                ? copy('No matching expenses found.')
                : copy('No expenses are recorded.')
            }
          />
        )}
      </section>
      <ExpenseDialog
        key={`editor-${editor?.id ?? (editor === null ? 'new' : 'closed')}`}
        expense={editor}
        api={api}
        onClose={() => setEditor(undefined)}
        onSaved={refresh}
      />
      <ExpenseDetailDialog expense={detail} onClose={() => setDetail(null)} />
      <ExpenseRejectDialog
        key={`reject-${rejecting?.id ?? 'closed'}`}
        expense={rejecting}
        onClose={() => setRejecting(null)}
        onReject={reject}
      />
    </BackofficePage>
  );
}
