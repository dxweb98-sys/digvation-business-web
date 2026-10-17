import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  useOutstandingBalanceReset,
  usePaymentAllocationMode,
  usePaymentDialogStep,
} from './payment-dialog-state';

describe('usePaymentAllocationMode', () => {
  it('returns to the full balance when the outstanding amount changes, not on a failed attempt', () => {
    const { result, rerender } = renderHook(
      ({ outstanding }) => usePaymentAllocationMode(true, outstanding),
      { initialProps: { outstanding: '166500.0000' } },
    );
    act(() => result.current[1]('SPLIT'));
    rerender({ outstanding: '166500.0000' });
    expect(result.current[0]).toBe('SPLIT');

    rerender({ outstanding: '116500.0000' });
    expect(result.current[0]).toBe('FULL');
  });

  it('keeps the chosen mode without an outstanding amount, and resets it on reopen', () => {
    const { result, rerender } = renderHook(({ open }) => usePaymentAllocationMode(open), {
      initialProps: { open: true },
    });
    act(() => result.current[1]('SPLIT'));
    rerender({ open: true });
    expect(result.current[0]).toBe('SPLIT');

    rerender({ open: false });
    rerender({ open: true });
    expect(result.current[0]).toBe('FULL');
  });
});

describe('usePaymentDialogStep', () => {
  it('keeps the step it was closed from while the dialog closes', () => {
    const { result, rerender } = renderHook(({ open }) => usePaymentDialogStep(open), {
      initialProps: { open: true },
    });
    act(() => result.current[1]('review'));
    expect(result.current[0]).toBe('review');

    // A settled confirmation closes the dialog and returns its form to editing in one batch.
    act(() => {
      result.current[1]('edit');
      rerender({ open: false });
    });
    expect(result.current[0]).toBe('review');
  });

  it('does not snap a closing confirmation back to editing', () => {
    const { result, rerender } = renderHook(({ open }) => usePaymentDialogStep(open), {
      initialProps: { open: true },
    });
    act(() => result.current[1]('review'));
    rerender({ open: false });
    act(() => result.current[1]('edit'));
    expect(result.current[0]).toBe('review');
  });

  it('returns to editing while open, and on reopen', () => {
    const { result, rerender } = renderHook(({ open }) => usePaymentDialogStep(open), {
      initialProps: { open: true },
    });
    act(() => result.current[1]('review'));
    act(() => result.current[1]('edit'));
    expect(result.current[0]).toBe('edit');

    act(() => result.current[1]('review'));
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current[0]).toBe('edit');
  });
});

describe('useOutstandingBalanceReset', () => {
  it('prepares the new balance once when it changes, never for an unchanged one', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(
      ({ outstanding }) => useOutstandingBalanceReset(outstanding, onChange),
      { initialProps: { outstanding: null as string | null } },
    );
    // 200.000 total, 80.000 paid: 120.000 due when the dialog opens.
    rerender({ outstanding: '120000.0000' });
    expect(onChange).toHaveBeenLastCalledWith('120000.0000');
    rerender({ outstanding: '120000.0000' });
    expect(onChange).toHaveBeenCalledTimes(1);
    // A 50.000 item is added: 170.000 is now due.
    rerender({ outstanding: '170000.0000' });
    expect(onChange).toHaveBeenLastCalledWith('170000.0000');
    // The dialog closes: nothing to prepare.
    rerender({ outstanding: null });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
