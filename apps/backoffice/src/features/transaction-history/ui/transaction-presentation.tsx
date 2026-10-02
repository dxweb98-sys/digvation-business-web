import { DBadge } from '@digvation/ui';
import type { ReactNode } from 'react';

import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import type { EmployeeName } from '../model/transaction-lines';
import type { TransactionSummary } from '../model/transaction-summary';

/** One business-facing state as a single badge. */
export function SummaryBadge({ summary }: { summary: TransactionSummary<string> }) {
  const { copy } = useTransactionHistoryLocalization();
  return <DBadge variant={summary.variant}>{copy(summary.label)}</DBadge>;
}

/** Readable employee names; an unresolvable reference reads as unknown, never as an id. */
export function EmployeeNames({ names }: { names: readonly EmployeeName[] }) {
  const { copy } = useTransactionHistoryLocalization();
  if (!names.length)
    return <span className="text-[var(--color-text-muted)]">{copy('Not assigned')}</span>;
  return (
    <span className="break-words">
      {names.map((name) => name ?? copy('Unknown employee')).join(', ')}
    </span>
  );
}

/** A quiet `label: value` attribution line under an item. */
export function Attribution({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
      <span>{label}: </span>
      <span className="font-medium text-[var(--color-text)]">{children}</span>
    </p>
  );
}
