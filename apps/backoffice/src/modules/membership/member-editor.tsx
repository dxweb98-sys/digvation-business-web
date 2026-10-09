import { DButton, DDialog, DInput, useToast } from '@digvation/ui';
import { Hash, UserRound } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { readStoredBackofficeLocale } from '../../app/localization/backoffice-localization';
import { useFormState } from '../../shared/forms/use-form-state';
import { adjustmentAmountForRequest, sanitizePointsInput } from './member-points-model';
import { findExistingCustomerCandidates } from './existing-customer-candidates';
import { ExistingCustomerChoice } from './existing-customer-choice';
import type { Customer, Member, MembersApi } from './members-api';
import { membershipCopy } from './membership-copy';
import {
  MemberDialogTitle,
  MemberNumberBadge,
  MemberPanel,
  MemberSectionLabel,
  MemberStatusBadge,
} from './membership-surfaces';
import {
  sanitizeNationalMemberPhone,
  toCanonicalMemberPhone,
  toNationalMemberPhone,
} from './member-phone';

const continuationCopy = {
  id: {
    title: 'Pelanggan sudah terdaftar',
    description: 'Nomor ini sudah terdaftar sebagai pelanggan, tetapi belum menjadi member.',
    choose: 'Pilih pelanggan yang akan dijadikan member.',
    unchanged: 'Data pelanggan yang sudah ada tidak diubah.',
    cancel: 'Batal',
    makeMember: 'Jadikan Member',
  },
  en: {
    title: 'Customer already registered',
    description: 'This number is already registered as a customer but is not a member yet.',
    choose: 'Choose the customer to make a member.',
    unchanged: 'The existing customer profile is not changed.',
    cancel: 'Cancel',
    makeMember: 'Make Member',
  },
} as const;

/**
 * Enrolls a new Member (name + phone only) or edits the canonical Customer of an existing one.
 * Phones are typed and shown nationally (08…) and sent to Runtime as canonical E.164.
 * When the phone already belongs to Customer(s) without a Membership, enrollment continues
 * through an explicit choice of the existing Customer instead of creating another one.
 */
