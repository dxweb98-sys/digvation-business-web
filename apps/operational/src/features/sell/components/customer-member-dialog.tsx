import { DAlert, DButton, DDialog, DInput, DSearchInput, DSkeleton } from '@digvation-labs/ui';
import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Phone, User, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  memberSaleSelection,
  type CustomerLookupResult,
  type CustomerMemberApi,
  type MemberLookupResult,
} from '../customer-member-api';
import type { SaleCustomer, SaleCustomerSelection } from '../cashier-transaction.types';

type CustomerDialogMode = 'CUSTOMER' | 'MEMBER' | 'ENROLL';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function CustomerMemberDialog({
  open,
  customer,
  isSaving,
  api,
  canReadMembers,
  canReadCustomers,
  canEnrollMember,
  onClose,
  onChoose,
}: {
  open: boolean;
  customer: SaleCustomer | null;
  isSaving: boolean;
  api: CustomerMemberApi;
  canReadMembers: boolean;
  canReadCustomers: boolean;
  canEnrollMember: boolean;
  onClose: () => void;
  onChoose: (selection: SaleCustomerSelection, member?: MemberLookupResult) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [mode, setMode] = useState<CustomerDialogMode>('CUSTOMER');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nik, setNik] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<CustomerLookupResult | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, setEnrolling] = useState(false);

  const searchReady = query.trim().length >= 2;
  const memberQuery = useQuery({
    queryKey: ['operational-member-search', query],
    queryFn: ({ signal }) => api.searchMembers(query, signal),
    enabled: open && mode === 'MEMBER' && canReadMembers && searchReady,
  });
  const customerQuery = useQuery({
    queryKey: ['operational-customer-search', query],
    queryFn: ({ signal }) => api.searchCustomers(query, signal),
    enabled: open && mode === 'CUSTOMER' && canReadCustomers && searchReady,
  });

  const submitCustomer = () => {
    if (!name.trim() || !phone.trim() || isSaving) return;
    onChoose({ type: 'NON_MEMBER', name: name.trim(), phone: phone.trim() });
  };

  const openEnrollment = (target?: CustomerLookupResult) => {
    setEnrollTarget(target ?? null);
    setEnrollError(null);
    setNik('');
    if (target) {
      setName(target.name);
      setPhone(target.phoneE164);
    }
    setMode('ENROLL');
  };

  const enroll = async () => {
    if (!nik.trim() || isEnrolling) return;
    if (!enrollTarget && (!name.trim() || !phone.trim())) return;

    const submittedNik = nik;
    setNik('');
    setEnrollError(null);
    setEnrolling(true);
    try {
      const member = enrollTarget
        ? await api.enrollExisting({ customerId: enrollTarget.id, nik: submittedNik })
        : await api.enrollNew({ name: name.trim(), phone: phone.trim(), nik: submittedNik });
      onChoose(memberSaleSelection(member), member);
    } catch {
      setEnrollError(copy('Member enrollment could not be completed.'));
    } finally {
      setEnrolling(false);
    }
  };

  const results = mode === 'MEMBER' ? memberQuery : customerQuery;
  const resultCount = searchReady ? (results.data?.items.length ?? 0) : 0;
  const canCreateMember =
    Boolean(nik.trim()) &&
    Boolean(enrollTarget || (name.trim() && phone.trim())) &&
    !isEnrolling;

  return (
    <DDialog
      title={copy('Choose customer')}
      open={open}
      onClose={onClose}
      ariaLabel={copy('Choose customer')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-2xl"
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <Users className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold">{copy('Choose customer')}</h2>
              <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">
                {copy('Search a customer or member, or add a customer for this sale.')}
              </p>
            </div>
          </div>
        </div>

        <DTabs
          value={mode}
          defaultValue="CUSTOMER"
          onValueChange={(value) => {
            const next = value as CustomerDialogMode;
            setEnrollError(null);
            if (next !== 'ENROLL') setEnrollTarget(null);
            setMode(next);
          }}
        >
          <DTabsList
            className={`grid w-full ${
              canEnrollMember ? 'grid-cols-3' : 'grid-cols-2'
            } rounded-xl bg-[var(--color-surface-muted)] p-1`}
          >
            <DTabsTrigger value="CUSTOMER" className="min-w-0 gap-1.5 px-2">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{copy('Customer')}</span>
            </DTabsTrigger>
            <DTabsTrigger value="MEMBER" className="min-w-0 gap-1.5 px-2">
              <Users className="size-3.5 shrink-0" />
              <span className="truncate">{copy('Member')}</span>
            </DTabsTrigger>
            {canEnrollMember ? (
              <DTabsTrigger value="ENROLL" className="min-w-0 gap-1.5 px-2">
                <UserPlus className="size-3.5 shrink-0" />
                <span className="truncate">{copy('Enroll member')}</span>
              </DTabsTrigger>
            ) : null}
          </DTabsList>

          <DTabsContent value="CUSTOMER" className="mt-4 space-y-3">
            <DAlert variant="neutral">
              {copy(
                'Use a regular customer for this sale without creating Loyalty membership.',
              )}
            </DAlert>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold">{copy('Search customer')}</p>
              <DSearchInput
                aria-label={copy('Search customer')}
                value={query}
                onChange={setQuery}
                placeholder={copy('Name or phone')}
              />
            </div>

            {searchReady ? (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <div className="flex items-center justify-between bg-[var(--color-surface-muted)] px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {copy('Search results')} ({resultCount})
                  </span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {customerQuery.isLoading ? (
                    <div className="p-3">
                      <DSkeleton className="h-14 rounded-xl" />
                    </div>
                  ) : null}
                  {customerQuery.isError ? (
                    <div className="p-3">
                      <DAlert variant="danger">
                        {copy('Customer lookup could not be completed.')}
                      </DAlert>
                    </div>
                  ) : null}
                  {customerQuery.data?.items.map((found) => (
                    <div
                      key={found.id}
                      className="flex items-center gap-3 bg-[var(--color-surface)] p-3"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-muted)]">
                        {initials(found.name)}
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          onChoose({
                            type: 'NON_MEMBER',
                            name: found.name,
                            phone: found.phoneE164,
                          })
                        }
                      >
                        <span className="block truncate text-sm font-semibold">{found.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                          <Phone className="size-3" />
                          {found.phoneE164}
                        </span>
                      </button>
                      {canEnrollMember ? (
                        <DButton
                          size="sm"
                          variant="secondary"
                          onClick={() => openEnrollment(found)}
                        >
                          {copy('Enroll')}
                        </DButton>
                      ) : null}
                    </div>
                  ))}
                  {customerQuery.data && customerQuery.data.items.length === 0 ? (
                    <div className="p-3 text-xs text-[var(--color-text-muted)]">
                      {copy('No matching customers found.')}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Enter at least 2 characters to search.')}
              </p>
            )}

            {!canReadCustomers ? (
              <DAlert variant="neutral">
                {copy('You do not have permission to search customers.')}
              </DAlert>
            ) : null}

            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div>
                <p className="text-sm font-semibold">{copy('Use a new non-member customer')}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {copy('Name and WhatsApp number are used for this sale.')}
                </p>
              </div>
              <DInput label={copy('Name')} value={name} onChange={setName} />
              <DInput
                label={copy('WhatsApp number')}
                value={phone}
                onChange={setPhone}
                inputMode="tel"
              />
              <DButton
                fullWidth
                disabled={!name.trim() || !phone.trim() || isSaving}
                loading={isSaving}
                onClick={submitCustomer}
              >
                {copy('Use customer')}
              </DButton>
              {canEnrollMember ? (
                <button
                  type="button"
                  onClick={() => openEnrollment()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
                >
                  <UserPlus className="size-3.5" />
                  {copy('Enroll this customer as a member instead')}
                </button>
              ) : null}
            </div>
          </DTabsContent>

          <DTabsContent value="MEMBER" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">{copy('Search registered member')}</p>
              <DSearchInput
                aria-label={copy('Search member')}
                value={query}
                onChange={setQuery}
                placeholder={copy('Name, phone, or member number')}
              />
            </div>

            {!canReadMembers ? (
              <DAlert variant="neutral">
                {copy('You do not have permission to search members.')}
              </DAlert>
            ) : !searchReady ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Enter at least 2 characters to search.')}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                <div className="flex items-center justify-between bg-[var(--color-surface-muted)] px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {copy('Search results')} ({resultCount})
                  </span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {memberQuery.isLoading ? (
                    <div className="p-3">
                      <DSkeleton className="h-14 rounded-xl" />
                    </div>
                  ) : null}
                  {memberQuery.isError ? (
                    <div className="p-3">
                      <DAlert variant="danger">
                        {copy('Customer lookup could not be completed.')}
                      </DAlert>
                    </div>
                  ) : null}
                  {memberQuery.data?.items.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center gap-3 bg-[var(--color-surface)] p-3 text-left transition-colors hover:bg-[var(--color-brand)]/5"
                      onClick={() => onChoose(memberSaleSelection(member), member)}
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-xs font-semibold text-[var(--color-brand)]">
                        {initials(member.customer.name)}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {member.customer.name}
                          </span>
                          <span className="shrink-0 rounded-md bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                            {member.memberNumber}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                          <Phone className="size-3" />
                          {member.customer.phoneE164}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-[var(--color-brand)]">
                        {copy(member.status === 'ACTIVE' ? 'Active' : 'Inactive')}
                      </span>
                    </button>
                  ))}
                  {memberQuery.data && memberQuery.data.items.length === 0 ? (
                    <div className="space-y-2 p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {copy('No matching customers found.')}
                      </p>
                      {canEnrollMember ? (
                        <DButton
                          size="sm"
                          variant="secondary"
                          leftIcon={<UserPlus className="size-3.5" />}
                          onClick={() => openEnrollment()}
                        >
                          {copy('Enroll member')}
                        </DButton>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </DTabsContent>

          {canEnrollMember ? (
            <DTabsContent value="ENROLL" className="mt-4 space-y-3">
              <DAlert variant="neutral">
                {copy(
                  'Member enrollment activates Loyalty membership for the selected customer when available.',
                )}
              </DAlert>

              {enrollTarget ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 p-3">
                  <p className="text-xs font-semibold">{copy('Existing customer')}</p>
                  <p className="mt-1 text-sm font-semibold">{enrollTarget.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {enrollTarget.phoneE164}
                  </p>
                </div>
              ) : null}

              <DInput
                label={copy('Name')}
                value={name}
                onChange={setName}
                disabled={Boolean(enrollTarget)}
              />
              <DInput
                label={copy('WhatsApp number')}
                value={phone}
                onChange={setPhone}
                inputMode="tel"
                disabled={Boolean(enrollTarget)}
              />
              <DInput
                label={copy('NIK')}
                value={nik}
                onChange={setNik}
                inputMode="numeric"
                hint={copy('Used only to enroll this member and never displayed after enrollment.')}
              />
              {enrollError ? <DAlert variant="danger">{enrollError}</DAlert> : null}
              <DButton
                fullWidth
                loading={isEnrolling}
                disabled={!canCreateMember}
                onClick={() => void enroll()}
                leftIcon={<UserPlus className="size-3.5" />}
              >
                {copy('Enroll and select member')}
              </DButton>
            </DTabsContent>
          ) : null}
        </DTabs>

        {customer ? (
          <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface-muted)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {copy('Current customer')}
              </p>
              <p className="truncate text-sm font-semibold">{customer.name}</p>
            </div>
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {customer.type === 'MEMBER' ? copy('Member') : copy('Customer')}
            </span>
          </div>
        ) : null}
      </div>
    </DDialog>
  );
}
