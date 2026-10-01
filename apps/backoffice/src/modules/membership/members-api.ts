import type { ApiClient } from '@digvation/business-api';

export type Status = 'ACTIVE' | 'INACTIVE';
export interface Customer {
  id: string;
  name: string;
  phoneE164: string;
  version: number;
  status: Status;
}
export interface Member {
  id: string;
  customerId: string;
  customer: Customer;
  memberNumber: string;
  status: Status;
  joinedAt: string;
  version: number;
}
export interface MemberPage {
  items: Member[];
  total: number;
  limit: number;
  offset: number;
}
export interface Balance {
  membershipId: string;
  pointsBalance: string;
}
type LedgerType = 'EARN' | 'REDEEM' | 'EARN_REVERSAL' | 'REDEEM_REVERSAL';
type LedgerResponse = {
  id: string;
  type: LedgerType;
  pointsDelta: string;
  balanceAfter: string;
  sourceSaleId: string;
  reversesLedgerEntryId: string | null;
  createdAt: string;
};
export interface Ledger {
  id: string;
  type: 'Points earned' | 'Points redeemed' | 'Earned points reversed' | 'Redeemed points restored';
  pointsDelta: string;
  balanceAfter: string;
  sourceSaleId: string;
  reversesLedgerEntryId: string | null;
  createdAt: string;
}
const ledgerTypeLabel: Record<LedgerType, Ledger['type']> = {
  EARN: 'Points earned',
  REDEEM: 'Points redeemed',
  EARN_REVERSAL: 'Earned points reversed',
  REDEEM_REVERSAL: 'Redeemed points restored',
};
export type MemberImportAction = 'CREATE_CUSTOMER_AND_MEMBERSHIP' | 'ENROLL_EXISTING_CUSTOMER';
export type MemberImportField = 'name' | 'phone' | 'memberNumber' | 'status' | 'joinedAt' | 'row';
export interface MemberImportIssue {
  field: MemberImportField;
  code: string;
  message: string;
  relatedRows?: number[];
}
export interface MemberImportRow {
  rowNumber: number;
  name: string | null;
  phone: string | null;
  memberNumber: string | null;
  status: Status;
  joinedDate: string | null;
  action: MemberImportAction | null;
  errors: MemberImportIssue[];
  warnings: MemberImportIssue[];
}
export interface MemberImportPreview {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  canImport: boolean;
  rows: MemberImportRow[];
}
export interface MemberImportSummary {
  importedCount: number;
  createdCustomerCount: number;
  enrolledExistingCustomerCount: number;
  generatedMemberNumberCount: number;
  preservedMemberNumberCount: number;
}
export interface MemberImportResult {
  outcome: 'IMPORTED' | 'REJECTED';
  preview: MemberImportPreview;
  summary: MemberImportSummary | null;
}
export const MEMBER_IMPORT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const qs = (input: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(input).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v));
  });
  return p;
};
export class MembersApi {
  constructor(private readonly client: ApiClient) {}
  list(input: { q?: string; status?: Status; limit: number; offset: number }) {
    return this.client.get<MemberPage>(`/api/v1/memberships?${qs(input)}`);
  }
  get(id: string) {
    return this.client.get<Member>(`/api/v1/memberships/${id}`);
  }
  enroll(input: { name: string; phone: string }) {
    return this.client.post<Member>('/api/v1/memberships', input);
  }
  enrollExisting(input: { customerId: string }) {
    return this.client.post<Member>('/api/v1/memberships/enroll-existing-customer', input);
  }
  searchCustomers(q: string) {
    return this.client.get<{ items: Customer[]; total: number }>(
      `/api/v1/customers?${qs({ q, limit: 20, offset: 0 })}`,
    );
  }
  updateCustomer(member: Member, input: { name: string; phone: string }) {
    return this.client.patch<Customer>(`/api/v1/customers/${member.customerId}`, {
      ...input,
      expectedVersion: member.customer.version,
    });
  }
  updateStatus(member: Member, status: Status) {
    return this.client.patch<Member>(`/api/v1/memberships/${member.id}/status`, {
      status,
      expectedVersion: member.version,
    });
  }
  importTemplate() {
    return this.client.getBinary('/api/v1/memberships/import-template.xlsx');
  }
  previewImport(file: Blob) {
    return this.client.putBinary<MemberImportPreview>(
      '/api/v1/memberships/import.xlsx/preview',
      file,
      MEMBER_IMPORT_CONTENT_TYPE,
    );
  }
  importMembers(file: Blob) {
    return this.client.putBinary<MemberImportResult>(
      '/api/v1/memberships/import.xlsx',
      file,
      MEMBER_IMPORT_CONTENT_TYPE,
    );
  }
  balance(id: string) {
    return this.client.get<Balance>(`/api/v1/loyalty/memberships/${id}/balance`);
  }
  async history(id: string) {
    const rows = await this.client.get<LedgerResponse[]>(
      `/api/v1/loyalty/memberships/${id}/history`,
    );
    return rows.map(({ type, ...row }) => ({ ...row, type: ledgerTypeLabel[type] }));
  }
}
