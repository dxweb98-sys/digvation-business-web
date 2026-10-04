import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DAlert,
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDialog,
  DInput,
  DSkeleton,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { isApiErrorCode } from '../../features/sell/cashier-transaction-errors';
import {
  sanitizeNationalPhoneInput,
  toCanonicalPhone,
  toLocalPhoneDisplay,
} from '../../features/sell/customer-input';
import { historyQueryPolicy } from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { canEditOperationalMemberProfile } from './operational-members-access';
import {
  MEMBER_PAGE_SIZE,
  OperationalMembersApi,
  type Member,
  type MemberDetail,
  type MemberTransaction,
  type PointLedgerEntry,
  type PointLedgerType,
} from './operational-members-api';

const membersKey = ['operational-members'] as const;
const memberKey = ['operational-member'] as const;

const ledgerLabel: Record<PointLedgerType, string> = {
  EARN: 'Points earned',
  REDEEM: 'Points used',
  EARN_REVERSAL: 'Earned points reversed',
  REDEEM_REVERSAL: 'Used points restored',
  OPENING_BALANCE: 'Migrated opening balance',
};

/** Container: wires the authenticated Operational client and the permission-derived edit right. */
export function OperationalMembersPage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const api = useMemo(
    () =>
      new OperationalMembersApi(
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
  const canEdit = canEditOperationalMemberProfile(
    session.access.permissions,
    session.access.capabilities,
  );
  const cacheScope = JSON.stringify([
    session.business.tenantId,
    session.identity.userId,
    session.contextVersion,
    session.access.capabilities,
  ]);
  return (
    <OperationalMembersView key={cacheScope} cacheScope={cacheScope} api={api} canEdit={canEdit} />
  );
}

export function OperationalMembersView({
  api,
  canEdit,
  cacheScope = 'test',
}: {
  api: OperationalMembersApi;
  canEdit: boolean;
  cacheScope?: string;
}) {
  const { copy, label } = useOperationalLocalization();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // One list request per pause in typing, never one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const list = useQuery({
    queryKey: [...membersKey, cacheScope, q, offset],
    queryFn: ({ signal }) => api.list({ q, offset }, signal),
    placeholderData: (previous, query) =>
      query?.queryKey[1] === cacheScope ? previous : undefined,
    ...historyQueryPolicy,
  });

  const columns: TableColumn<Member>[] = [
    {
      key: 'member',
      label: copy('Members'),
      render: (member) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-(--color-text)">{member.customer.name}</p>
          <p className="truncate text-xs text-(--color-text-muted)">{member.customer.phoneE164}</p>
        </div>
      ),
    },
    {
      key: 'number',
      label: copy('Member number'),
      render: (member) => <span className="font-mono text-xs">{member.memberNumber}</span>,
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (member) => (
        <DBadge variant={member.status === 'ACTIVE' ? 'success' : 'outline'}>
          {label(member.status)}
        </DBadge>
      ),
    },
  ];

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Customers')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Members')}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {copy('Browse members, check their points and update profile details.')}
        </p>
      </header>

      <section className="mt-6">
        {list.isError && !list.data ? (
          <DConnectionError
            title={copy('Could not load members.')}
            message={copy('Try loading members again.')}
            onRetry={() => void list.refetch()}
          />
        ) : (
          <DDataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search member name, number, or phone')}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            onRowClick={(member) => setSelectedId(member.id)}
            pagination={{
              page: Math.floor(offset / MEMBER_PAGE_SIZE) + 1,
              pageSize: MEMBER_PAGE_SIZE,
              total: list.data?.total ?? 0,
            }}
            onPageChange={(page) => setOffset((page - 1) * MEMBER_PAGE_SIZE)}
            emptyMessage={copy(q ? 'No members match your search.' : 'No members yet.')}
          />
        )}
      </section>

      {selectedId ? (
        <MemberDetailDialog
          key={selectedId}
          api={api}
          membershipId={selectedId}
          cacheScope={cacheScope}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

function formatPointValue(value: string, locale: string, signed = false): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
    ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
  }).format(number);
}

