import { DAlert, DButton, DDialog, DInput, DSearchInput, DSkeleton } from '@digvation-labs/ui';
import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Phone, User, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  memberSaleSelection,
  type CustomerMemberApi,
  type MemberLookupResult,
} from '../customer-member-api';
import type { SaleCustomer, SaleCustomerSelection } from '../cashier-transaction.types';

type CustomerDialogMode = 'CUSTOMER' | 'MEMBER' | 'ENROLL';

const localCopy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  'Choose customer': { 'id-ID': 'Pilih Pelanggan', 'en-US': 'Choose Customer' },
  'Find a customer, choose a registered member, or enroll a new member for this transaction.': {
    'id-ID': 'Cari data pelanggan, pilih member terdaftar, atau daftarkan member baru untuk transaksi ini.',
    'en-US': 'Find a customer, choose a registered member, or enroll a new member for this transaction.',
  },
  'Regular customer': { 'id-ID': 'Customer Biasa', 'en-US': 'Regular Customer' },
  'Registered member': { 'id-ID': 'Member Terdaftar', 'en-US': 'Registered Member' },
  'Enroll member': { 'id-ID': 'Daftar Member Baru', 'en-US': 'Enroll Member' },
  'Non-loyalty customer': { 'id-ID': 'Pelanggan Non-Loyalty (Struk Digital)', 'en-US': 'Non-Loyalty Customer (Digital Receipt)' },
  'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.': {
    'id-ID': 'Customer biasa mencatat nama & WhatsApp untuk transaksi ini tanpa program akumulasi poin loyalty.',
    'en-US': 'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.',
  },
  'Customer name': { 'id-ID': 'Nama Pelanggan', 'en-US': 'Customer Name' },
  'WhatsApp / phone': { 'id-ID': 'Nomor WhatsApp / Telepon', 'en-US': 'WhatsApp / Phone' },
  'Required': { 'id-ID': 'Wajib diisi', 'en-US': 'Required' },
  'Want to earn points and rewards?': { 'id-ID': 'Ingin catat poin belanja & reward loyalty pelanggan?', 'en-US': 'Want to earn points and rewards?' },
  'Enroll as member': { 'id-ID': 'Daftar Member', 'en-US': 'Enroll as Member' },
  'Use customer': { 'id-ID': 'Gunakan Pelanggan', 'en-US': 'Use Customer' },
  'Regular customer status': { 'id-ID': 'Status: Pelanggan Umum (Walk-In)', 'en-US': 'Status: Regular Customer (Walk-In)' },
  'Search member': { 'id-ID': 'Cari Member Terdaftar', 'en-US': 'Search Registered Member' },
  'Search member placeholder': { 'id-ID': 'Cari nama, nomor telepon, atau kode member', 'en-US': 'Search name, phone, or member number' },
  'Search results': { 'id-ID': 'Hasil Pencarian', 'en-US': 'Search Results' },
  'No members found.': { 'id-ID': 'Member tidak ditemukan.', 'en-US': 'No members found.' },
  'Member lookup could not be completed.': { 'id-ID': 'Pencarian member tidak dapat dimuat.', 'en-US': 'Member lookup could not be completed.' },
  'Active': { 'id-ID': 'Aktif', 'en-US': 'Active' },
  'Selected member': { 'id-ID': 'Member Terpilih', 'en-US': 'Selected Member' },
  'Point balance': { 'id-ID': 'Saldo Poin', 'en-US': 'Point Balance' },
  'Loading points...': { 'id-ID': 'Memuat poin...', 'en-US': 'Loading points...' },
  'Use this member': { 'id-ID': 'Gunakan Member Ini', 'en-US': 'Use This Member' },
  'Customer not found in the list?': { 'id-ID': 'Pelanggan tidak ditemukan dalam daftar?', 'en-US': 'Customer not found in the list?' },
  'Register a new member': { 'id-ID': 'Daftarkan Member Baru', 'en-US': 'Register a New Member' },
  'Membership activation': { 'id-ID': 'Aktivasi Member & Loyalty Point', 'en-US': 'Membership & Loyalty Activation' },
  'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.': {
    'id-ID': 'Pendaftaran member membuat keanggotaan aktif. Poin loyalty mengikuti konfigurasi bisnis yang berlaku.',
    'en-US': 'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.',
  },
  'Full name': { 'id-ID': 'Nama Lengkap', 'en-US': 'Full Name' },
  'NIK': { 'id-ID': 'NIK (Nomor Induk Kependudukan)', 'en-US': 'NIK (National ID Number)' },
  'NIK hint': { 'id-ID': '16 digit NIK digunakan hanya untuk verifikasi dan tidak ditampilkan setelah pendaftaran.', 'en-US': 'The 16-digit NIK is used only for verification and is never displayed after enrollment.' },
  'Enroll and select member': { 'id-ID': 'Daftar & Pilih Member', 'en-US': 'Enroll & Select Member' },
  'Member enrollment could not be completed.': { 'id-ID': 'Pendaftaran member tidak dapat diselesaikan.', 'en-US': 'Member enrollment could not be completed.' },
  'Cancel': { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  'No member search permission.': { 'id-ID': 'Akun ini tidak memiliki akses pencarian member.', 'en-US': 'This account cannot search members.' },
};

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
  canEnrollMember,
  canReadLoyalty,
  onClose,
  onChoose,
}: {
  open: boolean;
  customer: SaleCustomer | null;
  isSaving: boolean;
  api: CustomerMemberApi;
  canReadMembers: boolean;
  canEnrollMember: boolean;
  canReadLoyalty: boolean;
  onClose: () => void;
  onChoose: (selection: SaleCustomerSelection, member?: MemberLookupResult) => void;
}) {
  const { locale } = useOperationalLocalization();
  const text = (value: string) => localCopy[value]?.[locale] ?? value;
  const [mode, setMode] = useState<CustomerDialogMode>('CUSTOMER');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nik, setNik] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberLookupResult | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isEnrolling, setEnrolling] = useState(false);

  const memberQuery = useQuery({
    queryKey: ['operational-member-search', query],
    queryFn: ({ signal }) => api.searchMembers(query, signal),
    enabled: open && mode === 'MEMBER' && canReadMembers,
  });
  const selectedBalanceQuery = useQuery({
    queryKey: ['operational-member-picker-balance', selectedMember?.id],
    queryFn: ({ signal }) => api.getPointBalance(selectedMember!.id, signal),
    enabled: Boolean(open && mode === 'MEMBER' && selectedMember && canReadLoyalty),
  });

  const switchMode = (next: CustomerDialogMode) => {
    setEnrollError(null);
    if (next !== 'MEMBER') setSelectedMember(null);
    setMode(next);
  };

  const submitCustomer = () => {
    if (!name.trim() || !phone.trim() || isSaving) return;
    onChoose({ type: 'NON_MEMBER', name: name.trim(), phone: phone.trim() });
  };

  const enroll = async () => {
    if (!name.trim() || !phone.trim() || !nik.trim() || isEnrolling) return;
    const submittedNik = nik;
    setNik('');
    setEnrollError(null);
    setEnrolling(true);
    try {
      const member = await api.enrollNew({
        name: name.trim(),
        phone: phone.trim(),
        nik: submittedNik,
      });
      onChoose(memberSaleSelection(member), member);
    } catch {
      setEnrollError(text('Member enrollment could not be completed.'));
    } finally {
      setEnrolling(false);
    }
  };

  const memberItems = memberQuery.data?.items ?? [];
  const customerReady = Boolean(name.trim() && phone.trim()) && !isSaving;
  const enrollmentReady =
    Boolean(name.trim() && phone.trim() && nik.trim()) && !isEnrolling && !isSaving;

  const footer =
    mode === 'CUSTOMER' ? (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">{text('Regular customer status')}</p>
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={isSaving}>
            {text('Cancel')}
          </DButton>
          <DButton onClick={submitCustomer} disabled={!customerReady} loading={isSaving}>
            {text('Use customer')}
          </DButton>
        </div>
      </div>
    ) : mode === 'MEMBER' ? (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
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
    ) : (
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          <span className="text-[var(--color-danger)]">*</span> {text('Required')}
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
      open={open}
      onClose={onClose}
      ariaLabel={text('Choose customer')}
      closeOnEscape
      closeOnOverlay
      className="pos-reference-dialog w-full max-w-[640px] overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-2xl"
      footer={footer}
    >
      <div className="space-y-4">
        <header className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            <Users className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-6">{text('Choose customer')}</h2>
            <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">
              {text(
                'Find a customer, choose a registered member, or enroll a new member for this transaction.',
              )}
            </p>
          </div>
          <DButton
            size="icon"
            variant="ghost"
            aria-label={text('Cancel')}
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0"
          >
            <X className="size-4.5" />
          </DButton>
        </header>

        <DTabs
          value={mode}
          defaultValue="CUSTOMER"
          onValueChange={(value) => switchMode(value as CustomerDialogMode)}
        >
          <DTabsList
            className={`grid w-full ${
              canEnrollMember ? 'grid-cols-3' : 'grid-cols-2'
            } rounded-xl bg-[var(--color-surface-muted)] p-1`}
          >
            <DTabsTrigger value="CUSTOMER" className="min-w-0 gap-1.5 px-2">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{text('Regular customer')}</span>
            </DTabsTrigger>
            <DTabsTrigger value="MEMBER" className="min-w-0 gap-1.5 px-2">
              <Users className="size-3.5 shrink-0" />
              <span className="truncate">{text('Registered member')}</span>
            </DTabsTrigger>
            {canEnrollMember ? (
              <DTabsTrigger value="ENROLL" className="min-w-0 gap-1.5 px-2">
                <UserPlus className="size-3.5 shrink-0" />
                <span className="truncate">{text('Enroll member')}</span>
              </DTabsTrigger>
            ) : null}
          </DTabsList>

          <DTabsContent value="CUSTOMER" className="mt-4 space-y-4">
            <div className="rounded-xl border border-[var(--color-brand)]/15 bg-[var(--color-brand)]/[.06] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-brand)]">
                {text('Non-loyalty customer')}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                {text(
                  'A regular customer records name and WhatsApp for this transaction without accumulating loyalty points.',
                )}
              </p>
            </div>

            <div className="space-y-3">
              <DInput
                label={text('Customer name')}
                value={name}
                onChange={setName}
                disabled={isSaving}
              />
              <DInput
                label={text('WhatsApp / phone')}
                value={phone}
                onChange={setPhone}
                inputMode="tel"
                disabled={isSaving}
              />
            </div>

            {canEnrollMember ? (
              <button
                type="button"
                onClick={() => switchMode('ENROLL')}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--color-brand)]/35 bg-[var(--color-brand)]/[.04] px-4 py-3 text-left transition-colors hover:bg-[var(--color-brand)]/[.08]"
              >
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[var(--color-text)]">
                  <UserPlus className="size-4 shrink-0 text-[var(--color-brand)]" />
                  <span>{text('Want to earn points and rewards?')}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[var(--color-brand)]">
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
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">{text('Search member')}</p>
                  <DSearchInput
                    aria-label={text('Search member')}
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      setSelectedMember(null);
                    }}
                    placeholder={text('Search member placeholder')}
                    className="w-full"
                  />
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <div className="flex items-center justify-between bg-[var(--color-surface-muted)] px-3 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {text('Search results')} ({memberItems.length})
                    </span>
                  </div>
                  <div className="max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto">
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
                                ? 'bg-[var(--color-brand)]/[.07]'
                                : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]'
                            }`}
                          >
                            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-xs font-semibold text-[var(--color-brand)]">
                              {initials(member.customer.name)}
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold">
                                  {member.customer.name}
                                </span>
                                <span className="shrink-0 rounded-md bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                                  {member.memberNumber}
                                </span>
                              </span>
                              <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                                <Phone className="size-3" />
                                {member.customer.phoneE164}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-[var(--color-brand)]">
                              {selected ? '✓' : '›'}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-xs text-[var(--color-text-muted)]">
                        {text('No members found.')}
                      </div>
                    )}
                  </div>

                  {canEnrollMember ? (
                    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 px-3 py-2.5">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {text('Customer not found in the list?')}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--color-brand)]"
                        onClick={() => switchMode('ENROLL')}
                      >
                        {text('Register a new member')}
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedMember ? (
                  <div className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                          {text('Selected member')}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {selectedMember.customer.name}
                        </p>
                      </div>
                      {canReadLoyalty ? (
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {text('Point balance')}
                          </p>
                          <p className="mt-1 text-sm font-bold text-[var(--color-brand)]">
                            {selectedBalanceQuery.isLoading
                              ? text('Loading points...')
                              : (selectedBalanceQuery.data?.pointsBalance ?? '0')}
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
              <div className="rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.06] px-4 py-3">
                <div className="flex items-start gap-2">
                  <UserPlus className="mt-0.5 size-4 shrink-0 text-[var(--color-brand)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-brand)]">
                      {text('Membership activation')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                      {text(
                        'Enrollment creates an active membership for this customer. Loyalty points follow the current business configuration.',
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <DInput
                  label={text('Full name')}
                  value={name}
                  onChange={setName}
                  disabled={isEnrolling}
                />
                <DInput
                  label={text('WhatsApp / phone')}
                  value={phone}
                  onChange={setPhone}
                  inputMode="tel"
                  disabled={isEnrolling}
                />
                <DInput
                  label={text('NIK')}
                  value={nik}
                  onChange={setNik}
                  inputMode="numeric"
                  disabled={isEnrolling}
                  hint={text('NIK hint')}
                />
              </div>

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
