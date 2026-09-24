import { useCallback, useMemo, useState } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface LimitOffsetPagination {
  limit: number;
  offset: number;
}

export interface UsePaginationStateOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function toLimitOffsetPagination({
  page,
  pageSize,
}: PaginationState): LimitOffsetPagination {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;

  return {
    limit: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}

/**
 * UI pagination state for Runtime list contracts that use limit/offset.
 *
 * Keep page/pageSize in the UI. Convert to limit/offset only at the query boundary.
 */
export function usePaginationState({
  initialPage = 1,
  initialPageSize = 10,
}: UsePaginationStateOptions = {}) {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage > 0 ? nextPage : 1);
  }, []);

  const setPageSize = useCallback((nextPageSize: number) => {
    setPageSizeState(nextPageSize > 0 ? nextPageSize : initialPageSize);
    setPageState(1);
  }, [initialPageSize]);

  const resetPage = useCallback(() => {
    setPageState(1);
  }, []);

  const request = useMemo(
    () => toLimitOffsetPagination({ page, pageSize }),
    [page, pageSize],
  );

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    resetPage,
    request,
  };
}