export function MemberDetailDialog({
  api,
  membershipId,
  canEdit,
  onClose,
  cacheScope = 'test',
}: {
  api: OperationalMembersApi;
  membershipId: string;
  canEdit: boolean;
  onClose: () => void;
  cacheScope?: string;
}) {
  const { copy } = useOperationalLocalization();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isEditing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: [...memberKey, cacheScope, membershipId],
    queryFn: ({ signal }) => api.detail(membershipId, signal),
    ...historyQueryPolicy,
  });
  const member = detail.data?.membership;

  const updateProfile = useMutation({
    mutationFn: () => api.updateProfile(member!, { name, phone: toCanonicalPhone(phone) ?? phone }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: membersKey }),
        queryClient.invalidateQueries({ queryKey: memberKey }),
        queryClient.invalidateQueries({ queryKey: ['operational-customers'] }),
      ]);
      setEditing(false);
      setFormError(null);
      showToast({ variant: 'success', title: copy('Member profile updated.') });
    },
    onError: (error) =>
      setFormError(
        isApiErrorCode(error, 'MEMBERSHIP_PHONE_ALREADY_IN_USE')
          ? copy('This phone number is already registered as a member.')
          : copy(
              'Could not update the member profile. Check the name and phone number and try again.',
            ),
      ),
  });

  const startEditing = () => {
    if (!member) return;
    setName(member.customer.name);
    setPhone(toLocalPhoneDisplay(member.customer.phoneE164));
    setFormError(null);
    setEditing(true);
  };

  const canSave = Boolean(name.trim() && phone.trim()) && !updateProfile.isPending;

  return (
    <DDialog
      open
      onClose={onClose}
      title={isEditing ? copy('Edit profile') : copy('Member detail')}
      ariaLabel={isEditing ? copy('Edit profile') : copy('Member detail')}
      className={isEditing ? 'w-full max-w-md' : 'w-full max-w-lg'}
      footer={
        member ? (
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <DButton
                  variant="secondary"
                  disabled={updateProfile.isPending}
                  onClick={() => setEditing(false)}
                >
                  {copy('Cancel')}
                </DButton>
                <DButton
                  loading={updateProfile.isPending}
                  disabled={!canSave}
                  onClick={() => updateProfile.mutate()}
                >
                  {copy('Save')}
                </DButton>
              </>
            ) : (
              <>
                <DButton variant="secondary" onClick={onClose}>
                  {copy('Close')}
                </DButton>
                {canEdit ? (
                  <DButton leftIcon={<Pencil className="size-4" />} onClick={startEditing}>
                    {copy('Edit profile')}
                  </DButton>
                ) : null}
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {detail.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <DSkeleton height={24} count={1} />
          <DSkeleton height={72} count={1} />
          <DSkeleton height={120} count={1} />
        </div>
      ) : detail.isError || !detail.data || !member ? (
        <DConnectionError
          title={copy('Could not load member detail.')}
          message={copy('Try loading the member again.')}
          onRetry={() => void detail.refetch()}
        />
      ) : isEditing ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <DInput
              label={copy('Name')}
              value={name}
              onChange={setName}
              autoComplete="off"
              disabled={updateProfile.isPending}
            />
            <DInput
              label={copy('Phone number')}
              value={phone}
              onChange={(value) => setPhone(sanitizeNationalPhoneInput(value))}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              disabled={updateProfile.isPending}
            />
          </div>
          {formError ? <DAlert variant="danger">{formError}</DAlert> : null}
        </div>
      ) : (
        <MemberDetailBody detail={detail.data} />
      )}
    </DDialog>
  );
}

