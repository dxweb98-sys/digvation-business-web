import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  toLimitOffsetPagination,
  usePaginationState,
} from './use-pagination-state';

describe('pagination state', () => {
  it('maps UI page/pageSize to the Runtime limit/offset contract', () => {
    expect(toLimitOffsetPagination({ page: 3, pageSize: 20 })).toEqual({
      limit: 20,
      offset: 40,
    });
  });

  it('resets to the first page when page size changes', () => {
    const { result } = renderHook(() =>
      usePaginationState({ initialPage: 3, initialPageSize: 10 }),
    );

    act(() => result.current.setPageSize(25));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(25);
    expect(result.current.request).toEqual({ limit: 25, offset: 0 });
  });
});
