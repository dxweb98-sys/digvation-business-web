import type { ApiClient } from '@digvation/business-api';

export type Status = 'ACTIVE' | 'INACTIVE';
export interface Customer { id: string; name: string; phoneE164: string; version: number; status: Status; }
export interface Member { id: string; customerId: string; customer: Customer; memberNumber: string; status: Status; joinedAt: string; version: number; }
export interface MemberPage { items: Member[]; total: number; limit: number; offset: number; }
export interface Balance { membershipId: string; pointsBalance: string; }
export interface PortalAccess { status: 'ACTIVE'|'INACTIVE'|'REVOKED'; url: string; }
type LedgerType = 'EARN'|'REDEEM'|'EARN_REVERSAL'|'REDEEM_REVERSAL';
type LedgerResponse = { id: string; type: LedgerType; pointsDelta: string; balanceAfter: string; sourceSaleId: string; reversesLedgerEntryId: string|null; createdAt: string; };
export interface Ledger { id: string; type: 'Points earned'|'Points redeemed'|'Earned points reversed'|'Redeemed points restored'; pointsDelta: string; balanceAfter: string; sourceSaleId: string; reversesLedgerEntryId: string|null; createdAt: string; }
const ledgerTypeLabel: Record<LedgerType, Ledger['type']> = { EARN: 'Points earned', REDEEM: 'Points redeemed', EARN_REVERSAL: 'Earned points reversed', REDEEM_REVERSAL: 'Redeemed points restored' };
const qs=(input: Record<string,string|number|undefined>)=>{ const p=new URLSearchParams(); Object.entries(input).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v));}); return p; };
export class MembersApi {
  constructor(private readonly client: ApiClient) {}
  list(input:{q?:string;status?:Status;limit:number;offset:number}) { return this.client.get<MemberPage>(`/api/v1/memberships?${qs(input)}`); }
  get(id:string) { return this.client.get<Member>(`/api/v1/memberships/${id}`); }
  enroll(input:{name:string;phone:string;nik:string}) { return this.client.post<Member>('/api/v1/memberships',input); }
  updateCustomer(member:Member,input:{name:string;phone:string}) { return this.client.patch<Customer>(`/api/v1/customers/${member.customerId}`,{...input,expectedVersion:member.customer.version}); }
  updateStatus(member:Member,status:Status) { return this.client.patch<Member>(`/api/v1/memberships/${member.id}/status`,{status,expectedVersion:member.version}); }
  balance(id:string) { return this.client.get<Balance>(`/api/v1/loyalty/memberships/${id}/balance`); }
  async history(id:string) { const rows = await this.client.get<LedgerResponse[]>(`/api/v1/loyalty/memberships/${id}/history`); return rows.map(({type,...row})=>({...row,type:ledgerTypeLabel[type]})); }
  portalAccess(id:string) { return this.client.get<PortalAccess>(`/api/v1/memberships/${id}/portal-access`); }
  rotatePortalAccess(id:string) { return this.client.post<PortalAccess>(`/api/v1/memberships/${id}/portal-access/rotate`,{}); }
  revokePortalAccess(id:string) { return this.client.post<{completed:true}>(`/api/v1/memberships/${id}/portal-access/revoke`,{}); }
}
