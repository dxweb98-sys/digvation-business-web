import type { AuthSession } from '@digvation/business-auth';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { customerQueryKeys, customerQueryScope } from './customer-query-keys';

const session = (tenantId: string, userId: string, contextVersion: string) =>
  ({ business: { tenantId }, identity: { userId }, contextVersion }) as AuthSession;

describe('Customer authenticated cache isolation', () => {
  it('does not reuse identities or Membership projections across tenants, actors, contexts or permissions', () => {
    const client = new QueryClient();
    const scope = customerQueryScope(session('tenant-a', 'actor-a', 'v1'));
    client.setQueryData(customerQueryKeys.list(scope, {}, true), {
      items: [{ name: 'Private customer' }],
    });
    client.setQueryData(customerQueryKeys.detail(scope, 'customer-a', true), {
      membership: { memberNumber: 'MEM-1' },
    });
    for (const next of [
      session('tenant-b', 'actor-a', 'v1'),
      session('tenant-a', 'actor-b', 'v1'),
      session('tenant-a', 'actor-a', 'v2'),
    ]) {
      expect(
        client.getQueryData(customerQueryKeys.list(customerQueryScope(next), {}, true)),
      ).toBeUndefined();
      expect(
        client.getQueryData(customerQueryKeys.detail(customerQueryScope(next), 'customer-a', true)),
      ).toBeUndefined();
    }
    expect(client.getQueryData(customerQueryKeys.list(scope, {}, false))).toBeUndefined();
    expect(
      client.getQueryData(customerQueryKeys.detail(scope, 'customer-a', false)),
    ).toBeUndefined();
    expect(client.getQueryCache().findAll({ queryKey: ['customers'] })).toHaveLength(2);
  });
});
