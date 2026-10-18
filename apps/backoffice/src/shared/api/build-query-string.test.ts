import { describe, expect, it } from 'vitest';

import { buildQueryString } from './build-query-string';

describe('buildQueryString', () => {
  it('omits absent values and preserves meaningful zero/false values', () => {
    expect(
      buildQueryString({
        q: '',
        status: undefined,
        categoryId: null,
        limit: 0,
        enabled: false,
        offset: 10,
      }),
    ).toBe('limit=0&enabled=false&offset=10');
  });
});
