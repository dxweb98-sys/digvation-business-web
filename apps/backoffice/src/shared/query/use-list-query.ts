import {
  useQuery,
  type QueryKey,
} from '@tanstack/react-query';

import type {
  LimitOffsetPagination,
  PaginationState,
} from './use-pagination-state';
import { toLimitOffsetPagination } from './use-pagination-state';

export interface OffsetPageResponse<TItem> {
  items: TItem[];
  limit: number;
  offset: number;
  total?: number;
}

export interface UseListQueryOptions<TData> {
  queryKey: QueryKey;
  queryFn: (pagination?: LimitOffsetPagination) => Promise<TData>;
  enabled?: boolean;
  staleTime?: number;
  pagination?: PaginationState;
}

/**
 * Shared list-query boundary for Runtime collection endpoints.
 *
 * When pagination is supplied, page/pageSize are translated to the backend
 * limit/offset contract and become part of the query key. The backend response
 * remains untouched.
 */
export function useListQuery<TData>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime,
  pagination,
}: UseListQueryOptions<TData>) {
  const requestPagination = pagination
    ? toLimitOffsetPagination(pagination)
    : undefined;

  const resolvedQueryKey: QueryKey = requestPagination
    ? [...queryKey, requestPagination.limit, requestPagination.offset]
    : queryKey;

  const query = useQuery<TData>({
    queryKey: resolvedQueryKey,
    queryFn: () => queryFn(requestPagination),
    enabled,
    ...(staleTime === undefined ? {} : { staleTime }),
  });

  return {
    ...query,
    requestPagination,
  };
}

export function paginationMeta<TItem>(
  response: OffsetPageResponse<TItem> | undefined,
  pagination: PaginationState,
) {
  const total = response?.total;

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    limit: response?.limit ?? pagination.pageSize,
    offset:
      response?.offset ??
      toLimitOffsetPagination(pagination).offset,
    total,
    pageCount:
      total === undefined
        ? undefined
        : Math.ceil(total / pagination.pageSize),
    hasPreviousPage: pagination.page > 1,
    hasNextPage:
      total === undefined
        ? undefined
        : pagination.page * pagination.pageSize < total,
  };
}
