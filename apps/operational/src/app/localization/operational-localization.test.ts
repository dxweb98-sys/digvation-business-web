import { describe, expect, it } from 'vitest';

import {
  operationalCopy,
  operationalLabel,
  resolveOperationalLocale,
} from './operational-localization';

describe('operational localization', () => {
  it('resolves the configured runtime locale', () => {
    expect(resolveOperationalLocale('en-US')).toBe('en-US');
    expect(resolveOperationalLocale('id-ID')).toBe('id-ID');
    expect(resolveOperationalLocale('unknown')).toBe('id-ID');
  });

  it('translates shared copy using the configured locale', () => {
    expect(operationalCopy('Cart', 'id-ID')).toBe('Keranjang');
    expect(operationalCopy('Cart', 'en-US')).toBe('Cart');
    expect(operationalCopy('Checkout', 'id-ID')).toBe('Pembayaran');
    expect(operationalCopy('Checkout', 'en-US')).toBe('Checkout');
  });

  it('translates POS copy without leaking English into Indonesian UI', () => {
    expect(operationalCopy('Cart is not ready for payment', 'id-ID')).toBe(
      'Keranjang belum siap dibayar',
    );
    expect(operationalCopy('Refund required', 'id-ID')).toBe('Pengembalian dana diperlukan');
    expect(operationalCopy('Employees for service', 'id-ID')).toBe('Karyawan untuk layanan');
    expect(operationalCopy('Main branch', 'id-ID')).toBe('Cabang utama');
    expect(operationalCopy('Cart is not ready for payment', 'en-US')).toBe(
      'Cart is not ready for payment',
    );
  });

  it('translates technical values without exposing raw enum values', () => {
    expect(operationalLabel('FINALIZED', 'id-ID')).toBe('Selesai');
    expect(operationalLabel('FINALIZED', 'en-US')).toBe('Completed');
    expect(operationalLabel('IN_PROGRESS', 'id-ID')).toBe('Dikerjakan');
    expect(operationalLabel('IN_PROGRESS', 'en-US')).toBe('In progress');
    expect(operationalLabel('BACKOFFICE', 'id-ID')).toBe('Backoffice');
    expect(operationalLabel('OPERATIONAL', 'id-ID')).toBe('Operational');
    expect(operationalLabel('SYSTEM', 'id-ID')).toBe('Sistem');
  });
});
