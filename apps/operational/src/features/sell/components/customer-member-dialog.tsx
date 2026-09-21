import { DAlert, DButton, DDialog, DInput, DSearchInput, DSkeleton } from '@digvation-labs/ui';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  memberSaleSelection,
  type CustomerLookupResult,
  type CustomerMemberApi,
  type MemberLookupResult,
} from '../customer-member-api';
import type { SaleCustomer, SaleCustomerSelection } from '../cashier-transaction.types';

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
  const [mode, setMode] = useState<'CUSTOMER' | 'MEMBER' | 'ENROLL'>('CUSTOMER');
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

  const enroll = async () => {
    if (!nik.trim() || isEnrolling) return;
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
  const canCreateMember = Boolean(name.trim() && phone.trim() && nik.trim()) && !isEnrolling;

  return (
    <DDialog
      title={copy('Choose customer')}
      open={open}
      onClose={onClose}
      ariaLabel={copy('Choose customer')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
    >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{copy('Choose customer')}</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Search a customer or member, or add a customer for this sale.')}
            </p>
          </div>
          <DButton size="sm" variant="ghost" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
        <div className="mt-4 flex gap-2" aria-label={copy('Customer selection mode')}>
          <DButton
            size="sm"
            variant={mode === 'CUSTOMER' ? 'primary' : 'secondary'}
            onClick={() => setMode('CUSTOMER')}
          >
            {copy('Customer')}
          </DButton>
          <DButton
            size="sm"
            variant={mode === 'MEMBER' ? 'primary' : 'secondary'}
            onClick={() => setMode('MEMBER')}
          >
            {copy('Member')}
          </DButton>
          {canEnrollMember ? (
            <DButton
              size="sm"
              variant={mode === 'ENROLL' ? 'primary' : 'secondary'}
              onClick={() => {
                setEnrollTarget(null);
                setEnrollError(null);
                setMode('ENROLL');
              }}
              leftIcon={<UserPlus className="size-3.5" />}
            >
              {copy('Enroll member')}
            </DButton>
          ) : null}
        </div>

        {mode === 'ENROLL' ? (
          <div className="mt-4 space-y-3">
            <DInput label={copy('Name')} value={name} onChange={setName} />
            <DInput
              label={copy('WhatsApp number')}
              value={phone}
              onChange={setPhone}
              inputMode="tel"
            />
            <DInput
              label={copy('NIK')}
              value={nik}
              onChange={setNik}
              inputMode="numeric"
              hint={copy('Used only to enroll this member.')}
            />
            {enrollError ? <DAlert variant="danger">{enrollError}</DAlert> : null}
            <DButton
              fullWidth
              loading={isEnrolling}
              disabled={!canCreateMember}
              onClick={() => void enroll()}
            >
              {copy('Enroll and select member')}
            </DButton>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <DSearchInput
              aria-label={copy('Search customer or member')}
              value={query}
              onChange={setQuery}
              placeholder={
                mode === 'MEMBER' ? copy('Name, phone, or member number') : copy('Name or phone')
              }
            />
            {mode === 'CUSTOMER' ? (
              <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
                <p className="text-xs font-semibold">{copy('Use a new non-member customer')}</p>
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
                  onClick={submitCustomer}
                >
                  {copy('Use customer')}
                </DButton>
              </div>
            ) : null}
            {!searchReady ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy('Enter at least 2 characters to search.')}
              </p>
            ) : null}
            {results.isLoading ? <DSkeleton className="h-16 rounded-xl" /> : null}
            {results.isError ? (
              <DAlert variant="danger">{copy('Customer lookup could not be completed.')}</DAlert>
            ) : null}
            {searchReady && results.data && results.data.items.length === 0 ? (
              <DAlert variant="neutral">{copy('No matching customers found.')}</DAlert>
            ) : null}
            {mode === 'MEMBER' && !canReadMembers ? (
              <DAlert variant="neutral">
                {copy('You do not have permission to search members.')}
              </DAlert>
            ) : null}
            {mode === 'CUSTOMER' && !canReadCustomers ? (
              <DAlert variant="neutral">
                {copy('You do not have permission to search customers.')}
              </DAlert>
            ) : null}
            {mode === 'MEMBER'
              ? memberQuery.data?.items.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-brand)]"
                    onClick={() => onChoose(memberSaleSelection(member), member)}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{member.customer.name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {member.customer.phoneE164}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-brand)]">
                      {member.memberNumber}
                    </span>
                  </button>
                ))
              : customerQuery.data?.items.map((found) => (
                  <div
                    key={found.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        onChoose({ type: 'NON_MEMBER', name: found.name, phone: found.phoneE164 })
                      }
                    >
                      <span className="block text-sm font-semibold">{found.name}</span>
                      <span className="block text-xs text-[var(--color-text-muted)]">
                        {found.phoneE164}
                      </span>
                    </button>
                    {canEnrollMember ? (
                      <DButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEnrollTarget(found);
                          setNik('');
                          setEnrollError(null);
                          setMode('ENROLL');
                        }}
                      >
                        {copy('Enroll')}
                      </DButton>
                    ) : null}
                  </div>
                ))}
          </div>
        )}
    </DDialog>
  );
}
