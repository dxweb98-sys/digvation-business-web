import { DButton, DDialog } from '@digvation/ui';
import { Building2, CalendarClock, Coins, Hash, Landmark, Pencil, UserRound } from 'lucide-react';

import type { FinancialAccount } from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  accountDestinationSummary,
  destinationFieldCopy,
} from '../model/financial-account-model';
import {
  CodeChip,
  FinancialDialogTitle,
  FinancialPanel,
  InfoTile,
  RecordStatusBadge,
  SectionLabel,
} from './financial-accounts-shared';

export function FinancialAccountDetailDialog({
  account,
  canUpdate,
  onClose,
  onEdit,
}: {
  account: FinancialAccount | null;
  canUpdate: boolean;
  onClose: () => void;
  onEdit: (account: FinancialAccount) => void;
}) {
  const { copy, formatDate } = useFinancialAccountsLocalization();
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
        <FinancialPanel>
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
        </FinancialPanel>

        <FinancialPanel>
          <SectionLabel>{copy('Account information')}</SectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile
              label={copy('Account code')}
              icon={<Hash className={iconClass} aria-hidden="true" />}
              value={account.code}
              mono
            />
            <InfoTile
              label={copy('Account type')}
              icon={<Landmark className={iconClass} aria-hidden="true" />}
              value={typeLabel}
            />
            <InfoTile
              label={copy('Currency')}
              icon={<Coins className={iconClass} aria-hidden="true" />}
              value={account.currency}
            />
            <InfoTile
              label={copy('Updated')}
              icon={<CalendarClock className={iconClass} aria-hidden="true" />}
              value={formatDate(new Date(account.updatedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          </div>
        </FinancialPanel>

        <FinancialPanel>
          <SectionLabel>
            {copy(destination ? destination.section : 'Destination details')}
          </SectionLabel>
          {destination ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoTile
                label={copy(destination.institution)}
                icon={<Building2 className={iconClass} aria-hidden="true" />}
                value={account.institutionName}
              />
              <InfoTile
                label={copy(destination.reference)}
                icon={<Hash className={iconClass} aria-hidden="true" />}
                value={account.accountReference}
                mono
              />
              <InfoTile
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
        </FinancialPanel>
      </div>
    </DDialog>
  );
}
