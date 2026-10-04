import type { AuthSession } from '@digvation/business-auth';

/** Customer projections are scoped to the authenticated identity and effective context. */
export function customerQueryScope(session: AuthSession | null) {
  return [
    session?.business.tenantId ?? '',
    session?.identity.userId ?? '',
    session?.contextVersion ?? '',
  ] as const;
}
export const customerQueryKeys = {
  list: (scope: readonly string[], filters: object, membershipReadable: boolean) =>
    ['customers', 'list', scope, filters, membershipReadable] as const,
  detail: (scope: readonly string[], id: string, membershipReadable: boolean) =>
    ['customers', 'detail', scope, id, membershipReadable] as const,
};
