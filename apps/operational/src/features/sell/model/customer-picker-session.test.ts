import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCustomerPickerSession } from './customer-picker-session';

describe('useCustomerPickerSession', () => {
  it('keeps its revision until a new transaction starts', () => {
    const { result, rerender } = renderHook(() => useCustomerPickerSession());
    const first = result.current.revision;
    rerender();
    expect(result.current.revision).toBe(first);
  });

  it('advances the revision only when a new transaction starts', () => {
    const { result } = renderHook(() => useCustomerPickerSession());
    const first = result.current.revision;
    act(() => result.current.startNewTransaction());
    expect(result.current.revision).toBe(first + 1);
    act(() => result.current.startNewTransaction());
    expect(result.current.revision).toBe(first + 2);
  });
});
