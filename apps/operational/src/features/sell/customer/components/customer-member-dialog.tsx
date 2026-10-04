import { DAlert, DButton, DDialog, DInput, DSkeleton } from '@digvation-labs/ui';
import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Phone, User, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import {
  memberSaleSelection,
  type CustomerLookupResult,
  type CustomerMemberApi,
  type MemberLookupResult,
} from '../../customer-member-api';
import { findExistingCustomerCandidates } from '../../existing-customer-candidates';
import { isApiErrorCode } from '../../cashier-transaction-errors';
import { ExistingCustomerChoice } from '../../components/existing-customer-choice';
import { RegularCustomerSuggestions } from '../../components/regular-customer-suggestions';
import type { SaleCustomer, SaleCustomerSelection } from '../../cashier-transaction.types';
import { sanitizeNationalPhoneInput, toCanonicalPhone } from '../../customer-input';

type CustomerDialogMode = 'CUSTOMER' | 'MEMBER' | 'ENROLL';

const localCopy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  'Customer suggestions': { 'id-ID': 'Saran pelanggan', 'en-US': 'Customer suggestions' },
  'Customer search could not be completed.': {
    'id-ID': 'Pencarian pelanggan tidak dapat dimuat.',
    'en-US': 'Customer search could not be completed.',
  },
  'No customers found.': { 'id-ID': 'Pelanggan tidak ditemukan.', 'en-US': 'No customers found.' },
  'Use as a new customer': {
    'id-ID': 'Gunakan sebagai pelanggan baru',
    'en-US': 'Use as a new customer',
  },
  Next: {
    'id-ID': 'Lanjutkan',
    'en-US': 'Next',
  },
  'Regular Customer': { 'id-ID': 'Pelanggan Umum', 'en-US': 'Regular Customer' },
  Member: { 'id-ID': 'Member', 'en-US': 'Member' },
  'Try again': { 'id-ID': 'Coba lagi', 'en-US': 'Try again' },
  'Choose customer': { 'id-ID': 'Pilih Pelanggan', 'en-US': 'Choose Customer' },
  'Find a customer, choose a registered member, or enroll a new member for this transaction.': {
    'id-ID':
      'Cari data pelanggan, pilih member terdaftar, atau daftarkan member baru untuk transaksi ini.',
    'en-US':
      'Find a customer, choose a registered member, or enroll a new member for this transaction.',
  },
  'Regular customer': { 'id-ID': 'Customer Biasa', 'en-US': 'Regular Customer' },
  'Registered member': { 'id-ID': 'Member Terdaftar', 'en-US': 'Registered Member' },
  'Enroll member': { 'id-ID': 'Daftar Member Baru', 'en-US': 'Enroll Member' },
  'Non-loyalty customer': {
    'id-ID': 'Pelanggan Non-Loyalty (Struk Digital)',
    'en-US': 'Non-Loyalty Customer (Digital Receipt)',
  },
  'Regular digital-receipt customer': {
    'id-ID': 'Pelanggan Umum (Struk Digital)',
    'en-US': 'Regular Customer (Digital Receipt)',
  },
  'A regular customer records name and WhatsApp for the digital receipt for this transaction.': {
    'id-ID': 'Customer biasa mencatat nama & WhatsApp untuk kebutuhan transaksi dan struk digital.',
    'en-US':
      'A regular customer records name and WhatsApp for the digital receipt for this transaction.',
  },
  'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.':
    {
      'id-ID':
        'Customer biasa mencatat nama & WhatsApp untuk transaksi ini tanpa program akumulasi poin loyalty.',
      'en-US':
        'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.',
    },
  'Customer name': { 'id-ID': 'Nama Pelanggan', 'en-US': 'Customer Name' },
  'Name placeholder': { 'id-ID': 'Contoh: Andir Saputra', 'en-US': 'Example: Andir Saputra' },
  'Phone placeholder': { 'id-ID': 'Contoh: 081234567890', 'en-US': 'Example: 081234567890' },
  'WhatsApp / phone': { 'id-ID': 'Nomor WhatsApp / Telepon', 'en-US': 'WhatsApp / Phone' },
  Required: { 'id-ID': 'Wajib diisi', 'en-US': 'Required' },
  'Want to earn points and rewards?': {
    'id-ID': 'Ingin catat poin belanja & reward loyalty pelanggan?',
    'en-US': 'Want to earn points and rewards?',
  },
  'Want to register this customer as a member?': {
    'id-ID': 'Ingin daftarkan pelanggan ini sebagai member?',
    'en-US': 'Want to register this customer as a member?',
  },
  'Enroll as member': { 'id-ID': 'Daftar Member', 'en-US': 'Enroll as Member' },
  'Use customer': { 'id-ID': 'Gunakan Pelanggan', 'en-US': 'Use Customer' },
  'Regular customer status': {
    'id-ID': 'Status: Pelanggan Umum (Walk-In)',
    'en-US': 'Status: Regular Customer (Walk-In)',
  },
  'Search member': { 'id-ID': 'Cari Member Terdaftar', 'en-US': 'Search Registered Member' },
  'Search member placeholder': {
    'id-ID': 'Cari nama, nomor telepon, atau kode member',
    'en-US': 'Search name, phone, or member number',
  },
  'Type at least 2 characters to search members.': {
    'id-ID': 'Ketik minimal 2 karakter untuk mencari member.',
    'en-US': 'Type at least 2 characters to search members.',
  },
  'Search results': { 'id-ID': 'Hasil Pencarian', 'en-US': 'Search Results' },
  'No members found.': { 'id-ID': 'Member tidak ditemukan.', 'en-US': 'No members found.' },
  'Member lookup could not be completed.': {
    'id-ID': 'Pencarian member tidak dapat dimuat.',
    'en-US': 'Member lookup could not be completed.',
  },
  Active: { 'id-ID': 'Aktif', 'en-US': 'Active' },
  'Selected member': { 'id-ID': 'Member Terpilih', 'en-US': 'Selected Member' },
  'Point balance': { 'id-ID': 'Saldo Poin', 'en-US': 'Point Balance' },
  'Loading points...': { 'id-ID': 'Memuat poin...', 'en-US': 'Loading points...' },
  'Use this member': { 'id-ID': 'Gunakan Member Ini', 'en-US': 'Use This Member' },
  'Customer not found in the list?': {
    'id-ID': 'Pelanggan tidak ditemukan dalam daftar?',
    'en-US': 'Customer not found in the list?',
  },
  'Register a new member': { 'id-ID': 'Daftarkan Member Baru', 'en-US': 'Register a New Member' },
  'Membership activation': {
    'id-ID': 'Aktivasi Member & Loyalty Point',
    'en-US': 'Membership & Loyalty Activation',
  },
  'Member activation': { 'id-ID': 'Aktivasi Member', 'en-US': 'Member Activation' },
  'Enrollment creates an active membership for this customer.': {
    'id-ID': 'Pendaftaran membuat keanggotaan aktif untuk pelanggan ini.',
    'en-US': 'Enrollment creates an active membership for this customer.',
  },
  'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.':
    {
      'id-ID':
        'Pendaftaran member membuat keanggotaan aktif. Poin loyalty mengikuti konfigurasi bisnis yang berlaku.',
      'en-US':
        'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.',
    },
  'New member information': { 'id-ID': 'Informasi Member Baru', 'en-US': 'New Member Information' },
  'Member code': { 'id-ID': 'Kode Member', 'en-US': 'Member Code' },
  Automatic: { 'id-ID': 'Otomatis', 'en-US': 'Automatic' },
  'Registration status': { 'id-ID': 'Status Pendaftaran', 'en-US': 'Registration Status' },
  'Active immediately': { 'id-ID': 'Aktif Langsung', 'en-US': 'Active Immediately' },
  'Full name': { 'id-ID': 'Nama Lengkap', 'en-US': 'Full Name' },
  'Enroll and select member': {
    'id-ID': 'Daftar & Pilih Member',
    'en-US': 'Enroll & Select Member',
  },
  'This phone number is already registered as a member.': {
    'id-ID': 'Nomor telepon ini sudah terdaftar sebagai member.',
    'en-US': 'This phone number is already registered as a member.',
  },
  'This phone number is already registered as a customer. Add it as a member from that customer.': {
    'id-ID':
      'Nomor telepon ini sudah terdaftar sebagai pelanggan. Tambahkan sebagai member dari pelanggan tersebut.',
    'en-US':
      'This phone number is already registered as a customer. Add it as a member from that customer.',
  },
  'Customer already registered': {
    'id-ID': 'Pelanggan sudah terdaftar',
    'en-US': 'Customer already registered',
  },
  'This number is already registered as a customer but is not a member yet.': {
    'id-ID': 'Nomor ini sudah terdaftar sebagai pelanggan, tetapi belum menjadi member.',
    'en-US': 'This number is already registered as a customer but is not a member yet.',
  },
  'Choose the customer to make a member.': {
    'id-ID': 'Pilih pelanggan yang akan dijadikan member.',
    'en-US': 'Choose the customer to make a member.',
  },
  'The existing customer profile is not changed.': {
    'id-ID': 'Data pelanggan yang sudah ada tidak diubah.',
    'en-US': 'The existing customer profile is not changed.',
  },
  'Make member': { 'id-ID': 'Jadikan Member', 'en-US': 'Make Member' },
  'Member enrollment could not be completed.': {
    'id-ID': 'Pendaftaran member tidak dapat diselesaikan.',
    'en-US': 'Member enrollment could not be completed.',
  },
  Cancel: { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  'No member search permission.': {
    'id-ID': 'Akun ini tidak memiliki akses pencarian member.',
    'en-US': 'This account cannot search members.',
  },
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatPoints(value: string | null | undefined, locale: string): string {
  if (!value) return '0';
  const match = /^(\d+)(?:\.0+)?$/.exec(value.trim());
  if (!match) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(match[1]));
}