export function MemberEditor({
  member,
  api,
  canLookupCustomers,
  openingPointsAvailable = false,
  done,
  close,
}: {
  member: Member | null;
  api: Pick<MembersApi, 'enroll' | 'enrollExisting' | 'searchCustomers' | 'updateCustomer'>;
  /** customers:read: without it a phone conflict only shows the specific message. */
  canLookupCustomers: boolean;
  /** Loyalty Points capability plus loyalty:configure; Runtime enforces it regardless. */
  openingPointsAvailable?: boolean;
  done: () => void;
  close: () => void;
}) {
  const form = useFormState(() => ({
    name: member?.customer.name ?? '',
    phone: member ? toNationalMemberPhone(member.customer.phoneE164) : '',
    openingPoints: '',
  }));
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Customer[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { showToast } = useToast();
  const text = membershipCopy();
  const copy = continuationCopy[readStoredBackofficeLocale()];
  const { name } = form.values;
  const phone = toCanonicalMemberPhone(form.values.phone);
  const phoneTyped = form.values.phone.trim() !== '';
  // Poin awal belongs to enrollment only; blank means none. A positive value is sent as typed.
  const openingTyped = form.values.openingPoints.trim() !== '';
  const openingRequest = adjustmentAmountForRequest(form.values.openingPoints);
  const openingInvalid = !member && openingPointsAvailable && openingTyped && !openingRequest;
  const openingPoints =
    !member && openingPointsAvailable && openingRequest ? { openingPoints: openingRequest } : {};

  const fail = (error: unknown) =>
    showToast({ variant: 'danger', title: normalizeBackofficeApiError(error).safeMessage });

  const continueWithExistingCustomer = async (conflict: unknown, canonicalPhone: string) => {
    if (!canLookupCustomers) return fail(conflict);
    try {
      const found = await findExistingCustomerCandidates(api, canonicalPhone);
      if (!found.length) return fail(conflict);
      setCandidates(found);
      // Only an unambiguous single match is preselected; several matches need an explicit choice.
      setSelectedId(found.length === 1 ? found[0]!.id : null);
    } catch {
      fail(conflict);
    }
  };

  const save = async () => {
    if (!name.trim() || !phone || openingInvalid || busy) return;
    setBusy(true);
    try {
      if (member) await api.updateCustomer(member, { name, phone });
      else await api.enroll({ name, phone, ...openingPoints });
      done();
      close();
    } catch (error) {
      if (!member && normalizeBackofficeApiError(error).code === 'CUSTOMER_PHONE_ALREADY_EXISTS')
        await continueWithExistingCustomer(error, phone);
      else fail(error);
    } finally {
      setBusy(false);
    }
  };

  const enrollExistingCustomer = async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      // Only the Membership is created: the existing Customer's name is never overwritten.
      await api.enrollExisting({ customerId: selectedId, ...openingPoints });
      done();
      close();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const cancelContinuation = () => {
    setCandidates(null);
    setSelectedId(null);
  };

  return (
    <DDialog
      open
      onClose={close}
      size="lg"
      title={
        <MemberDialogTitle
          title={member ? text.editTitle : text.enrollTitle}
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
        candidates ? (
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" disabled={busy} onClick={cancelContinuation}>
              {copy.cancel}
            </DButton>
            <DButton disabled={!selectedId || busy} onClick={() => void enrollExistingCustomer()}>
              {copy.makeMember}
            </DButton>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" disabled={busy} onClick={close}>
              {text.cancel}
            </DButton>
            <DButton
              disabled={!name.trim() || !phone || openingInvalid || busy}
              onClick={() => void save()}
            >
              {text.save}
            </DButton>
          </div>
        )
      }
    >
      {candidates ? (
        <MemberPanel className="p-5">
          <ExistingCustomerChoice
            candidates={candidates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            disabled={busy}
            copy={copy}
          />
        </MemberPanel>
      ) : (
        <div className="space-y-4">
          <MemberPanel className="p-5" ariaLabel={text.memberIdentity}>
            <MemberSectionLabel>{text.memberIdentity}</MemberSectionLabel>
            {member ? (
              <div className="mt-3 flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  <UserRound className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text)]">
                    {member.customer.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-[var(--color-text-muted)]">
                    <Hash className="size-3" aria-hidden="true" />
                    {member.memberNumber}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                {text.memberIdentityHint}
              </p>
            )}
          </MemberPanel>

          <MemberPanel className="p-5" ariaLabel={text.customerData}>
            <MemberSectionLabel>{text.customerData}</MemberSectionLabel>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              {member ? text.customerDataEditHint : text.customerDataEnrollHint}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DInput
                label={text.name}
                value={name}
                onChange={(value) => form.setField('name', value)}
                placeholder={text.namePlaceholder}
              />
              <DInput
                label={text.phone}
                value={form.values.phone}
                onChange={(value) => form.setField('phone', sanitizeNationalMemberPhone(value))}
                inputMode="tel"
                placeholder="081234567890"
                hint={phoneTyped && !phone ? undefined : text.phoneHint}
                error={phoneTyped && !phone ? text.phoneInvalid : undefined}
              />
              {!member && openingPointsAvailable ? (
                <DInput
                  label={text.openingPointsField}
                  value={form.values.openingPoints}
                  onChange={(value) => form.setField('openingPoints', sanitizePointsInput(value))}
                  inputMode="decimal"
                  placeholder="0"
                  hint={openingInvalid ? undefined : text.openingPointsFieldHint}
                  error={openingInvalid ? text.openingPointsFieldInvalid : undefined}
                  containerClassName="sm:col-span-2"
                />
              ) : null}
            </div>
          </MemberPanel>
        </div>
      )}
    </DDialog>
  );
}