function MemberDetailBody({ detail }: { detail: MemberDetail }) {
  const { copy, label, locale, formatDate, formatMoney } = useOperationalLocalization();
  const { membership, loyalty, recentTransactions, transactionTotal } = detail;
  const [tab, setTab] = useState<'activity' | 'transactions'>(
    loyalty ? 'activity' : 'transactions',
  );
  const dateTime = (iso: string) =>
    formatDate(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    // A bounded, viewport-aware column with a stable height so switching tabs never moves the
    // summary, tabs or footer: the summary and tabs never scroll, only the active tab panel does.
    // The subtracted rem values leave room for the DDialog header and footer.
    <div className="flex h-[min(calc(90dvh-11.5rem),34rem)] min-h-0 flex-col gap-3 sm:h-[min(calc(85dvh-11rem),34rem)] sm:gap-4">
      <section aria-label={copy('Members')} className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-(--color-text)">
              {membership.customer.name}
            </p>
            <p className="text-sm text-(--color-text-muted)">{membership.customer.phoneE164}</p>
          </div>
          <DBadge variant={membership.status === 'ACTIVE' ? 'success' : 'outline'}>
            {label(membership.status)}
          </DBadge>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:mt-3">
          <div>
            <dt className="text-xs text-(--color-text-muted)">{copy('Member number')}</dt>
            <dd className="mt-0.5 font-mono font-semibold">{membership.memberNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-(--color-text-muted)">{copy('Member since')}</dt>
            <dd className="mt-0.5 font-semibold">
              {formatDate(new Date(membership.joinedAt), { dateStyle: 'medium' })}
            </dd>
          </div>
        </dl>
      </section>

      {loyalty ? (
        <section
          aria-label={copy('Loyalty points')}
          className="shrink-0 rounded-2xl border border-(--color-brand)/20 bg-(--color-brand)/5 px-4 py-2 sm:py-3"
        >
          <p className="text-xs text-(--color-text-muted)">{copy('Current points')}</p>
          <p className="mt-0.5 text-2xl font-bold text-(--color-brand)">
            {formatPointValue(loyalty.pointsBalance, locale)}
          </p>
        </section>
      ) : null}

      <DTabs
        value={tab}
        defaultValue={tab}
        onValueChange={(value) => setTab(value as 'activity' | 'transactions')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <DTabsList
          className={`grid w-full shrink-0 ${loyalty ? 'grid-cols-2' : 'grid-cols-1'} rounded-xl bg-(--color-surface-muted) p-1`}
        >
          {loyalty ? (
            <DTabsTrigger value="activity" className="min-w-0 px-2">
              <span className="truncate">{copy('Point activity')}</span>
            </DTabsTrigger>
          ) : null}
          <DTabsTrigger value="transactions" className="min-w-0 px-2">
            <span className="truncate">{copy('Transactions')}</span>
          </DTabsTrigger>
        </DTabsList>

        {loyalty ? (
          <DTabsContent value="activity" className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {loyalty.recentActivity.length ? (
              <ul className="divide-y divide-(--color-border)">
                {loyalty.recentActivity.map((entry) => (
                  <LedgerRow key={entry.id} entry={entry} locale={locale} dateTime={dateTime} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-(--color-text-muted)">{copy('No point activity yet.')}</p>
            )}
          </DTabsContent>
        ) : null}

        <DTabsContent value="transactions" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {recentTransactions.length ? (
            <>
              <ul className="space-y-2">
                {recentTransactions.map((transaction) => (
                  <MemberTransactionCard
                    key={transaction.saleId}
                    transaction={transaction}
                    showPoints={Boolean(loyalty)}
                    locale={locale}
                    dateTime={dateTime}
                    formatMoney={formatMoney}
                  />
                ))}
              </ul>
              {transactionTotal > recentTransactions.length ? (
                <p className="mt-3 text-xs text-(--color-text-muted)">
                  {copy('Showing')} {recentTransactions.length} {copy('most recent transactions')}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-(--color-text-muted)">
              {copy('No completed transaction yet.')}
            </p>
          )}
        </DTabsContent>
      </DTabs>
    </div>
  );
}

export function MemberTransactionCard({
  transaction,
  showPoints,
  locale,
  dateTime,
  formatMoney,
}: {
  transaction: MemberTransaction;
  /** Points are Loyalty facts: shown only when Loyalty is part of the business. */
  showPoints: boolean;
  locale: string;
  dateTime: (iso: string) => string;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <li className="rounded-2xl border border-(--color-border) px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold">{transaction.saleNumber}</p>
          {transaction.finalizedAt ? (
            <p className="mt-0.5 text-xs text-(--color-text-muted)">
              {dateTime(transaction.finalizedAt)}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 font-bold">
          {formatMoney(transaction.totalAmount, transaction.currency)}
        </p>
      </div>
      {showPoints && (transaction.pointsEarned || transaction.pointsRedeemed) ? (
        <dl className="mt-2 space-y-1 text-xs">
          {transaction.pointsEarned ? (
            <div className="flex justify-between gap-3">
              <dt className="text-(--color-text-muted)">
                {copy('Points earned in this transaction')}
              </dt>
              <dd className="font-semibold text-(--color-success)">
                {formatPointValue(transaction.pointsEarned, locale, true)}
              </dd>
            </div>
          ) : null}
          {transaction.pointsRedeemed ? (
            <div className="flex justify-between gap-3">
              <dt className="text-(--color-text-muted)">
                {copy('Points used in this transaction')}
              </dt>
              <dd className="font-semibold text-(--color-danger)">
                {formatPointValue(`-${transaction.pointsRedeemed}`, locale, true)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

function LedgerRow({
  entry,
  locale,
  dateTime,
}: {
  entry: PointLedgerEntry;
  locale: string;
  dateTime: (iso: string) => string;
}) {
  const { copy } = useOperationalLocalization();
  const positive = Number(entry.pointsDelta) > 0;
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{copy(ledgerLabel[entry.type])}</p>
        <p className="text-xs text-(--color-text-muted)">{dateTime(entry.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-bold ${positive ? 'text-(--color-success)' : 'text-(--color-danger)'}`}
        >
          {formatPointValue(entry.pointsDelta, locale, true)}
        </p>
        <p className="text-xs text-(--color-text-muted)">
          {copy('Balance after')} {formatPointValue(entry.balanceAfter, locale)}
        </p>
      </div>
    </li>
  );
}
