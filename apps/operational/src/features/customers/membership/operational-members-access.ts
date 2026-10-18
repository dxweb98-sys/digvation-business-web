import { canUseSessionFeature, type SessionAccess } from '@digvation/business-auth';

/**
 * Member surface access. The Membership capability must be entitled and the actor must hold
 * membership:read; editing the profile is canonical Customer management. Runtime remains the
 * authority on every request, so this only decides what to show.
 */
export function canReadOperationalMembers(
  permissions: readonly string[],
  capabilities: readonly string[],
  access?: SessionAccess,
): boolean {
  if (access) return canUseSessionFeature(access, 'MEMBERSHIP', ['membership:read']);
  return capabilities.includes('MEMBERSHIP') && permissions.includes('membership:read');
}

export function canEditOperationalMemberProfile(
  permissions: readonly string[],
  capabilities: readonly string[],
  access?: SessionAccess,
): boolean {
  return (
    canReadOperationalMembers(permissions, capabilities, access) &&
    permissions.includes('customers:manage')
  );
}
