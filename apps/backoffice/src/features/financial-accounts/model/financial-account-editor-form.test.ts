import { describe, expect, it } from 'vitest';

import type { FinancialAccount } from '../api/financial-accounts-api';
import {
  createFinancialAccountEditorForm,
  toCreateFinancialAccountInput,
  toUpdateFinancialAccountInput,
  validateFinancialAccountEditorForm,
  type FinancialAccountEditorForm,
} from './financial-account-editor-form';
import {
  accountDestinationSummary,
  destinationFieldCopy,
  displayCode,
} from './financial-account-model';

const account: FinancialAccount = {
  id: 'account-1',
  code: 'ACC-000001',
  name: 'QRIS Toko',
  type: 'QRIS',
  currency: 'IDR',
  institutionName: 'BCA',
  accountReference: 'ID1023456789',
  accountHolderName: null,
  status: 'ACTIVE',
  version: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const form = (change: Partial<FinancialAccountEditorForm> = {}) => ({
  ...createFinancialAccountEditorForm(null),
  name: 'Kas Utama',
  ...change,
});

describe('financial account editor form', () => {
  it('starts a new account as a blank IDR cash account', () => {
    expect(createFinancialAccountEditorForm(null)).toEqual({
      code: '',
      name: '',
      type: 'CASH',
      currency: 'IDR',
      institutionName: '',
      accountReference: '',
      accountHolderName: '',
    });
  });

  it('hydrates an existing account, including a legacy account without a code', () => {
    expect(createFinancialAccountEditorForm(account)).toMatchObject({
      code: 'ACC-000001',
      type: 'QRIS',
      institutionName: 'BCA',
      accountHolderName: '',
    });
    expect(createFinancialAccountEditorForm({ ...account, code: null }).code).toBe('');
  });

  it('treats an empty code as valid so Runtime can generate one', () => {
    expect(validateFinancialAccountEditorForm(form(), { fresh: true }).valid).toBe(true);
  });

  it('omits an empty code from the create request', () => {
    const input = toCreateFinancialAccountInput(form({ code: '   ' }));
    expect(input).not.toHaveProperty('code');
    expect(input).toEqual({
      name: 'Kas Utama',
      type: 'CASH',
      currency: 'IDR',
      institutionName: null,
      accountReference: null,
      accountHolderName: null,
    });
  });

  it('normalizes a custom code to the uppercase Runtime contract', () => {
    expect(toCreateFinancialAccountInput(form({ code: ' smoke_bank_custom ' })).code).toBe(
      'SMOKE_BANK_CUSTOM',
    );
    expect(
      validateFinancialAccountEditorForm(form({ code: 'bad code!' }), { fresh: true }).code,
    ).toBe('CODE_INVALID');
  });

  it('requires a name and a 3-letter currency', () => {
    const invalid = validateFinancialAccountEditorForm(form({ name: ' ', currency: 'RP' }), {
      fresh: true,
    });
    expect(invalid).toMatchObject({
      valid: false,
      name: 'NAME_REQUIRED',
      currency: 'CURRENCY_INVALID',
    });
  });

  it('requires QRIS provider and merchant reference like other non-cash accounts', () => {
    const qris = form({ type: 'QRIS' });
    expect(validateFinancialAccountEditorForm(qris, { fresh: true })).toMatchObject({
      valid: false,
      institutionName: 'INSTITUTION_REQUIRED',
      accountReference: 'REFERENCE_REQUIRED',
    });
    const complete = form({
      type: 'QRIS',
      institutionName: ' BCA ',
      accountReference: ' ID1023456789 ',
      accountHolderName: ' ',
    });
    expect(validateFinancialAccountEditorForm(complete, { fresh: true }).valid).toBe(true);
    expect(toCreateFinancialAccountInput(complete)).toMatchObject({
      type: 'QRIS',
      institutionName: 'BCA',
      accountReference: 'ID1023456789',
      accountHolderName: null,
    });
  });

  it('labels QRIS destination fields for a merchant settlement', () => {
    expect(destinationFieldCopy('QRIS')).toMatchObject({
      institution: 'QRIS provider / institution',
      reference: 'Merchant ID / QRIS reference',
      holder: 'Merchant name',
    });
    expect(destinationFieldCopy('CASH')).toBeNull();
  });

  it('drops institution details typed before switching to cash', () => {
    const input = toCreateFinancialAccountInput(
      form({ type: 'CASH', institutionName: 'BCA', accountReference: '123' }),
    );
    expect(input).toMatchObject({ institutionName: null, accountReference: null });
  });

  it('sends only mutable fields on update, never code, type, or currency', () => {
    const update = toUpdateFinancialAccountInput(createFinancialAccountEditorForm(account));
    expect(update).toEqual({
      name: 'QRIS Toko',
      institutionName: 'BCA',
      accountReference: 'ID1023456789',
      accountHolderName: null,
    });
    expect(
      validateFinancialAccountEditorForm(
        { ...createFinancialAccountEditorForm(account), code: '', currency: '' },
        { fresh: false },
      ).valid,
    ).toBe(true);
  });

  it('renders a missing legacy code and destination quietly', () => {
    expect(displayCode(null)).toBe('—');
    expect(displayCode('ACC-000001')).toBe('ACC-000001');
    expect(accountDestinationSummary(account)).toBe('BCA · ID1023456789');
    expect(
      accountDestinationSummary({ type: 'CASH', institutionName: null, accountReference: null }),
    ).toBeNull();
  });
});
