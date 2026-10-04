import { DButton, DDialog } from '@digvation/ui';
import {
  CalendarClock,
  CalendarDays,
  FileText,
  MapPin,
  MessageSquareText,
  Send,
  Tag,
  UserRound,
  Wallet,
} from 'lucide-react';

import {
  RecordDialogTitle,
  RecordInfoTile,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { Expense } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';
import {
  actorDisplayName,
  expenseCategoryLabel,
  expenseDescription,
  expenseOriginLabel,
} from '../model/expense-model';
import { ExpenseSourceAccount, ExpenseStatusBadge } from './expense-presentation';

const iconClass = 'size-3.5';

export function ExpenseDetailDialog({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  const { copy, labels, formatDate, formatMoney } = useExpensesLocalization();
  if (!expense) return null;
  const categoryLabel = expenseCategoryLabel(expense.categoryCode, labels);
  const notSet = copy('Not set');
  const decisionTime = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={<RecordDialogTitle title={copy('Expense details')} />}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
                {categoryLabel}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {expense.sellingLocationName} ·{' '}
                {formatDate(new Date(expense.occurredAt), { dateStyle: 'medium' })}
              </p>
            </div>
            <ExpenseStatusBadge status={expense.status} />
          </div>
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <RecordSectionLabel>{copy('Amount')}</RecordSectionLabel>
            <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
              {formatMoney(expense.amount, expense.currency)}
            </p>
          </div>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Expense information')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={copy('Description')}
              icon={<FileText className={iconClass} aria-hidden="true" />}
              value={expenseDescription(expense.note)}
              className="sm:col-span-2"
            />
            <RecordInfoTile
              label={copy('Source financial account')}
              icon={<Wallet className={iconClass} aria-hidden="true" />}
              value={<ExpenseSourceAccount expense={expense} />}
            />
            <RecordInfoTile
              label={copy('Category')}
              icon={<Tag className={iconClass} aria-hidden="true" />}
              value={categoryLabel}
            />
            <RecordInfoTile
              label={copy('Location')}
              icon={<MapPin className={iconClass} aria-hidden="true" />}
              value={expense.sellingLocationName}
            />
            <RecordInfoTile
              label={copy('Date')}
              icon={<CalendarDays className={iconClass} aria-hidden="true" />}
              value={formatDate(new Date(expense.occurredAt), { dateStyle: 'medium' })}
            />
          </div>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Request information')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={copy('Origin')}
              icon={<Send className={iconClass} aria-hidden="true" />}
              value={expenseOriginLabel(expense.origin, labels)}
            />
            <RecordInfoTile
              label={copy('Requested by')}
              icon={<UserRound className={iconClass} aria-hidden="true" />}
              value={actorDisplayName(expense.createdBy, notSet)}
            />
          </div>
        </RecordPanel>

        {expense.approvedAt || expense.rejectedAt ? (
          <RecordPanel>
            <RecordSectionLabel>{copy('Decision and audit')}</RecordSectionLabel>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {expense.approvedAt ? (
                <>
                  <RecordInfoTile
                    label={copy('Approved by')}
                    icon={<UserRound className={iconClass} aria-hidden="true" />}
                    value={actorDisplayName(expense.approvedBy, notSet)}
                  />
                  <RecordInfoTile
                    label={copy('Decision time')}
                    icon={<CalendarClock className={iconClass} aria-hidden="true" />}
                    value={decisionTime(expense.approvedAt)}
                  />
                </>
              ) : null}
              {expense.rejectedAt ? (
                <>
                  <RecordInfoTile
                    label={copy('Rejected by')}
                    icon={<UserRound className={iconClass} aria-hidden="true" />}
                    value={actorDisplayName(expense.rejectedBy, notSet)}
                  />
                  <RecordInfoTile
                    label={copy('Decision time')}
                    icon={<CalendarClock className={iconClass} aria-hidden="true" />}
                    value={decisionTime(expense.rejectedAt)}
                  />
                  <RecordInfoTile
                    label={copy('Decision note')}
                    icon={<MessageSquareText className={iconClass} aria-hidden="true" />}
                    value={expense.rejectionNote?.trim()}
                    className="sm:col-span-2"
                  />
                </>
              ) : null}
            </div>
          </RecordPanel>
        ) : null}
      </div>
    </DDialog>
  );
}
