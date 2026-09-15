import { describe, expect, it } from 'vitest';

import { operationalCopy, operationalLabel } from './operational-localization';

describe('operational localization', () => {
  it('translates shared copy using the configured locale', () => {
    expect(operationalCopy('Cart', 'id-ID')).toBe('Keranjang');
    expect(operationalCopy('Cart', 'en-US')).toBe('Cart');
    expect(operationalCopy('Checkout', 'id-ID')).toBe('Pembayaran');
    expect(operationalCopy('Checkout', 'en-US')).toBe('Checkout');
  });

  it('translates technical values without exposing raw enum values', () => {
    expect(operationalLabel('FINALIZED', 'id-ID')).toBe('Selesai');
    expect(operationalLabel('FINALIZED', 'en-US')).toBe('Completed');
    expect(operationalLabel('IN_PROGRESS', 'id-ID')).toBe('Dikerjakan');
    expect(operationalLabel('IN_PROGRESS', 'en-US')).toBe('In progress');
  });
});