export function CustomerMemberDialog({
  open,
  customer,
  isSaving,
  api,
  canReadMembers,
  canEnrollMember,
  canReadCustomers,
  canReadLoyalty,
  resetKey = 0,
  onClose,
  onChoose,
}: {
  open: boolean;
  customer: SaleCustomer | null;
  isSaving: boolean;
  api: CustomerMemberApi;
  canReadMembers: boolean;
  canEnrollMember: boolean;
  /** Needed to resolve a phone conflict to the existing Customer (customers:read). */
  canReadCustomers: boolean;
  canReadLoyalty: boolean;
  /**
   * Parent-owned transaction boundary. When it changes the temporary draft is discarded; it stays
   * untouched while the same transaction continues (close, reopen, tab switches, failed saves).
   */
  resetKey?: number;
  onClose: () => void;
  onChoose: (selection: SaleCustomerSelection, member?: MemberLookupResult) => void;
}) {
  const { locale } = useOperationalLocalization();
  const text = (value: string) => localCopy[value]?.[locale] ?? value;
  const [mode, setMode] = useState<CustomerDialogMode>('CUSTOMER');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [regularQuery, setRegularQuery] = useState('');
  const [regularCustomer, setRegularCustomer] = useState<CustomerLookupResult | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberLookupResult | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [existingCandidates, setExistingCandidates] = useState<CustomerLookupResult[] | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isEnrolling, setEnrolling] = useState(false);
  const [appliedResetKey, setAppliedResetKey] = useState(resetKey);
  // A new transaction starts with a clean picker. An enrollment in flight is never interrupted:
  // the reset is applied as soon as it settles.
  if (resetKey !== appliedResetKey && !isEnrolling) {
    setAppliedResetKey(resetKey);
    setMode('CUSTOMER');
    setQuery('');
    setName('');
    setPhone('');
    setRegularQuery('');
    setRegularCustomer(null);
    setSelectedMember(null);
    setEnrollError(null);
    setExistingCandidates(null);
    setSelectedCustomerId(null);
  }

  const memberSearchReady = query.trim().length >= 2;
  const memberQuery = useQuery({
    queryKey: ['operational-member-search', api.cacheScope, query.trim()],
    queryFn: ({ signal }) => api.searchMembers(query.trim(), signal),
    enabled: open && mode === 'MEMBER' && canReadMembers && memberSearchReady,
  });
  const selectedBalanceQuery = useQuery({
    queryKey: [
      'operational-member-picker-balance',
      api.cacheScope,
      selectedMember?.id,
      canReadLoyalty,
    ],
    queryFn: ({ signal }) => api.getPointBalance(selectedMember!.id, signal),
    enabled: Boolean(open && mode === 'MEMBER' && selectedMember && canReadLoyalty),
  });

  const switchMode = (next: CustomerDialogMode) => {
    setEnrollError(null);
    setExistingCandidates(null);
    setSelectedCustomerId(null);
    if (next !== 'MEMBER') setSelectedMember(null);
    setMode(next);
  };

  // The visible phone stays as typed (for example 08…); only the boundary uses E.164.
  const canonicalPhone = toCanonicalPhone(phone);

  const submitCustomer = () => {
    if (!name.trim() || !canonicalPhone || isSaving) return;
    if (regularCustomer?.membership?.status === 'ACTIVE' && canReadMembers) {
      const member: MemberLookupResult = {
        ...regularCustomer.membership,
        customerId: regularCustomer.id,
        customer: regularCustomer,
      };
      onChoose(memberSaleSelection(member), member);
    } else {
      onChoose({
        type: 'NON_MEMBER',
        name: name.trim(),
        phone: canonicalPhone,
        ...(regularCustomer ? { referenceId: regularCustomer.id } : { createNew: true as const }),
      });
    }
  };

  const enroll = async () => {
    if (!name.trim() || !canonicalPhone || isEnrolling) return;
    setEnrollError(null);
    setEnrolling(true);
    try {
      const member = await api.enrollNew({
        name: name.trim(),
        phone: canonicalPhone,
      });
      onChoose(memberSaleSelection(member), member);
    } catch (error) {
      if (isApiErrorCode(error, 'CUSTOMER_PHONE_ALREADY_EXISTS')) {
        await continueWithExistingCustomer(canonicalPhone);
      } else {
        setEnrollError(enrollErrorMessage(error));
      }
    } finally {
      setEnrolling(false);
    }
  };

  const enrollErrorMessage = (error: unknown) =>
    isApiErrorCode(error, 'MEMBERSHIP_PHONE_ALREADY_IN_USE')
      ? text('This phone number is already registered as a member.')
      : text('Member enrollment could not be completed.');

  // The phone belongs to Customer(s) without a Membership: resolve them explicitly instead of
  // creating another Customer. Without customers:read, or when nothing matches exactly, the
  // operator only gets the specific message (no bypass, no guessing).
  const continueWithExistingCustomer = async (phone: string) => {
    const conflict = text(
      'This phone number is already registered as a customer. Add it as a member from that customer.',
    );
    if (!canReadCustomers) return setEnrollError(conflict);
    try {
      const candidates = await findExistingCustomerCandidates(api, phone);
      if (!candidates.length) return setEnrollError(conflict);
      setExistingCandidates(candidates);
      // Only an unambiguous single match is preselected; several matches need an explicit choice.
      setSelectedCustomerId(candidates.length === 1 ? candidates[0]!.id : null);
    } catch {
      setEnrollError(conflict);
    }
  };

  const enrollExistingCustomer = async () => {
    if (!selectedCustomerId || isEnrolling) return;
    setEnrollError(null);
    setEnrolling(true);
    try {
      // Enrollment only creates the Membership: the existing Customer's name is never overwritten.
      const member = await api.enrollExisting({ customerId: selectedCustomerId });
      onChoose(memberSaleSelection(member), member);
    } catch (error) {
      setEnrollError(enrollErrorMessage(error));
    } finally {
      setEnrolling(false);
    }
  };

  const cancelExistingCustomer = () => {
    setExistingCandidates(null);
    setSelectedCustomerId(null);
    setEnrollError(null);
  };

  const memberItems = memberQuery.data?.items ?? [];
  const customerReady = Boolean(name.trim() && canonicalPhone) && !isSaving;
  const enrollmentReady = Boolean(name.trim() && canonicalPhone) && !isEnrolling && !isSaving;

  const footer =
    mode === 'CUSTOMER' ? (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-(--color-text-muted)">{text('Regular customer status')}</p>
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={isSaving}>
            {text('Cancel')}
          </DButton>
          <DButton onClick={submitCustomer} disabled={!customerReady} loading={isSaving}>
            {text('Next')}
          </DButton>
        </div>
      </div>
    ) : mode === 'MEMBER' ? (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-(--color-text-muted)">
          {selectedMember ? text('Selected member') : text('Search member')}
        </p>
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {text('Cancel')}
          </DButton>
          <DButton
            disabled={!selectedMember || isSaving}
            loading={isSaving}
            onClick={() => {
              if (selectedMember) onChoose(memberSaleSelection(selectedMember), selectedMember);
            }}
          >
            {text('Use this member')}
          </DButton>
        </div>
      </div>
    ) : existingCandidates ? (
      <div className="flex w-full justify-end gap-2">
        <DButton variant="secondary" onClick={cancelExistingCustomer} disabled={isEnrolling}>
          {text('Cancel')}
        </DButton>
        <DButton
          disabled={!selectedCustomerId || isEnrolling || isSaving}
          loading={isEnrolling}
          leftIcon={<CheckCircle2 className="size-4" />}
          onClick={() => void enrollExistingCustomer()}
        >
          {text('Make member')}
        </DButton>
      </div>
    ) : (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-(--color-text-muted)">
          <span className="text-(--color-danger)">*</span> {text('Required')}
        </p>
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={isEnrolling}>
            {text('Cancel')}
          </DButton>
          <DButton
            disabled={!enrollmentReady}
            loading={isEnrolling}
            leftIcon={<CheckCircle2 className="size-4" />}
            onClick={() => void enroll()}
          >
            {text('Enroll and select member')}
          </DButton>
        </div>
      </div>
    );

  return (
    <DDialog
      title={text('Choose customer')}
      open={open}
      onClose={onClose}
      ariaLabel={text('Choose customer')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-(--color-surface) shadow-xl sm:rounded-2xl"
      footer={footer}
    >
      <div className="space-y-4">
        <p className="text-xs leading-5 text-(--color-text-muted)">
          {text(
            'Find a customer, choose a registered member, or enroll a new member for this transaction.',
          )}
        </p>

        <DTabs
          value={mode}
          defaultValue="CUSTOMER"
          onValueChange={(value) => switchMode(value as CustomerDialogMode)}
        >
          <DTabsList
            className={`grid w-full ${
              canReadMembers && canEnrollMember
                ? 'grid-cols-3'
                : canReadMembers || canEnrollMember
                  ? 'grid-cols-2'
                  : 'grid-cols-1'
            } rounded-xl bg-(--color-surface-muted) p-1`}
          >
            <DTabsTrigger value="CUSTOMER" className="min-w-0 px-2">
              <span className="flex min-w-0 items-center justify-center gap-2">
                <User className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{text('Regular customer')}</span>
              </span>
            </DTabsTrigger>
            {canReadMembers ? (
              <DTabsTrigger value="MEMBER" className="min-w-0 px-2">
                <span className="flex min-w-0 items-center justify-center gap-2">
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{text('Registered member')}</span>
                </span>
              </DTabsTrigger>
            ) : null}
            {canEnrollMember ? (
              <DTabsTrigger value="ENROLL" className="min-w-0 px-2">
                <span className="flex min-w-0 items-center justify-center gap-2">
                  <UserPlus className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{text('Enroll member')}</span>
                </span>
              </DTabsTrigger>
            ) : null}
          </DTabsList>

          <DTabsContent value="CUSTOMER" className="mt-4 space-y-4">
            <div className="rounded-xl border border-(--color-brand)/15 bg-(--color-brand)/6 px-4 py-3">
              <p className="text-sm font-semibold text-(--color-brand)">
                {text(canReadLoyalty ? 'Non-loyalty customer' : 'Regular digital-receipt customer')}
              </p>
              <p className="mt-1 text-xs leading-5 text-(--color-text-muted)">
                {text(
                  canReadLoyalty
                    ? 'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.'
                    : 'A regular customer records name and WhatsApp for the digital receipt for this transaction.',
                )}
              </p>
            </div>

            <div className="space-y-3">
              <DInput
                label={text('Customer name')}
                placeholder={text('Name placeholder')}
                value={name}
                onChange={(value) => {
                  setName(value);
                  setRegularQuery(value);
                  setRegularCustomer(null);
                }}
                disabled={isSaving}
              />
              <DInput
                label={text('WhatsApp / phone')}
                placeholder={text('Phone placeholder')}
                value={phone}
                onChange={(value) => {
                  const national = sanitizeNationalPhoneInput(value);
                  setPhone(national);
                  setRegularQuery(toCanonicalPhone(national) ?? national);
                  setRegularCustomer(null);
                }}
                inputMode="tel"
                disabled={isSaving}
              />
            </div>

            <RegularCustomerSuggestions
              query={regularQuery}
              api={api}
              enabled={open && mode === 'CUSTOMER' && canReadCustomers}
              selectedId={regularCustomer?.id ?? null}
              canReadMembers={canReadMembers}
              disabled={isSaving}
              text={text}
              newDisabled={!customerReady}
              onSelect={(selected) => {
                setRegularCustomer(selected);
                setName(selected.name);
                setPhone(sanitizeNationalPhoneInput(selected.phoneE164));
              }}
              onNew={() => {
                if (customerReady)
                  onChoose({
                    type: 'NON_MEMBER',
                    name: name.trim(),
                    phone: canonicalPhone!,
                    createNew: true,
                  });
              }}
            />

            {canEnrollMember ? (
              <button
                type="button"
                onClick={() => switchMode('ENROLL')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-(--color-brand)/35 bg-(--color-brand)/4 px-4 py-3 text-left transition-colors hover:bg-(--color-brand)/8"
              >
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-(--color-text)">
                  <UserPlus className="size-4 shrink-0 text-(--color-brand)" />
                  <span>
                    {text(
                      canReadLoyalty
                        ? 'Want to earn points and rewards?'
                        : 'Want to register this customer as a member?',
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-(--color-brand)">
                  {text('Enroll as member')}
                </span>
              </button>
            ) : null}
          </DTabsContent>

          <DTabsContent value="MEMBER" className="mt-4 space-y-3">
            {!canReadMembers ? (
              <DAlert variant="neutral">{text('No member search permission.')}</DAlert>
            ) : (
              <>
                <DInput
                  label={text('Search member')}
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setSelectedMember(null);
                  }}
                  placeholder={text('Search member placeholder')}
                />

                {!memberSearchReady ? (
                  <p className="text-xs text-(--color-text-muted)">
                    {text('Type at least 2 characters to search members.')}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-(--color-border)">
                    <div className="flex items-center justify-between bg-(--color-surface-muted) px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
                        {text('Search results')} ({memberItems.length})
                      </span>
                    </div>
                    <div className="max-h-64 divide-y divide-(--color-border) overflow-y-auto">
                      {memberQuery.isLoading ? (
                        <div className="space-y-2 p-3">
                          <DSkeleton className="h-14 rounded-xl" />
                          <DSkeleton className="h-14 rounded-xl" />
                        </div>
                      ) : memberQuery.isError ? (
                        <div className="p-3">
                          <DAlert variant="danger">
                            {text('Member lookup could not be completed.')}
                          </DAlert>
                        </div>
                      ) : memberItems.length ? (
                        memberItems.map((member) => {
                          const selected = selectedMember?.id === member.id;
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => setSelectedMember(member)}
                              className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                                selected
                                  ? 'bg-(--color-brand)/[.07]'
                                  : 'bg-(--color-surface) hover:bg-(--color-surface-muted)'
                              }`}
                            >
                              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-(--color-brand)/10 text-xs font-semibold text-(--color-brand)">
                                {initials(member.customer.name)}
                              </div>
                              <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="truncate text-sm font-semibold">
                                    {member.customer.name}
                                  </span>
                                  <span className="shrink-0 rounded-md bg-(--color-surface-muted) px-1.5 py-0.5 text-[10px] font-medium text-(--color-text-muted)">
                                    {member.memberNumber}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-(--color-success)/10 px-1.5 py-0.5 text-[10px] font-medium text-(--color-success)">
                                    {text('Active')}
                                  </span>
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-(--color-text-muted)">
                                  <Phone className="size-3" />
                                  {member.customer.phoneE164}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-(--color-brand)">
                                {selected ? '✓' : '›'}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-xs text-(--color-text-muted)">
                          {text('No members found.')}
                        </div>
                      )}
                    </div>

                    {canEnrollMember ? (
                      <div className="flex items-center justify-between gap-3 border-t border-(--color-border) bg-(--color-surface-muted)/45 px-3 py-2.5">
                        <span className="text-xs text-(--color-text-muted)">
                          {text('Customer not found in the list?')}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-(--color-brand)"
                          onClick={() => switchMode('ENROLL')}
                        >
                          {text('Register a new member')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {selectedMember ? (
                  <div className="rounded-xl border border-(--color-brand)/20 bg-(--color-brand)/4 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
                          {text('Selected member')}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {selectedMember.customer.name}
                        </p>
                      </div>
                      {canReadLoyalty ? (
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-(--color-text-muted)">
                            {text('Point balance')}
                          </p>
                          <p className="mt-1 text-sm font-bold text-(--color-brand)">
                            {selectedBalanceQuery.isLoading
                              ? text('Loading points...')
                              : formatPoints(selectedBalanceQuery.data?.pointsBalance, locale)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </DTabsContent>

          {canEnrollMember ? (
            <DTabsContent value="ENROLL" className="mt-4 space-y-4">
              <div className="rounded-xl border border-(--color-brand)/20 bg-(--color-brand)/6 px-4 py-3">
                <div className="flex items-start gap-2">
                  <UserPlus className="mt-0.5 size-4 shrink-0 text-(--color-brand)" />
                  <div>
                    <p className="text-sm font-semibold text-(--color-brand)">
                      {text(canReadLoyalty ? 'Membership activation' : 'Member activation')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-(--color-text-muted)">
                      {text(
                        canReadLoyalty
                          ? 'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.'
                          : 'Enrollment creates an active membership for this customer.',
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {existingCandidates ? (
                <ExistingCustomerChoice
                  candidates={existingCandidates}
                  selectedId={selectedCustomerId}
                  onSelect={setSelectedCustomerId}
                  disabled={isEnrolling}
                  copy={{
                    title: text('Customer already registered'),
                    description: text(
                      'This number is already registered as a customer but is not a member yet.',
                    ),
                    choose: text('Choose the customer to make a member.'),
                    unchanged: text('The existing customer profile is not changed.'),
                  }}
                />
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)">
                      {text('New member information')}
                    </p>
                    <span className="text-[10px] text-(--color-text-muted)">1 / 1</span>
                  </div>
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-(--color-surface-muted) px-3 py-2.5">
                      <p className="text-[10px] font-medium text-(--color-text-muted)">
                        {text('Member code')}
                      </p>
                      <p className="mt-1 text-xs font-semibold">{text('Automatic')}</p>
                    </div>
                    <div className="rounded-xl bg-(--color-surface-muted) px-3 py-2.5">
                      <p className="text-[10px] font-medium text-(--color-text-muted)">
                        {text('Registration status')}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-(--color-success)">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {text('Active immediately')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <DInput
                      label={text('Full name')}
                      placeholder={text('Name placeholder')}
                      value={name}
                      onChange={setName}
                      disabled={isEnrolling}
                    />
                    <DInput
                      label={text('WhatsApp / phone')}
                      placeholder={text('Phone placeholder')}
                      value={phone}
                      onChange={(value) => setPhone(sanitizeNationalPhoneInput(value))}
                      inputMode="tel"
                      disabled={isEnrolling}
                    />
                  </div>
                </div>
              )}

              {enrollError ? <DAlert variant="danger">{enrollError}</DAlert> : null}
            </DTabsContent>
          ) : null}
        </DTabs>

        {customer ? (
          <div className="sr-only">
            {customer.name} · {customer.phoneE164}
          </div>
        ) : null}
      </div>
    </DDialog>
  );
}
