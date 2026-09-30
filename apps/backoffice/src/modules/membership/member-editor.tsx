import { DButton, DDialog, DInput, useToast } from '@digvation/ui';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import type { Member, MembersApi } from './members-api';
import { toCanonicalMemberPhone } from './member-phone';

/** Enrolls a new Member (name + phone only) or edits the canonical Customer of an existing one. */
export function MemberEditor({
  member,
  api,
  done,
  close,
}: {
  member: Member | null;
  api: Pick<MembersApi, 'enroll' | 'updateCustomer'>;
  done: () => void;
  close: () => void;
}) {
  const [name, setName] = useState(member?.customer.name ?? '');
  const [typedPhone, setTypedPhone] = useState(member?.customer.phoneE164 ?? '');
  const { showToast } = useToast();
  const phone = toCanonicalMemberPhone(typedPhone);

  const save = async () => {
    if (!name.trim() || !phone) return;
    try {
      if (member) await api.updateCustomer(member, { name, phone });
      else await api.enroll({ name, phone });
      done();
      close();
    } catch (error) {
      showToast({ variant: 'danger', title: normalizeBackofficeApiError(error).safeMessage });
    }
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
        <DButton disabled={!name.trim() || !phone} onClick={() => void save()}>
          Save
        </DButton>
      }
    >
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
    </DDialog>
  );
}
