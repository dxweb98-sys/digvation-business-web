import { DButton, DDialog } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarClock, Coins, Hash, Landmark, Pencil, UserRound } from 'lucide-react';
import { useState } from 'react';

import { RecordInfoTile, RecordPanel, RecordSectionLabel } from '../../../shared/ui/record-dialog';
import type {
  FinancialAccount,
  FinancialAccountsApi,
  FinancialAccountStatementMovement,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  accountDestinationSummary,
  destinationFieldCopy,
} from '../model/financial-account-model';
import { CodeChip, FinancialDialogTitle, RecordStatusBadge } from './financial-accounts-shared';

export function FinancialAccountDetailDialog({
  account,
  api,
  canUpdate,
  onClose,
  onEdit,
}: {
  account: FinancialAccount | null;
  api: Pick<FinancialAccountsApi, 'getStatement'>;
  canUpdate: boolean;
  onClose: () => void;
  onEdit: (account: FinancialAccount) => void;
}) {
  const { copy, formatDate } = useFinancialAccountsLocalization();
  const [movementOffset, setMovementOffset] = useState(0);
  const movementPageSize = 25;
  const statement = useQuery({
    queryKey: ['financial-account-statement', account?.id, movementOffset],
    queryFn: () =>
      api.getStatement(account!.id, { limit: movementPageSize, offset: movementOffset }),
    enabled: Boolean(account),
  });
  if (!account) return null;
  const destination = destinationFieldCopy(account.type);
  const typeLabel = copy(ACCOUNT_TYPE_LABELS[account.type]);
  const iconClass = 'size-3.5';

  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={<FinancialDialogTitle title={copy('Financial account details')} />}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
          {canUpdate ? (
            <DButton leftIcon={<Pencil className="size-4" />} onClick={() => onEdit(account)}>
              {copy('Edit account')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <RecordPanel>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
              {account.name}
            </h2>
            <RecordStatusBadge status={account.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
            <CodeChip code={account.code} />
            <span aria-hidden="true">•</span>
            <span className="font-medium text-[var(--color-brand)]">{typeLabel}</span>
            <span aria-hidden="true">•</span>
            <span>{account.currency}</span>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            {accountDestinationSummary(account) ?? copy('On-site cash')}
          </p>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Account information')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={copy('Account code')}
              icon={<Hash className={iconClass} aria-hidden="true" />}
              value={account.code}
              mono
            />
            <RecordInfoTile
              label={copy('Account type')}
              icon={<Landmark className={iconClass} aria-hidden="true" />}
              value={typeLabel}
            />
            <RecordInfoTile
              label={copy('Currency')}
              icon={<Coins className={iconClass} aria-hidden="true" />}
              value={account.currency}
            />
            <RecordInfoTile
              label={copy('Updated')}
              icon={<CalendarClock className={iconClass} aria-hidden="true" />}
              value={formatDate(new Date(account.updatedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          </div>
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>
            {copy(destination ? destination.section : 'Destination details')}
          </RecordSectionLabel>
          {destination ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <RecordInfoTile
                label={copy(destination.institution)}
                icon={<Building2 className={iconClass} aria-hidden="true" />}
                value={account.institutionName}
              />
              <RecordInfoTile
                label={copy(destination.reference)}
                icon={<Hash className={iconClass} aria-hidden="true" />}
                value={account.accountReference}
                mono
              />
              <RecordInfoTile
                label={copy(destination.holder)}
                icon={<UserRound className={iconClass} aria-hidden="true" />}
                value={account.accountHolderName}
                className="sm:col-span-2"
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              {copy('Cash is held on site. No bank or provider details are needed.')}
            </p>
          )}
        </RecordPanel>

        <RecordPanel>
          <RecordSectionLabel>{copy('Mutasi')}</RecordSectionLabel>
          {statement.isLoading ? (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              {copy('Loading movements...')}
            </p>
          ) : statement.isError ? (
            <p className="mt-3 text-sm text-[var(--color-danger)]">
              {copy('Could not load account movements.')}
            </p>
          ) : statement.data ? (
            <>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {copy(
                  'Recorded net movement is shown because no opening balance has been recorded.',
                )}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <RecordInfoTile
                  label={copy('Money in')}
                  value={formatMoney(statement.data.totalIncoming, account.currency)}
                />
                <RecordInfoTile
                  label={copy('Money out')}
                  value={formatMoney(statement.data.totalOutgoing, account.currency)}
                />
                <RecordInfoTile
                  label={copy('Recorded net movement')}
                  value={formatMoney(statement.data.closingRecordedNetMovement, account.currency)}
                />
              </div>
              {statement.data.items.length ? (
                <>
                  <div className="mt-4 max-w-full overflow-x-auto">
                    <table className="min-w-[42rem] w-full text-left text-sm">
                      <thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                        <tr>
                          <th className="px-2 py-2 font-medium">{copy('Date & time')}</th>
                          <th className="px-2 py-2 font-medium">{copy('Activity')}</th>
                          <th className="px-2 py-2 font-medium">{copy('Reference')}</th>
                          <th className="px-2 py-2 text-right font-medium">{copy('Money in')}</th>
                          <th className="px-2 py-2 text-right font-medium">{copy('Money out')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.data.items.map((movement) => (
                          <MovementRow
                            key={movement.id}
                            movement={movement}
                            currency={account.currency}
                            formatDate={formatDate}
                            copy={copy}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {statement.data.total > movementPageSize ? (
                    <div className="mt-3 flex justify-end gap-2">
                      <DButton
                        variant="secondary"
                        disabled={movementOffset === 0}
                        onClick={() =>
                          setMovementOffset((offset) => Math.max(0, offset - movementPageSize))
                        }
                      >
                        {copy('Previous')}
                      </DButton>
                      <DButton
                        variant="secondary"
                        disabled={movementOffset + movementPageSize >= statement.data.total}
                        onClick={() => setMovementOffset((offset) => offset + movementPageSize)}
                      >
                        {copy('Next')}
                      </DButton>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-muted)]">
                  {copy('No recorded movements for this account.')}
                </p>
              )}
            </>
          ) : null}
        </RecordPanel>
      </div>
    </DDialog>
  );
}

function MovementRow({
  movement,
  currency,
  formatDate,
  copy,
}: {
  movement: FinancialAccountStatementMovement;
  currency: string;
  formatDate: (date: Date, options: Intl.DateTimeFormatOptions) => string;
  copy: (value: string) => string;
}) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-2 py-3 whitespace-nowrap">
        {formatDate(new Date(movement.occurredAt), { dateStyle: 'medium', timeStyle: 'short' })}
      </td>
      <td className="px-2 py-3">
        <span>{copy(MOVEMENT_SOURCE_LABELS[movement.source])}</span>
        {movement.nature === 'REATTRIBUTION' ? (
          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
            {copy('Reattribution')}
          </span>
        ) : null}
      </td>
      <td className="px-2 py-3 font-mono text-xs">{movement.sourceId}</td>
      <td className="px-2 py-3 text-right tabular-nums">
        {movement.direction === 'IN' ? formatMoney(movement.amount, currency) : '—'}
      </td>
      <td className="px-2 py-3 text-right tabular-nums">
        {movement.direction === 'OUT' ? formatMoney(movement.amount, currency) : '—'}
      </td>
    </tr>
  );
}

const MOVEMENT_SOURCE_LABELS: Record<FinancialAccountStatementMovement['source'], string> = {
  PAYMENT: 'Payment received',
  REFUND: 'Refund',
  EXPENSE: 'Expense',
  CASH_MOVEMENT: 'Cash movement',
  PAYMENT_CORRECTION: 'Payment correction',
};

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
