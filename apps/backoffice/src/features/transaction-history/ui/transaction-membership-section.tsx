import { DInfoNote } from '@digvation/ui';

import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
} from '../../../shared/ui/record-dialog';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import type { MembershipPresentation } from '../model/transaction-loyalty';

/** Member and point facts of the transaction; rendered only for a member Sale. */
export function TransactionMembershipSection({
  membership,
  currency,
}: {
  membership: MembershipPresentation;
  currency: string;
}) {
  const { copy, formatMoney, formatQuantity } = useTransactionHistoryLocalization();
  const points = (value: string) => `${formatQuantity(value)} ${copy('points')}`;
  const { earned } = membership;

  return (
    <RecordPanel ariaLabel={copy('Membership & points')} padded={false}>
      <RecordPanelHeader title={copy('Membership & points')} />
      <RecordPanelBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <RecordInfoTile
            label={copy('Member')}
            value={membership.memberName}
            className="sm:col-span-2"
          />
          <RecordInfoTile
            label={copy('Points used')}
            value={
              membership.redeemed ? (
                points(membership.redeemed.points)
              ) : (
                <span className="font-medium text-[var(--color-text-muted)]">
                  {copy('Not used')}
                </span>
              )
            }
          />
          {membership.redeemed ? (
            <RecordInfoTile
              label={copy('Redemption value')}
              value={
                <span className="text-[var(--color-danger)]">
                  −{formatMoney(membership.redeemed.amount, currency)}
                </span>
              }
            />
          ) : null}
          <RecordInfoTile
            label={copy(earned.kind === 'ESTIMATED' ? 'Estimated points' : 'Points earned')}
            value={
              earned.kind === 'NONE' ? (
                <span className="font-medium text-[var(--color-text-muted)]">
                  {copy('No points earned')}
                </span>
              ) : (
                points(earned.points)
              )
            }
          />
          {membership.balanceAfter ? (
            <RecordInfoTile
              label={copy('Balance after transaction')}
              value={points(membership.balanceAfter)}
            />
          ) : null}
        </div>
        {earned.kind === 'ESTIMATED' ? (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            {copy('Final points are recorded when the transaction is completed.')}
          </p>
        ) : null}
        {membership.reversed ? (
          <DInfoNote variant="warning" className="mt-3">
            {copy(
              'This transaction was reversed; the points it earned and used have been compensated.',
            )}
          </DInfoNote>
        ) : null}
      </RecordPanelBody>
    </RecordPanel>
  );
}
