import type { ApiClient } from '@digvation/business-api';

import type {
  Payment,
  SaleAdjustment,
  SaleLine,
  SaleStatus,
  TaxTreatment,
} from '../../features/sell/cashier-transaction.types';

export interface OperationalSaleListItem {
  id: string;
  saleNumber: string;
  invoiceNumber: string | null;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  totalAmount: string;
  createdAt: string;
  finalizedAt: string | null;
}

export interface OperationalSaleDetailLine extends SaleLine {
  overrideActorId: string | null;
  overrideActorKind: string | null;
  discountActorId: string | null;
  discountActorKind: string | null;
  itemTaxRuleId: string | null;
  itemTaxCode: string | null;
  itemTaxName: string | null;
  itemTaxRate: string | null;
  itemTaxTreatment: TaxTreatment | null;
  itemTaxAmount: string;
  transactionTaxBaseAmount: string;
  transactionTaxAmount: string;
}

export interface OperationalSaleDetail extends OperationalSaleListItem {
  operationalState: 'UNSUBMITTED' | 'QUEUED' | 'IN_PROGRESS';
  version: number;
  grossAmount: string;
  discountAmount: string;
  netPreTaxAmount: string;
  taxAmount: string;
  orderDiscountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  orderDiscountValue: string | null;
  orderDiscountReason: string | null;
  orderDiscountActorId: string | null;
  orderDiscountActorKind: string | null;
  orderDiscountAmount: string;
  transactionTaxRuleId: string | null;
  transactionTaxCode: string | null;
  transactionTaxName: string | null;
  transactionTaxRate: string | null;
  transactionTaxTreatment: TaxTreatment | null;
  transactionTaxBaseAmount: string;
  transactionTaxAmount: string;
  promotionCode: string | null;
  adjustments: SaleAdjustment[];
  createdByActorId: string;
  createdByActorKind: string;
  voidedAt: string | null;
  updatedAt: string;
  lines: OperationalSaleDetailLine[];
  payments: Payment[];
}

type OperationalSaleDetailLinePayload = Omit<
  OperationalSaleDetailLine,
  'participations' | 'contributions'
> &
  Partial<Pick<OperationalSaleDetailLine, 'participations' | 'contributions'>>;

export type OperationalSaleDetailPayload = Omit<
  OperationalSaleDetail,
  'adjustments' | 'lines' | 'payments'
> & {
  adjustments?: SaleAdjustment[];
  lines?: OperationalSaleDetailLinePayload[];
  payments?: Payment[];
};

export function normalizeOperationalSaleDetail(
  payload: OperationalSaleDetailPayload,
): OperationalSaleDetail {
  return {
    ...payload,
    adjustments: payload.adjustments ?? [],
    lines: (payload.lines ?? []).map((line) => ({
      ...line,
      participations: line.participations ?? [],
      contributions: line.contributions ?? [],
    })),
    payments: payload.payments ?? [],
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Query = Record<string, string | number | undefined>;
const queryString = (query: Query) =>
  new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [
      string,
      string,
    ][],
  ).toString();

export class OperationalTransactionHistoryApi {
  constructor(private readonly client: ApiClient) {}

  list(query: Query) {
    return this.client.get<Page<OperationalSaleListItem>>(`/api/v1/sales?${queryString(query)}`);
  }

  async get(id: string) {
    const payload = await this.client.get<OperationalSaleDetailPayload>(`/api/v1/sales/${id}`);
    return normalizeOperationalSaleDetail(payload);
  }
}
