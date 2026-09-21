import type { ApiClient } from '@digvation/business-api';

export type Status = 'ACTIVE' | 'INACTIVE';
export interface Customer { id: string; name: string; phoneE164: string; version: number; status: Status; }
export interface Member { id: string; customerId: string; customer: Customer; memberNumber: string; status: Status; joinedAt: string; version: number; }
export interface MemberPage { items: Member[]; total: number; limit: number; offset: number; }
export interface Balance { membershipId: string; pointsBalance: string; }
export interface Ledger { id: string; type: 'EARN'; pointsDelta: string; balanceAfter: string; sourceSaleId: string; createdAt: string; }
const qs=(input: Record<string,string|number|undefined>)=>{ const p=new URLSearchParams(); Object.entries(input).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v));}); return p; };
export class MembersApi {
  constructor(private readonly client: ApiClient) {}
  list(input:{q?:string;status?:Status;limit:number;offset:number}) { return this.client.get<MemberPage>(`/api/v1/memberships?${qs(input)}`); }
  get(id:string) { return this.client.get<Member>(`/api/v1/memberships/${id}`); }
  enroll(input:{name:string;phone:string;nik:string}) { return this.client.post<Member>('/api/v1/memberships',input); }
  updateCustomer(member:Member,input:{name:string;phone:string}) { return this.client.patch<Customer>(`/api/v1/customers/${member.customerId}`,{...input,expectedVersion:member.customer.version}); }
  updateStatus(member:Member,status:Status) { return this.client.patch<Member>(`/api/v1/memberships/${member.id}/status`,{status,expectedVersion:member.version}); }
  balance(id:string) { return this.client.get<Balance>(`/api/v1/loyalty/memberships/${id}/balance`); }
  history(id:string) { return this.client.get<Ledger[]>(`/api/v1/loyalty/memberships/${id}/history`); }
}