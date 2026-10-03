import { describe, expect, it } from 'vitest';
import { customerCopy } from './customer-copy';

describe('Customer feature localization', () => {
  it('covers every Customer message in both supported languages', () => {
    for (const message of Object.values(customerCopy)) {
      expect(message.id.trim()).not.toBe('');
      expect(message.en.trim()).not.toBe('');
    }
    expect(customerCopy.Customers).toEqual({ id: 'Pelanggan', en: 'Customers' });
    expect(customerCopy.Regular).toEqual({ id: 'Pelanggan Umum', en: 'Regular Customer' });
  });
});
