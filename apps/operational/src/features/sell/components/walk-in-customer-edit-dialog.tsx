import { DAlert, DButton, DDialog, DInput } from '@digvation-labs/ui';
import { useRef, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { cashierTransactionErrorMessage } from '../cashier-transaction-errors';
import type { SaleCustomer } from '../cashier-transaction.types';
import { sanitizePhoneInput, toCanonicalPhone } from '../customer-input';
import { formatWhatsappNumber } from '../receipt-delivery';
import { useRetainedValue } from '../use-retained-value';

/** The unfinished transaction whose walk-in customer is being corrected. */
export interface WalkInCustomerEditTarget {
  readonly saleId: string;
  /** Display transaction number. */
  readonly reference: string;
  readonly customer: Pick<SaleCustomer, 'name' | 'phoneE164'>;
}

const localCopy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  'Edit customer': { 'id-ID': 'Edit pelanggan', 'en-US': 'Edit customer' },
  'Correct the name or WhatsApp number of this regular customer. It applies to this transaction only while it is not completed.':
    {
      'id-ID':
        'Perbaiki nama atau nomor WhatsApp pelanggan umum ini. Berlaku untuk transaksi ini selama belum selesai.',
      'en-US':
        'Correct the name or WhatsApp number of this regular customer. It applies to this transaction only while it is not completed.',
    },
  'Once the transaction is completed the customer data is locked.': {
    'id-ID': 'Setelah transaksi selesai, data pelanggan tidak dapat diubah lagi.',
    'en-US': 'Once the transaction is completed the customer data is locked.',
  },
  'Customer name': { 'id-ID': 'Nama Pelanggan', 'en-US': 'Customer Name' },
  'Name placeholder': { 'id-ID': 'Contoh: Andir Saputra', 'en-US': 'Example: Andir Saputra' },
  'WhatsApp / phone': { 'id-ID': 'Nomor WhatsApp / Telepon', 'en-US': 'WhatsApp / Phone' },
  'Phone placeholder': { 'id-ID': 'Contoh: 0812 3456 7890', 'en-US': 'Example: 0812 3456 7890' },
  'Enter the customer name.': {
    'id-ID': 'Masukkan nama pelanggan.',
    'en-US': 'Enter the customer name.',
  },
  'Enter a valid WhatsApp number, for example 0812 3456 7890.': {
    'id-ID': 'Masukkan nomor WhatsApp yang valid, contoh 0812 3456 7890.',
    'en-US': 'Enter a valid WhatsApp number, for example 0812 3456 7890.',
  },
  Cancel: { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  Save: { 'id-ID': 'Simpan', 'en-US': 'Save' },
};

/**
 * Typo correction of a regular (walk-in) customer while the transaction is still open.
 *
 * Runtime's Sales ownership applies it to the transaction's own customer snapshot; no Customer
 * record is created and a Member is never edited here. After completion the snapshot is
 * immutable, so the entry point is simply not offered.
 */
export function WalkInCustomerEditDialog({
  target: requestedTarget,
  onClose,
  onSave,
}: {
  target: WalkInCustomerEditTarget | null;
  onClose: () => void;
  /** Persists the correction (name and canonical E.164 number); rejects with the API error. */
  onSave: (saleId: string, input: { name: string; phone: string }) => Promise<void>;
}) {
  const { locale } = useOperationalLocalization();
  // Fields keep their values while the dialog plays its close transition.
  const target = useRetainedValue(requestedTarget);
  const text = (value: string) => localCopy[value]?.[locale] ?? value;
  const saleId = target?.saleId ?? null;
  const [name, setName] = useState(target?.customer.name ?? '');
  const [phone, setPhone] = useState(
    target ? formatWhatsappNumber(target.customer.phoneE164) : '',
  );
  const [touched, setTouched] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const inFlight = useRef(false);
  // The form always starts from the current transaction snapshot of whichever sale is opened.
  const [openedFor, setOpenedFor] = useState<string | null>(saleId);
  if (openedFor !== saleId) {
    setOpenedFor(saleId);
    setName(target?.customer.name ?? '');
    setPhone(target ? formatWhatsappNumber(target.customer.phoneE164) : '');
    setTouched(false);
    setRequestError(null);
  }

  const trimmedName = name.replace(/\s+/g, ' ').trim();
  const canonical = toCanonicalPhone(phone);
  const nameError = touched && !trimmedName ? text('Enter the customer name.') : undefined;
  const phoneError =
    touched && !canonical
      ? text('Enter a valid WhatsApp number, for example 0812 3456 7890.')
      : undefined;
  const unchanged =
    Boolean(target) &&
    trimmedName === target!.customer.name &&
    canonical === target!.customer.phoneE164;

  const submit = async () => {
    if (!target || inFlight.current) return;
    setTouched(true);
    if (!trimmedName || !canonical) return;
    inFlight.current = true;
    setSaving(true);
    setRequestError(null);
    try {
      await onSave(target.saleId, { name: trimmedName, phone: canonical });
    } catch (error) {
      setRequestError(cashierTransactionErrorMessage(error, locale));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={Boolean(requestedTarget)}
      title={text('Edit customer')}
      description={target?.reference ?? ''}
      onClose={onClose}
      ariaLabel={text('Edit customer')}
      closeOnEscape={!isSaving}
      closeOnOverlay={!isSaving}
      className="pos-reference-dialog w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="outline" disabled={isSaving} onClick={onClose}>
            {text('Cancel')}
          </DButton>
          <DButton
            loading={isSaving}
            disabled={isSaving || unchanged}
            onClick={() => void submit()}
          >
            {text('Save')}
          </DButton>
        </div>
      }
    >
      <div className="mt-4 space-y-4">
        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          {text(
            'Correct the name or WhatsApp number of this regular customer. It applies to this transaction only while it is not completed.',
          )}
        </p>
        <div className="space-y-3">
          <DInput
            label={text('Customer name')}
            placeholder={text('Name placeholder')}
            value={name}
            onChange={setName}
            autoComplete="off"
            disabled={isSaving}
            error={nameError}
          />
          <DInput
            label={text('WhatsApp / phone')}
            placeholder={text('Phone placeholder')}
            value={phone}
            onChange={(value) => setPhone(sanitizePhoneInput(value))}
            inputMode="tel"
            autoComplete="off"
            disabled={isSaving}
            error={phoneError}
          />
        </div>
        <p className="text-xs leading-5 text-[var(--color-text-muted)]">
          {text('Once the transaction is completed the customer data is locked.')}
        </p>
        {requestError ? <DAlert variant="danger">{requestError}</DAlert> : null}
      </div>
    </DDialog>
  );
}
