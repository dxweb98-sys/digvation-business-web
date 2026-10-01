import type {
  FinancialAccount,
  FinancialAccountType,
  PaymentMethod,
} from '../api/financial-accounts-api';

export const FINANCIAL_ACCOUNT_TYPES: readonly FinancialAccountType[] = [
  'CASH',
  'BANK',
  'E_WALLET',
  'QRIS',
];

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CASH',
  'BANK_TRANSFER',
  'WALLET',
  'QRIS',
];

/**
 * Mirrors Runtime `ACCOUNT_TYPES_BY_PAYMENT_METHOD` for selection UX only; Runtime still decides.
 * QRIS settles to a dedicated QRIS account or, as before, to a bank or e-wallet account.
 */
export const ACCOUNT_TYPES_BY_PAYMENT_METHOD: Record<
  PaymentMethod,
  readonly FinancialAccountType[]
> = {
  CASH: ['CASH'],
  BANK_TRANSFER: ['BANK'],
  WALLET: ['E_WALLET'],
  QRIS: ['QRIS', 'BANK', 'E_WALLET'],
};

/** The checkout method a newly created account is routed for by default. */
export const DEFAULT_PAYMENT_METHOD_BY_ACCOUNT_TYPE: Record<FinancialAccountType, PaymentMethod> = {
  CASH: 'CASH',
  BANK: 'BANK_TRANSFER',
  E_WALLET: 'WALLET',
  QRIS: 'QRIS',
};

export function isAccountCompatible(method: PaymentMethod, type: FinancialAccountType) {
  return ACCOUNT_TYPES_BY_PAYMENT_METHOD[method].includes(type);
}

/** Cash is on-site; every other account type settles to an external institution. */
export function requiresDestinationDetails(type: FinancialAccountType) {
  return type !== 'CASH';
}

export const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  CASH: 'Cash account',
  BANK: 'Bank account',
  E_WALLET: 'E-wallet account',
  QRIS: 'QRIS account',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  WALLET: 'E-wallet',
  QRIS: 'QRIS',
};

export interface DestinationFieldCopy {
  section: string;
  institution: string;
  institutionPlaceholder: string;
  reference: string;
  referencePlaceholder: string;
  holder: string;
  holderPlaceholder: string;
}

/** Copy keys for the generic settlement-destination fields, by account type. */
export const DESTINATION_FIELD_COPY: Record<
  Exclude<FinancialAccountType, 'CASH'>,
  DestinationFieldCopy
> = {
  BANK: {
    section: 'Bank details',
    institution: 'Bank / institution',
    institutionPlaceholder: 'For example, BCA',
    reference: 'Account number',
    referencePlaceholder: 'For example, 1234567890',
    holder: 'Account holder name',
    holderPlaceholder: 'For example, PT Digvation Indonesia',
  },
  E_WALLET: {
    section: 'E-wallet details',
    institution: 'Wallet provider',
    institutionPlaceholder: 'For example, GoPay',
    reference: 'Wallet account',
    referencePlaceholder: 'For example, 081234567890',
    holder: 'Account holder name',
    holderPlaceholder: 'For example, PT Digvation Indonesia',
  },
  QRIS: {
    section: 'QRIS details',
    institution: 'QRIS provider / institution',
    institutionPlaceholder: 'For example, BCA',
    reference: 'Merchant ID / QRIS reference',
    referencePlaceholder: 'For example, ID1023456789012',
    holder: 'Merchant name',
    holderPlaceholder: 'For example, Toko Maju Jaya',
  },
};

export function destinationFieldCopy(type: FinancialAccountType) {
  return type === 'CASH' ? null : DESTINATION_FIELD_COPY[type];
}

export function accountDestinationSummary(
  account: Pick<FinancialAccount, 'type' | 'institutionName' | 'accountReference'>,
) {
  if (account.type === 'CASH') return null;
  return [account.institutionName, account.accountReference].filter(Boolean).join(' · ') || null;
}

/** Quiet placeholder for absent identifiers, e.g. legacy accounts created without a code. */
export const EMPTY_VALUE = '—';

export function displayCode(code: string | null | undefined) {
  return code?.trim() || EMPTY_VALUE;
}
