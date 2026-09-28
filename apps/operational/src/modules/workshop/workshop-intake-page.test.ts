import { describe, expect, it } from 'vitest';
import { canCreateWorkshopCustomer } from './workshop-intake-page';
import { formatPhoneForDisplay } from './workshop-intake-dialog';

describe('Workshop Intake customer-creation access', () => {
  it('gates new-Customer creation on customers:manage only', () => {
    expect(canCreateWorkshopCustomer(['customers:read', 'customers:manage'])).toBe(true);
    expect(canCreateWorkshopCustomer(['customers:read'])).toBe(false);
  });

  it('does not require Membership, POS, or Finance permissions to create a Customer', () => {
    expect(canCreateWorkshopCustomer(['customers:manage'])).toBe(true);
  });
});

describe('Workshop Intake phone display', () => {
  it('shows an Indonesian E.164 number in local grouped form without changing the stored value', () => {
    expect(formatPhoneForDisplay('+6281234567890')).toBe('0812 3456 7890');
    expect(formatPhoneForDisplay('+628111222333')).toBe('0811 1222 333');
  });
});
