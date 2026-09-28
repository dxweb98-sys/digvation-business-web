import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@digvation/business-api';
import { WorkshopQueueApi } from './workshop-queue-api';

const activeLocation = '11111111-1111-4111-8111-111111111111';

/**
 * Regression for a real manual-test failure: Runtime's global ValidationPipe
 * uses `whitelist: true` + `forbidNonWhitelisted: true`, so
 * `GET /api/v1/workshop/work-orders` rejects any query parameter not declared
 * on `WorkshopQueueQueryDto` (`limit`, `offset`, `sellingLocationId`, `q`,
 * `status`) with `400 VALIDATION_ERROR`. This pins the exact outgoing query
 * string so a future edit cannot silently reintroduce `workOrderNumber` or
 * `workStatus`, which Runtime does not accept.
 */
describe('WorkshopQueueApi.list', () => {
  it('sends only the Runtime-whitelisted query parameters, including the active location', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const client = { get, post: vi.fn() } as unknown as ApiClient;
    const api = new WorkshopQueueApi(client);

    await api.list({
      limit: 50,
      offset: 0,
      sellingLocationId: activeLocation,
      q: 'WO-0001',
      status: 'IN_PROGRESS',
    });

    expect(get).toHaveBeenCalledTimes(1);
    const [path] = get.mock.calls[0] as [string];
    const query = new URLSearchParams(path.split('?')[1]);

    expect(query.get('limit')).toBe('50');
    expect(query.get('offset')).toBe('0');
    expect(query.get('sellingLocationId')).toBe(activeLocation);
    expect(query.get('q')).toBe('WO-0001');
    expect(query.get('status')).toBe('IN_PROGRESS');
    expect(query.has('workOrderNumber')).toBe(false);
    expect(query.has('workStatus')).toBe(false);
    expect([...query.keys()].sort()).toEqual(
      ['limit', 'offset', 'q', 'sellingLocationId', 'status'].sort(),
    );
  });

  it('always sends the active location and omits q/status when not provided', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const client = { get, post: vi.fn() } as unknown as ApiClient;
    const api = new WorkshopQueueApi(client);

    await api.list({ limit: 50, offset: 0, sellingLocationId: activeLocation });

    const [path] = get.mock.calls[0] as [string];
    const query = new URLSearchParams(path.split('?')[1]);
    expect(query.get('sellingLocationId')).toBe(activeLocation);
    expect(query.has('q')).toBe(false);
    expect(query.has('status')).toBe(false);
  });
});
