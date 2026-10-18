import { ApiClient } from '@digvation/business-api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CustomerMemberApi, type MemberLookupResult } from '../api/customer-member-api';
import {
  activeMemberOf,
  needsMemberIdentityLookup,
  presentedCustomer,
} from './member-cart-presentation';
import { useCustomerPickerSession } from './customer-picker-session';
import type { AuthPort, LegacyCompatibleAuthSession } from '@digvation/pos-auth';
import type { useRuntime } from '@digvation/pos-runtime';
import type { Sale, SaleCustomer } from '../../transaction/model/cashier-transaction.types';

/**
 * Customer and Member context of the sale being served: the picked Member, the picker draft session,
 * membership/loyalty permissions, and the Member identity and point-balance lookups.
 */
export function useSaleCustomerContext({
  activeCustomer,
  sale,
  session,
  runtime,
  authPort,
}: {
  activeCustomer: SaleCustomer | null;
  sale: Sale | null;
  session: LegacyCompatibleAuthSession;
  runtime: ReturnType<typeof useRuntime>;
  authPort: AuthPort;
}) {
  const [selectedMember, setSelectedMember] = useState<MemberLookupResult | null>(null);
  const customerPickerSession = useCustomerPickerSession();
  // A new transaction must never inherit the previous customer's picker draft or selected Member.
  // Query caches are keyed by identity and stay warm; only this presentation state is cleared.
  const startNewCustomerTransaction = () => {
    setSelectedMember(null);
    customerPickerSession.startNewTransaction();
  };
  const customerCacheScope = `${session.business.tenantId}:${session.identity.userId}:${session.contextVersion}`;
  const customerMemberApi = useMemo(
    () =>
      new CustomerMemberApi(
        new ApiClient({
          baseUrl: runtime.apiBaseUrl,
          applicationSurface: 'operational',
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
        customerCacheScope,
      ),
    [authPort, runtime.apiBaseUrl, customerCacheScope],
  );
  const hasMembershipCapability = session.access.capabilities.includes('MEMBERSHIP');
  const canReadMembers =
    hasMembershipCapability && session.access.permissions.includes('membership:read');
  const canEnrollMember =
    hasMembershipCapability && session.access.permissions.includes('membership:enroll');
  const canReadCustomers =
    session.access.foundations.includes('CUSTOMER_IDENTITY') &&
    session.access.permissions.includes('customers:read');
  const hasLoyaltyCapability = session.access.capabilities.includes('LOYALTY_POINTS');
  const canRedeemLoyalty =
    hasLoyaltyCapability && session.access.permissions.includes('loyalty:redeem');
  const canReadLoyalty =
    hasLoyaltyCapability &&
    (session.access.permissions.includes('loyalty:read') || canRedeemLoyalty);
  const activeSelectedMember = activeMemberOf(activeCustomer, selectedMember);
  // Draft customer identity is completed from the picked Member; a Sale's own customer wins once it exists.
  const cartCustomer = presentedCustomer(activeCustomer, activeSelectedMember, Boolean(sale));
  const memberIdentityQuery = useQuery({
    queryKey: [
      'operational-member-by-customer',
      activeCustomer?.type === 'MEMBER' ? activeCustomer.referenceId : null,
      activeCustomer?.phoneE164 ?? null,
    ],
    queryFn: ({ signal }) => customerMemberApi.searchMembers(activeCustomer!.phoneE164, signal),
    enabled: needsMemberIdentityLookup({
      canReadMembers,
      customer: activeCustomer,
      activeMember: activeSelectedMember,
    }),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (activeCustomer?.type !== 'MEMBER') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- accepted baseline: state is reset when its source changes; moving it to render-time derivation is a behavioural refactor tracked separately
      if (selectedMember) setSelectedMember(null);
      return;
    }
    if (selectedMember?.customerId === activeCustomer.referenceId) return;
    const matched = memberIdentityQuery.data?.items.find(
      (member) => member.customerId === activeCustomer.referenceId,
    );
    if (matched) setSelectedMember(matched);
  }, [activeCustomer?.referenceId, activeCustomer?.type, memberIdentityQuery.data, selectedMember]);
  const memberBalanceQuery = useQuery({
    queryKey: ['operational-member-balance', selectedMember?.id],
    queryFn: ({ signal }) => customerMemberApi.getPointBalance(selectedMember!.id, signal),
    enabled: Boolean(selectedMember && canReadLoyalty),
    staleTime: 15_000,
  });
  return {
    selectedMember,
    setSelectedMember,
    customerPickerSession,
    startNewCustomerTransaction,
    customerCacheScope,
    customerMemberApi,
    canReadMembers,
    canEnrollMember,
    canReadCustomers,
    canRedeemLoyalty,
    canReadLoyalty,
    activeSelectedMember,
    cartCustomer,
    memberIdentityQuery,
    memberBalanceQuery,
  };
}
