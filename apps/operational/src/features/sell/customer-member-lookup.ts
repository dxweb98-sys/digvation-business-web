/** Customer snapshot used only for the active Cashier transaction presentation. */
export interface TransactionCustomer {
  customerId?: string;
  name: string;
  phone: string;
  membership?: {
    memberCode: string;
    status: 'ACTIVE';
  };
}

/** A member lookup result keeps Customer and LoyaltyMembership as distinct concepts. */
export interface MemberCustomerLookupResult extends TransactionCustomer {
  customerId: string;
  membership: {
    memberCode: string;
    status: 'ACTIVE';
  };
}

export interface CustomerMemberLookupPort {
  searchMembers(query: string): readonly MemberCustomerLookupResult[];
}

const localMembers: readonly MemberCustomerLookupResult[] = [
  {
    customerId: 'customer-demo-budi',
    name: 'Budi Santoso',
    phone: '081234567890',
    membership: { memberCode: 'DGV-1001', status: 'ACTIVE' },
  },
  {
    customerId: 'customer-demo-rina',
    name: 'Rina Amelia',
    phone: '085712345678',
    membership: { memberCode: 'DGV-1002', status: 'ACTIVE' },
  },
  {
    customerId: 'customer-demo-andi',
    name: 'Andi Pratama',
    phone: '081298765432',
    membership: { memberCode: 'DGV-1003', status: 'ACTIVE' },
  },
];

class LocalCustomerMemberLookupAdapter implements CustomerMemberLookupPort {
  public searchMembers(query: string): readonly MemberCustomerLookupResult[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];

    return localMembers.filter((member) =>
      `${member.name} ${member.phone} ${member.membership.memberCode}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }
}

/** Replace this local lookup adapter with the future HTTP implementation without changing the dialog. */
export const customerMemberLookup: CustomerMemberLookupPort =
  new LocalCustomerMemberLookupAdapter();
