import { describe, expect, it } from 'vitest';

import { paginationMeta } from './use-list-query';

describe('paginationMeta', () => {
  it('preserves backend pagination facts and derives page navigation metadata', () => {
    const meta = paginationMeta(
      {
        items: [{ id: '1' }],
        total: 45,
        limit: 20,
        offset: 20,
      },
      { page: 2, pageSize: 20 },
    );

    expect(meta).toEqual({
      page: 2,
      pageSize: 20,
      limit: 20,
      offset: 20,
      total: 45,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });
});
