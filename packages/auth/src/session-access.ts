import type { AuthSession } from './auth.types';

type SessionWithAccess = Pick<AuthSession, 'access'>;

export function hasSessionProduct(
  session: SessionWithAccess | null | undefined,
  product: string,
): boolean {
  return Boolean(session?.access.products.includes(product));
}

export function hasSessionCapability(
  session: SessionWithAccess | null | undefined,
  capability: string,
): boolean {
  return Boolean(session?.access.capabilities.includes(capability));
}

export function hasSessionFoundation(
  session: SessionWithAccess | null | undefined,
  foundation: string,
): boolean {
  return Boolean(session?.access.foundations.includes(foundation));
}

export function hasSessionPermission(
  session: SessionWithAccess | null | undefined,
  permission: string,
): boolean {
  return Boolean(session?.access.permissions.includes(permission));
}
