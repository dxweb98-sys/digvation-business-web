import { DButton, DDialog, DSkeleton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CircleDot, Coins, Hash, Pencil, Phone, UserRound } from 'lucide-react';

import type { Member, MembersApi } from './members-api';
import { membershipCopy } from './membership-copy';
import {
  MemberDialogTitle,
  MemberInfoTile,
  MemberNumberBadge,
  MemberPanel,
  MemberSectionLabel,
  MemberStatusBadge,
} from './membership-surfaces';
import { toNationalMemberPhone } from './member-phone';

export const memberQueryKeys = {
  all: ['memberships'] as const,
  detail: (id: string) => ['memberships', 'detail', id] as const,
  balance: (id: string) => ['memberships', 'balance', id] as const,
  history: (id: string) => ['memberships', 'history', id] as const,
};

/**
 * Read-only Member detail. Loyalty balance and history are read only with Loyalty permission and
 * are shown exactly as Runtime returns them.
 */
export function MemberDetailDialog({
  memberId,
  api,
  canViewLoyalty,
  canEdit,
  formatDate,
  onEdit,
  onClose,
}: {
  memberId: string;
  api: Pick<MembersApi, 'get' | 'balance' | 'history'>;
  canViewLoyalty: boolean;
  canEdit: boolean;
  formatDate: (value: string) => string;
  onEdit: (member: Member) => void;
  onClose: () => void;
}) {
  const copy = membershipCopy();
  const detail = useQuery({
    queryKey: memberQueryKeys.detail(memberId),
    queryFn: () => api.get(memberId),
  });
  const balance = useQuery({
    queryKey: memberQueryKeys.balance(memberId),
    queryFn: () => api.balance(memberId),
    enabled: canViewLoyalty,
  });
  const history = useQuery({
    queryKey: memberQueryKeys.history(memberId),
    queryFn: () => api.history(memberId),
    enabled: canViewLoyalty,
  });
  const member = detail.data;

  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={
        <MemberDialogTitle
          title={copy.detailTitle}
          badges={
            member ? (
              <>
                <MemberNumberBadge memberNumber={member.memberNumber} />
                <MemberStatusBadge status={member.status} />
              </>
            ) : null
          }
        />
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy.close}
          </DButton>
          {canEdit && member ? (
            <DButton leftIcon={<Pencil className="size-4" />} onClick={() => onEdit(member)}>
              {copy.editCustomer}
            </DButton>
          ) : null}
        </div>
      }
    >
      {member ? (
        <div className="space-y-4">
          <MemberPanel className="p-5">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <UserRound className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
                  {member.customer.name}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text)]">
                    {member.memberNumber}
                  </span>
                  <span>•</span>
                  <span>{toNationalMemberPhone(member.customer.phoneE164)}</span>
                </div>
              </div>
            </div>
          </MemberPanel>

          <MemberPanel className="p-5" ariaLabel={copy.membership}>
            <MemberSectionLabel>{copy.membership}</MemberSectionLabel>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MemberInfoTile
                label={copy.memberNumber}
                icon={<Hash className="size-3.5" aria-hidden="true" />}
                value={<span className="font-mono">{member.memberNumber}</span>}
              />
              <MemberInfoTile
                label={copy.phone}
                icon={<Phone className="size-3.5" aria-hidden="true" />}
                value={toNationalMemberPhone(member.customer.phoneE164)}
              />
              <MemberInfoTile
                label={copy.status}
                icon={<CircleDot className="size-3.5" aria-hidden="true" />}
                value={<MemberStatusBadge status={member.status} />}
              />
              <MemberInfoTile
                label={copy.joinedAt}
                icon={<CalendarDays className="size-3.5" aria-hidden="true" />}
                value={formatDate(member.joinedAt)}
              />
            </div>
          </MemberPanel>

          {canViewLoyalty ? (
            <MemberPanel ariaLabel={copy.loyalty}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-[var(--color-brand)]" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">{copy.loyalty}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                    {copy.pointBalance}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {balance.data ? balance.data.pointsBalance : '—'}
                  </p>
                </div>
              </div>
              <div className="px-5 py-4">
                <MemberSectionLabel>{copy.pointHistory}</MemberSectionLabel>
                {history.data?.length ? (
                  <ul className="mt-3 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
                    {history.data.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-text)]">{entry.type}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {formatDate(entry.createdAt)}
                          </p>
                        </div>
                        <div className="text-right tabular-nums">
                          <p className="font-semibold text-[var(--color-text)]">
                            {entry.pointsDelta.startsWith('-')
                              ? entry.pointsDelta
                              : `+${entry.pointsDelta}`}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {copy.balanceAfter} {entry.balanceAfter}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm italic text-[var(--color-text-muted)]">
                    {history.isLoading ? copy.loadingDetail : copy.noPointHistory}
                  </p>
                )}
              </div>
            </MemberPanel>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3" aria-label={copy.loadingDetail}>
          <DSkeleton className="h-20 w-full" />
          <DSkeleton className="h-32 w-full" />
        </div>
      )}
    </DDialog>
  );
}
