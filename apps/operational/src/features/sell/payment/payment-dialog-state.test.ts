import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { usePaymentDialogStep } from './payment-dialog-state';

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
