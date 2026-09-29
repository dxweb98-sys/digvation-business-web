import type {
  LoyaltyConfiguration,
  LoyaltyEarnWhileRedeemingPolicy,
  LoyaltyEarningBehavior,
  LoyaltyEarningMode,
  UpdateLoyaltyConfigurationInput,
} from './loyalty-api';

/**
 * The whole editable configuration as text, so switching the earning mode never discards
 * what was typed for the other mode. Runtime stays authoritative for every rule.
 */
export interface LoyaltyConfigurationDraft {
  pointValue: string;
  earningMode: LoyaltyEarningMode;
  behavior: LoyaltyEarningBehavior;
  pointsPerUnit: string;
  amountPerStep: string;
  pointsPerStep: string;
  earnWhileRedeeming: boolean;
}

export interface LoyaltyConfigurationDraftErrors {
  pointValue?: string;
  pointsPerUnit?: string;
  amountPerStep?: string;
  pointsPerStep?: string;
}

// A positive exact decimal with at most four fraction digits: "1", "200000", "0.5", "0.0001".
const POSITIVE_DECIMAL = /^(?:[1-9]\d*(?:\.\d{1,4})?|0\.(?=\d{1,4}$)\d*[1-9]\d*)$/;
const NON_NEGATIVE_INTEGER = /^\d+$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** Stored amounts arrive as NUMERIC text ("200000.0000"); show them without trailing zeros. */
export function trimDecimal(value: string | null | undefined): string {
  if (!value) return '';
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

export function draftFromConfiguration(
  configuration: LoyaltyConfiguration,
): LoyaltyConfigurationDraft {
  return {
    pointValue: trimDecimal(configuration.pointValue),
    earningMode: configuration.earningMode,
    behavior: configuration.defaultEarningBehavior,
    pointsPerUnit: String(configuration.defaultFixedPointsPerUnit),
    amountPerStep: trimDecimal(configuration.transactionAmountPerStep),
    pointsPerStep:
      configuration.transactionPointsPerStep === null
        ? ''
        : String(configuration.transactionPointsPerStep),
    earnWhileRedeeming: configuration.earnWhileRedeemingPolicy === 'EARN_WHEN_REDEEMING',
  };
}

/**
 * Validates the draft. Only the active mode's fields are required; the inactive mode's values
 * are kept as they are, but must be valid if they were entered.
 */
export function validateDraft(draft: LoyaltyConfigurationDraft): LoyaltyConfigurationDraftErrors {
  const errors: LoyaltyConfigurationDraftErrors = {};
  if (!draft.pointValue.trim()) errors.pointValue = 'Nilai poin wajib diisi.';

  if (
    draft.earningMode === 'PER_ITEM' &&
    draft.behavior === 'FIXED' &&
    !NON_NEGATIVE_INTEGER.test(draft.pointsPerUnit.trim())
  )
    errors.pointsPerUnit = 'Isi bilangan bulat 0 atau lebih.';

  const amount = draft.amountPerStep.trim();
  const points = draft.pointsPerStep.trim();
  const total = draft.earningMode === 'TRANSACTION_TOTAL';
  if ((total || amount) && !POSITIVE_DECIMAL.test(amount))
    errors.amountPerStep = 'Isi nominal lebih dari 0.';
  if ((total || points) && !POSITIVE_INTEGER.test(points))
    errors.pointsPerStep = 'Isi bilangan bulat lebih dari 0.';
  return errors;
}

export function isDraftValid(draft: LoyaltyConfigurationDraft): boolean {
  return Object.keys(validateDraft(draft)).length === 0;
}

/** The complete configuration resource. Values for the inactive mode are sent along, not erased. */
export function updateInputFromDraft(
  draft: LoyaltyConfigurationDraft,
  expectedVersion: number,
): UpdateLoyaltyConfigurationInput {
  const earnWhileRedeemingPolicy: LoyaltyEarnWhileRedeemingPolicy = draft.earnWhileRedeeming
    ? 'EARN_WHEN_REDEEMING'
    : 'NO_EARN_WHEN_REDEEMING';
  const amount = draft.amountPerStep.trim();
  const points = draft.pointsPerStep.trim();
  return {
    expectedVersion,
    pointValue: draft.pointValue.trim(),
    earningMode: draft.earningMode,
    defaultEarningBehavior: draft.behavior,
    defaultFixedPointsPerUnit: draft.behavior === 'FIXED' ? Number(draft.pointsPerUnit) : 0,
    earnWhileRedeemingPolicy,
    ...(amount ? { transactionAmountPerStep: amount } : {}),
    ...(points ? { transactionPointsPerStep: Number(points) } : {}),
  };
}

function formatAmount(value: bigint | string, currency: string, locale: string): string {
  const number = typeof value === 'bigint' ? value : Number(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
    .format(number)
    .replace(/[\u00a0\u202f]/g, '');
}

/**
 * Human-readable transaction example for the UI only. Whole-number amounts use exact BigInt
 * multiplication for the second example; nothing here is a rate or a Runtime calculation.
 */
export function transactionEarningExample(input: {
  amountPerStep: string;
  pointsPerStep: string;
  currency: string;
  locale?: string;
}): { rule: string; multiple: string | null } | null {
  const amount = input.amountPerStep.trim();
  const points = input.pointsPerStep.trim();
  if (!POSITIVE_DECIMAL.test(amount) || !POSITIVE_INTEGER.test(points)) return null;
  const locale = input.locale ?? 'id-ID';
  const rule = `Setiap ${formatAmount(amount, input.currency, locale)} → ${points} poin`;
  if (!/^\d+$/.test(amount)) return { rule, multiple: null };
  const doubledAmount = BigInt(amount) * 2n;
  const doubledPoints = BigInt(points) * 2n;
  return {
    rule,
    multiple: `${formatAmount(doubledAmount, input.currency, locale)} → ${doubledPoints} poin`,
  };
}
