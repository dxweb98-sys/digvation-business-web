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

  it('translates mechanic assignment copy and availability without leaking raw values', () => {
    expect(operationalCopy('Mechanic', 'id-ID')).toBe('Mekanik');
    expect(operationalCopy('Not assigned yet', 'id-ID')).toBe('Belum ada mekanik');
    expect(operationalCopy('Assign mechanic', 'id-ID')).toBe('Tugaskan mekanik');
    expect(operationalLabel('AVAILABLE', 'id-ID')).toBe('Tersedia');
    expect(operationalLabel('BUSY', 'id-ID')).toBe('Sibuk');
    expect(operationalLabel('INELIGIBLE', 'id-ID')).toBe('Tidak tersedia');
    expect(
      operationalCopy(
        'This mechanic is already working on another Work Order. Pause or finish it first.',
        'id-ID',
      ),
    ).toBe('Mekanik ini sedang mengerjakan Work Order lain. Jeda atau selesaikan dulu.');
    expect(operationalCopy('Assign mechanic', 'en-US')).toBe('Assign mechanic');
  });

  it('translates the Workshop work-status lifecycle vocabulary', () => {
    expect(operationalLabel('WAITING', 'id-ID')).toBe('Menunggu');
    expect(operationalLabel('ASSIGNED', 'id-ID')).toBe('Ditugaskan');
    expect(operationalLabel('IN_PROGRESS', 'id-ID')).toBe('Dikerjakan');
    expect(operationalLabel('PAUSED', 'id-ID')).toBe('Dijeda');
    expect(operationalLabel('DONE', 'id-ID')).toBe('Selesai');
    expect(operationalLabel('CANCELLED', 'id-ID')).toBe('Dibatalkan');
  });

  it('keeps one Workshop vocabulary: Pelanggan, Cabang, Work Order, and the lifecycle verbs', () => {
    const id = (key: string) => operationalCopy(key, 'id-ID');
    expect(id('New customer')).toBe('Pelanggan baru');
    expect(id('Find customer')).toBe('Cari pelanggan');
    expect(id('Continue to Vehicle')).toBe('Lanjut ke Kendaraan');
    expect(id('Continue to Complaint')).toBe('Lanjut ke Keluhan');
    expect(id('Complaint & Summary')).toBe('Keluhan & Ringkasan');
    expect(id('New vehicle')).toBe('Kendaraan baru');
    expect(id('Search Work Orders, customers, or vehicles')).toBe(
      'Cari no. Work Order, pelanggan, atau kendaraan',
    );
    expect(id('Select a Location to continue.')).toBe('Pilih cabang aktif dulu.');
    expect(id('Work Orders at the active branch.')).toBe('Work Order di cabang aktif.');
    expect(id('Pause')).toBe('Jeda');
    expect(id('Resume')).toBe('Lanjutkan');
    expect(id('Complete')).toBe('Selesaikan');
    expect(id('Cancel work order')).toBe('Batalkan Work Order');
    expect(id('Yes, cancel')).toBe('Ya, batalkan');
    // Every Workshop message must be translated, never fall back to English.
    for (const key of [
      'No Work Orders at this branch yet.',
      'No more actions for this Work Order.',
      'You do not have permission to change this Work Order.',
      'This Work Order was just changed. Open it again.',
      'Check your connection, then try again.',
    ]) {
      expect(id(key)).not.toBe(key);
    }
  });
});
