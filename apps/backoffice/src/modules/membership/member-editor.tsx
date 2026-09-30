import { DButton, DDialog, DInput, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { readStoredBackofficeLocale } from '../../app/localization/backoffice-localization';
import { findExistingCustomerCandidates } from './existing-customer-candidates';
import { ExistingCustomerChoice } from './existing-customer-choice';
import type { Customer, Member, MembersApi } from './members-api';
import { toCanonicalMemberPhone } from './member-phone';

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
 * When the phone already belongs to Customer(s) without a Membership, enrollment continues
 * through an explicit choice of the existing Customer instead of creating another one.
 */
export function MemberEditor({
  member,
  api,
  canLookupCustomers,
  done,
  close,
}: {
  member: Member | null;
  api: Pick<MembersApi, 'enroll' | 'enrollExisting' | 'searchCustomers' | 'updateCustomer'>;
  /** customers:read: without it a phone conflict only shows the specific message. */
  canLookupCustomers: boolean;
  done: () => void;
  close: () => void;
}) {
  const [name, setName] = useState(member?.customer.name ?? '');
  const [typedPhone, setTypedPhone] = useState(member?.customer.phoneE164 ?? '');
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<Customer[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { showToast } = useToast();
  const phone = toCanonicalMemberPhone(typedPhone);
  const copy = continuationCopy[readStoredBackofficeLocale()];

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
    if (!name.trim() || !phone || busy) return;
    setBusy(true);
    try {
      if (member) await api.updateCustomer(member, { name, phone });
      else await api.enroll({ name, phone });
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
      await api.enrollExisting({ customerId: selectedId });
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
      title={member ? 'Edit customer' : 'Enroll member'}
      description={
        member
          ? 'Update canonical Customer fields.'
          : 'A member needs only a name and a phone number.'
      }
      footer={
        candidates ? (
          <div className="flex gap-2">
            <DButton variant="secondary" disabled={busy} onClick={cancelContinuation}>
              {copy.cancel}
            </DButton>
            <DButton disabled={!selectedId || busy} onClick={() => void enrollExistingCustomer()}>
              {copy.makeMember}
            </DButton>
          </div>
        ) : (
          <DButton disabled={!name.trim() || !phone || busy} onClick={() => void save()}>
            Save
          </DButton>
        )
      }
    >
      {candidates ? (
        <ExistingCustomerChoice
          candidates={candidates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          disabled={busy}
          copy={copy}
        />
      ) : (
        <div className="space-y-4">
          <DInput label="Name" value={name} onChange={setName} />
          <DInput
            label="Phone"
            value={typedPhone}
            onChange={setTypedPhone}
            inputMode="tel"
            hint="For example 0812 3456 7890 or +62 812 3456 7890."
          />
        </div>
      )}
    </DDialog>
  );
}
