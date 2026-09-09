import type { ApiClient } from '@digvation/pos-api';
import type { FinancialAccount, Page, PaymentMethod, RecordStatus, SellingLocation } from './financial-accounts-api';
interface FinancialOperationsPage<T> extends Page<T> { total: number; }
export type SettlementStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';
export type ReconciliationStatus = 'MATCHED' | 'DISCREPANCY' | 'RESOLVED';
export interface CashPosition { sellingLocationId: string; sellingLocationCode: string; sellingLocationName: string; financialAccountId: string; financialAccountCode: string; financialAccountName: string; currency: string; paymentAmount: string; movementAmount: string; positionAmount: string; }
export interface CashMovement { id: string; sellingLocationId: string; sellingLocationCode: string; sellingLocationName: string; financialAccountId: string; financialAccountCode: string; financialAccountName: string; type: 'CASH_IN' | 'CASH_OUT'; currency: string; amount: string; note: string | null; occurredAt: string; }
export interface Settlement { id: string; sellingLocationId: string; sellingLocationCode: string; sellingLocationName: string; financialAccountId: string; financialAccountCode: string; financialAccountName: string; paymentMethod: PaymentMethod; currency: string; expectedAmount: string; status: SettlementStatus; version: number; createdAt: string; payments: { id: string; amount: string; status: string }[]; }
export interface Reconciliation { id: string; settlementId: string; expectedAmount: string; actualAmount: string; differenceAmount: string; status: ReconciliationStatus; note: string | null; version: number; createdAt: string; settlement: { sellingLocationName: string; sellingLocationCode: string; financialAccountName: string; financialAccountCode: string; currency: string }; }
type Query = Record<string, string | number | undefined>;
const qs = (query: Query) => new URLSearchParams(Object.entries(query).filter(([,v]) => v !== undefined && v !== '') as [string,string][]).toString();
export class FinancialOperationsApi {
  constructor(private readonly client: ApiClient) {}
  positions(locationId?: string) { return this.client.get<CashPosition[]>(`/api/v1/cash-position${locationId ? `?sellingLocationId=${locationId}` : ''}`); }
  movements(query: Query) { return this.client.get<FinancialOperationsPage<CashMovement>>(`/api/v1/cash-movements?${qs(query)}`); }
  createMovement(input: { sellingLocationId: string; financialAccountId: string; type: CashMovement['type']; amount: string; note?: string }) { return this.client.post<CashMovement>('/api/v1/cash-movements', input); }
  settlements(query: Query) { return this.client.get<FinancialOperationsPage<Settlement>>(`/api/v1/settlements?${qs(query)}`); }
  settlement(id: string) { return this.client.get<Settlement>(`/api/v1/settlements/${id}`); }
  createSettlement(input: { sellingLocationId: string; financialAccountId: string; paymentMethod: PaymentMethod }) { return this.client.post<Settlement>('/api/v1/settlements', input); }
  updateSettlement(item: Settlement, status: SettlementStatus) { return this.client.patch<Settlement>(`/api/v1/settlements/${item.id}`, { expectedVersion: item.version, status }); }
  reconciliations(query: Query) { return this.client.get<FinancialOperationsPage<Reconciliation>>(`/api/v1/reconciliations?${qs(query)}`); }
  createReconciliation(input: { settlementId: string; actualAmount: string; note?: string }) { return this.client.post<Reconciliation>('/api/v1/reconciliations', input); }
  updateReconciliation(item: Reconciliation, status: ReconciliationStatus, note?: string) { return this.client.patch<Reconciliation>(`/api/v1/reconciliations/${item.id}`, { expectedVersion: item.version, status, note }); }
  accounts() { return this.client.get<Page<FinancialAccount>>('/api/v1/financial-accounts?status=ACTIVE&limit=100&offset=0'); }
  locations() { return this.client.get<Page<SellingLocation>>('/api/v1/locations?limit=100&offset=0'); }
}
