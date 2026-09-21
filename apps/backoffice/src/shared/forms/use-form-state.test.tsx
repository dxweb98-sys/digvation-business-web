import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFormState } from './use-form-state';

describe('useFormState', () => {
  it('updates one field without replacing the rest of the form', () => {
    const { result } = renderHook(() =>
      useFormState({ name: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' }),
    );

    act(() => result.current.setField('name', 'Haircut'));

    expect(result.current.values).toEqual({
      name: 'Haircut',
      status: 'ACTIVE',
    });
  });

  it('patches and can reset to a new baseline', () => {
    const { result } = renderHook(() => useFormState({ name: '', code: '' }));

    act(() => result.current.patch({ name: 'Haircut', code: 'SRV-1' }));
    act(() => result.current.reset({ name: 'Massage', code: 'SRV-2' }));
    act(() => result.current.setField('name', 'Changed'));
    act(() => result.current.reset());

    expect(result.current.values).toEqual({
      name: 'Massage',
      code: 'SRV-2',
    });
  });
});
