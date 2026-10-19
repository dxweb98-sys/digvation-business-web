import { subtractDecimalStrings } from '@digvation/business-money';
import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDialog,
  DRangeDatePicker,
  DSelectFilter,
  DSkeleton,
  type TableColumn,
} from '@digvation/ui';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnalyticsKpiCard } from '../../../components/analytics/analytics-kpi-card';
import { useFormState } from '../../../shared/forms/use-form-state';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import { RecordPanel } from '../../../shared/ui/record-dialog';
import type {
  FinancialAccount,
  FinancialAccountsApi,
  FinancialAccountStatementMovement,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  accountDestinationSummary,
  EMPTY_VALUE,
} from '../model/financial-account-model';
import {
  EMPTY_STATEMENT_FILTERS,
  hasStatementFilters,
  MOVEMENT_SOURCE_LABELS,
  STATEMENT_DIRECTION_LABELS,
  toStatementFilterQuery,
  type StatementFilterState,
} from '../model/financial-account-statement-filters';
import { CodeChip, FinancialDialogTitle, RecordStatusBadge } from './financial-accounts-shared';

/**
 * Recorded movements of one Financial Account. Statement data is requested only while this
 * dialog is mounted; the caller keys it by account so filters and paging start fresh.
 */
export function FinancialAccountStatementDialog({
  account,
  api,
  onClose,
}: {
  account: FinancialAccount | null;
  api: Pick<FinancialAccountsApi, 'getStatement'>;
  onClose: () => void;
}) {
  const { copy, formatDate, formatMoney, businessTimezone } = useFinancialAccountsLocalization();
  const filters = useFormState<StatementFilterState>(EMPTY_STATEMENT_FILTERS);
  const pagination = usePaginationState({ initialPageSize: 25 });
  const filterQuery = toStatementFilterQuery(filters.values, businessTimezone);
  const statement = useListQuery({
    queryKey: ['financial-account-statement', account?.id, filterQuery],
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    queryFn: (page) =>
      api.getStatement(account!.id, { ...filterQuery, ...(page ?? pagination.request) }),
    enabled: Boolean(account),
  });
  if (!account) return null;
  const money = (amount: string) => formatMoney(amount, account.currency);
  const data = statement.data;
  const filtered = hasStatementFilters(filters.values);
  const changeFilter = (change: Partial<StatementFilterState>) => {
    pagination.resetPage();
    filters.patch(change);
  };
  const resetFilters = () => {
    pagination.resetPage();
    filters.patch(EMPTY_STATEMENT_FILTERS);
  };

  const columns: TableColumn<FinancialAccountStatementMovement>[] = [
    {
      key: 'occurredAt',
      label: copy('Date & time'),
      render: (movement) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDate(new Date(movement.occurredAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'source',
      label: copy('Activity'),
      render: (movement) => (
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">
            {copy(MOVEMENT_SOURCE_LABELS[movement.source])}
          </p>
          {movement.nature === 'REATTRIBUTION' ? (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {copy('Adjusts which account an earlier payment was recorded to.')}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'sourceId',
      label: copy('Reference'),
      render: (movement) => (
        <span
          className="block max-w-32 truncate font-mono text-xs text-[var(--color-text-muted)]"
          title={movement.sourceId}
        >
          {movement.sourceId}
        </span>
      ),
    },
    {
      key: 'incoming',
      label: copy('Money in'),
      align: 'right',
      render: (movement) => (
        <span className="whitespace-nowrap tabular-nums">
          {movement.direction === 'IN' ? money(movement.amount) : EMPTY_VALUE}
        </span>
      ),
    },
    {
      key: 'outgoing',
      label: copy('Money out'),
      align: 'right',
      render: (movement) => (
        <span className="whitespace-nowrap tabular-nums">
          {movement.direction === 'OUT' ? money(movement.amount) : EMPTY_VALUE}
        </span>
      ),
    },
  ];

  return (
    <DDialog
      open
      onClose={onClose}
      size="xl"
      title={<FinancialDialogTitle title={copy('Account movements')} />}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-5">
        <RecordPanel flat ariaLabel={copy('Account')}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
              {account.name}
            </h2>
            <RecordStatusBadge status={account.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
            <CodeChip code={account.code} />
            <span aria-hidden="true">•</span>
            <span className="font-medium text-[var(--color-brand)]">
              {copy(ACCOUNT_TYPE_LABELS[account.type])}
            </span>
            <span aria-hidden="true">•</span>
            <span>{account.currency}</span>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {accountDestinationSummary(account) ?? copy('On-site cash')}
          </p>
        </RecordPanel>

        {statement.isError ? (
          <DConnectionError
            title={copy('Could not load account movements.')}
            message={copy('Try loading the account movements again.')}
            onRetry={() => void statement.refetch()}
            isRetrying={statement.isFetching}
          />
        ) : (
          <section aria-label={copy('Summary')} className="space-y-2">
            {data ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AnalyticsKpiCard
                  flat
                  label={copy('Money in')}
                  value={money(data.totalIncoming)}
                  icon={<KpiIcon tone="success" icon={<ArrowDownLeft className="size-4" />} />}
                />
                <AnalyticsKpiCard
                  flat
                  label={copy('Money out')}
                  value={money(data.totalOutgoing)}
                  icon={<KpiIcon tone="danger" icon={<ArrowUpRight className="size-4" />} />}
                />
                <div className="col-span-2 sm:col-span-1">
                  <AnalyticsKpiCard
                    flat
                    label={copy('Movement difference')}
                    value={money(subtractDecimalStrings(data.totalIncoming, data.totalOutgoing))}
                    icon={<KpiIcon tone="brand" icon={<ArrowLeftRight className="size-4" />} />}
                  />
                </div>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="status"
                aria-label={copy('Loading summary...')}
              >
                <DSkeleton height={108} rounded="lg" />
                <DSkeleton height={108} rounded="lg" />
                <div className="col-span-2 sm:col-span-1">
                  <DSkeleton height={108} rounded="lg" />
                </div>
              </div>
            )}
            <p className="text-xs leading-5 text-[var(--color-text-muted)] sm:text-right">
              {copy(
                'Money in minus money out recorded in the system. This is not the current account balance.',
              )}
            </p>
          </section>
        )}

        <section aria-label={copy('Movement history')} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-[var(--color-text)]">
              {copy('Movement history')}
            </h3>
            {data ? <DBadge variant="secondary">{data.total}</DBadge> : null}
          </div>
          {statement.isError ? null : (
            <DDataTable
              columns={columns}
              data={data?.items ?? []}
              loading={statement.isLoading}
              rowKey="id"
              emptyMessage={
                filtered
                  ? copy('No movements match these filters.')
                  : copy('No recorded movements for this account.')
              }
              pagination={{
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: data?.total ?? 0,
              }}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              filters={
                <>
                  <div className="w-72 max-w-full">
                    <DRangeDatePicker
                      placeholder={copy('Period')}
                      value={{
                        ...(filters.values.dateFrom ? { start: filters.values.dateFrom } : {}),
                        ...(filters.values.dateTo ? { end: filters.values.dateTo } : {}),
                      }}
                      clearable
                      onChange={(range) =>
                        changeFilter({
                          dateFrom: range.start ?? '',
                          dateTo: range.end ?? range.start ?? '',
                        })
                      }
                    />
                  </div>
                  <div className="w-72 max-w-full">
                    <DSelectFilter
                      label={copy('Activity')}
                      value={filters.values.source || null}
                      clearable
                      onChange={(source) =>
                        changeFilter({
                          source: (source ?? '') as StatementFilterState['source'],
                        })
                      }
                      options={Object.entries(MOVEMENT_SOURCE_LABELS).map(([value, label]) => ({
                        value,
                        label: copy(label),
                      }))}
                    />
                  </div>
                  <div className="w-56 max-w-full">
                    <DSelectFilter
                      label={copy('Direction')}
                      value={filters.values.direction || null}
                      clearable
                      onChange={(direction) =>
                        changeFilter({
                          direction: (direction ?? '') as StatementFilterState['direction'],
                        })
                      }
                      options={Object.entries(STATEMENT_DIRECTION_LABELS).map(([value, label]) => ({
                        value,
                        label: copy(label),
                      }))}
                    />
                  </div>
                </>
              }
              headerActions={
                filtered ? (
                  <DButton
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw className="size-4" />}
                    onClick={resetFilters}
                  >
                    {copy('Reset filters')}
                  </DButton>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </DDialog>
  );
}

const KPI_TONES = {
  success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  brand: 'bg-[var(--color-accent-sky)] text-[var(--color-brand)]',
};

function KpiIcon({ tone, icon }: { tone: keyof typeof KPI_TONES; icon: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 items-center justify-center rounded-lg ${KPI_TONES[tone]}`}
    >
      {icon}
    </span>
  );
}
