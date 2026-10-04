import type { AuthSession } from '@digvation/business-auth';
import { DBadge, DDataTable, type TableColumn } from '@digvation/ui';
import { Eye } from 'lucide-react';
import { useState } from 'react';

import type { usePaginationState } from '../../../shared/query/use-pagination-state';
import { transactionStatusSummary } from '../../transaction-history';
import type { ReportRow } from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import { BADGE_VARIANTS, type ReportColumn, type ReportDefinition } from '../model/report-catalog';
import {
  EMPTY_VALUE,
  enumLabel,
  formatActor,
  formatReportValue,
  isBlank,
} from '../model/report-format';
import type { EmployeeDetailScope } from './employee-performance-dialog';
import { ReportDetail } from './report-detail-dialogs';

type Pagination = ReturnType<typeof usePaginationState>;

/**
 * The transaction detail is the Transaction History detail, which reads a completed Sale in full
 * only with `sales:read-completed`; without it there is nothing authoritative to open.
 */
export function canOpenReportDetail(definition: ReportDefinition, session: AuthSession | null) {
  if (!definition.detail) return false;
  if (definition.detail === 'transaction')
    return Boolean(session?.access.permissions.includes('sales:read-completed'));
  return true;
}

export function ReportRecords({
  definition,
  rows,
  total,
  loading,
  pagination,
  session,
  scope,
}: {
  definition: ReportDefinition;
  rows: ReportRow[];
  total: number;
  loading: boolean;
  pagination: Pagination;
  session: AuthSession | null;
  scope: EmployeeDetailScope;
}) {
  const { copy } = useReportingLocalization();
  // The selected row outlives the dialog's visibility so it can fade out intact.
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [open, setOpen] = useState(false);
  const detail = canOpenReportDetail(definition, session) ? definition.detail : null;
  const columns: TableColumn<ReportRow>[] = (definition.columns ?? []).map((column) => ({
    key: column.key,
    label: copy(column.label),
    ...(column.align ? { align: column.align } : {}),
    render: (row) => <ReportCell column={column} row={row} />,
  }));

  return (
    <section aria-label={copy('Detailed records')} className="space-y-3">
      <header>
        <h2 className="text-sm font-semibold tracking-tight">{copy('Detailed records')}</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {copy('Records for the selected report, period, and filters.')}
        </p>
      </header>
      <DDataTable
        rowKey={(row, index) =>
          String(row.id ?? row.saleId ?? row.employeeId ?? `${row.saleNumber ?? ''}-${index}`)
        }
        loading={loading}
        data={rows}
        columns={columns}
        emptyMessage={copy('No report data is available for this period.')}
        pagination={{ page: pagination.page, pageSize: pagination.pageSize, total }}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        {...(detail
          ? {
              actions: [
                {
                  label: copy('View detail'),
                  icon: <Eye aria-hidden="true" className="size-4" />,
                  onClick: (row: ReportRow) => {
                    setSelected(row);
                    setOpen(true);
                  },
                },
              ],
            }
          : {})}
      />
      {detail && selected ? (
        <ReportDetail
          kind={detail}
          row={selected}
          scope={scope}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}

/** One cell: its value by declared kind, a quiet secondary line, and meaningful status badges. */
function ReportCell({ column, row }: { column: ReportColumn; row: ReportRow }) {
  const { copy, format } = useReportingLocalization();
  const value = row[column.key];

  if (column.kind === 'badge') {
    // The transaction status is Transaction History's own presentation, so both always agree.
    if (column.key === 'saleStatus') {
      const summary = transactionStatusSummary({
        status: String(value) as 'OPEN' | 'FINALIZED' | 'VOIDED',
        reversal: row.reversed === 'YES' ? { reason: '', reversedAt: '' } : null,
      });
      return <DBadge variant={summary.variant}>{copy(summary.label)}</DBadge>;
    }
    // A refund is its own fact, never shown as another successful charge.
    if (row.kind === 'REFUND')
      return (
        <DBadge variant={BADGE_VARIANTS.REFUND ?? 'info'}>
          {enumLabel('paymentKind', 'REFUND', copy)}
        </DBadge>
      );
    if (value === null || value === undefined || value === '') return <span>{EMPTY_VALUE}</span>;
    return (
      <DBadge variant={BADGE_VARIANTS[String(value)] ?? 'outline'}>
        {formatReportValue('badge', value, format, column.enum)}
      </DBadge>
    );
  }

  const text =
    column.kind === 'actor'
      ? formatActor(row, column.key, copy)
      : formatReportValue(column.kind, value, format, column.enum);
  const secondary =
    column.secondaryKey && column.secondaryKind === 'actor'
      ? isBlank(row[column.secondaryKey]) && isBlank(row[`${column.secondaryKey}Presence`])
        ? null
        : formatActor(row, column.secondaryKey, copy)
      : column.secondaryKey
        ? row[column.secondaryKey]
        : null;
  const isNumeric = ['money', 'signedMoney', 'count', 'quantity'].includes(column.kind);
  const emphasis = column.key === 'saleNumber' ? 'font-mono text-xs font-semibold' : '';

  return (
    <div className={`min-w-0 ${isNumeric ? 'whitespace-nowrap tabular-nums' : ''}`}>
      <p
        className={`break-words ${emphasis} ${text === EMPTY_VALUE ? 'text-[var(--color-text-muted)]' : ''}`}
      >
        {text}
      </p>
      {secondary !== null && secondary !== undefined && secondary !== '' ? (
        <p
          className={`mt-0.5 break-words text-xs text-[var(--color-text-muted)] ${
            column.secondaryKey === 'invoiceNumber' ? 'font-mono' : ''
          }`}
        >
          {column.secondaryLabel ? `${copy(column.secondaryLabel)}: ` : ''}
          {column.secondaryKind === 'actor'
            ? String(secondary)
            : formatReportValue(column.secondaryKind ?? 'text', secondary, format)}
        </p>
      ) : null}
    </div>
  );
}
