import { describe, expect, it } from 'vitest';

import {
  BILLING_STATE_BADGE,
  BILLING_STATE_LABEL,
  canReadBilling,
  canValidateBilling,
  formatTaxRate,
} from './workshop-billing-model';

const READ = ['workshop-billing:read-sensitive'];
const BOTH = ['workshop-billing:read-sensitive', 'workshop-billing:validate'];

describe('canReadBilling', () => {
  it.each(['WAITING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED', 'DONE'] as const)(
    'is allowed while %s with the sensitive billing permission',
    (status) => {
      expect(canReadBilling(status, READ)).toBe(true);
    },
  );

  it('never reads billing of a cancelled Work Order', () => {
    expect(canReadBilling('CANCELLED', READ)).toBe(false);
  });

  it('needs workshop-billing:read-sensitive; validate alone or Work Order read do not reveal amounts', () => {
    expect(canReadBilling('IN_PROGRESS', ['workshop-billing:validate'])).toBe(false);
    expect(canReadBilling('IN_PROGRESS', ['work-orders:read'])).toBe(false);
  });
});

describe('canValidateBilling', () => {
  it.each(['IN_PROGRESS', 'PAUSED', 'DONE'] as const)('is offered while %s', (status) => {
    expect(canValidateBilling(status, BOTH)).toBe(true);
  });

  it.each(['WAITING', 'ASSIGNED', 'CANCELLED'] as const)('is never offered while %s', (status) => {
    expect(canValidateBilling(status, BOTH)).toBe(false);
  });

  it('needs both workshop-billing:validate and the sensitive read permission', () => {
    expect(canValidateBilling('IN_PROGRESS', READ)).toBe(false);
    expect(canValidateBilling('IN_PROGRESS', ['workshop-billing:validate'])).toBe(false);
  });
});

describe('formatTaxRate', () => {
  it.each([
    ['0.11', '11'],
    ['0.110000000000000000', '11'],
    ['0.125', '12.5'],
    ['0.075', '7.5'],
    ['0.07', '7'],
    ['0.2', '20'],
    ['1', '100'],
    ['0', '0'],
  ])('shows %s as %s%%', (rate, shown) => {
    expect(formatTaxRate(rate)).toBe(shown);
  });
});

describe('validation state presentation', () => {
  it('uses the natural labels and never the enum name', () => {
    expect(BILLING_STATE_LABEL).toEqual({
      DRAFT: 'Not validated',
      VALIDATED: 'Validated',
      REVALIDATION_REQUIRED: 'Needs revalidation',
    });
    expect(BILLING_STATE_BADGE.REVALIDATION_REQUIRED).toBe('warning');
    expect(BILLING_STATE_BADGE.VALIDATED).toBe('success');
  });
});
