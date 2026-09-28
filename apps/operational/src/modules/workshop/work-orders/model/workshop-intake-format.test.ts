import { describe, expect, it } from 'vitest';
import { canCreateWorkshopCustomer } from './workshop-intake-format';

describe('Workshop Intake customer-creation access', () => {
  it('gates new-Customer creation on customers:manage only', () => {
    expect(canCreateWorkshopCustomer(['customers:read', 'customers:manage'])).toBe(true);
    expect(canCreateWorkshopCustomer(['customers:read'])).toBe(false);
  });

  it('does not require Membership, POS, or Finance permissions to create a Customer', () => {
    expect(canCreateWorkshopCustomer(['customers:manage'])).toBe(true);
  });
});
