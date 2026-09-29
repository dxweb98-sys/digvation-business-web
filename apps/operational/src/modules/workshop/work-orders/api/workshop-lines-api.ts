import type { ApiClient } from '@digvation/business-api';

import type { WorkshopQueueWorkOrder } from './workshop-queue-api';

export type WorkshopItemType = 'PRODUCT' | 'SERVICE';

/** Composition Catalog resolved when the Line was accepted; context, not a priced Line. */
export interface WorkshopWorkOrderLineComponent {
  source: 'FIXED_BOM' | 'ADDITIONAL';
  componentItemId: string;
  itemCode: string;
  itemName: string;
  componentVariantId: string | null;
  variantCode: string | null;
  variantName: string | null;
  quantity: string;
}

/** An accepted initial item. Every value is the snapshot Runtime accepted. */
export interface WorkshopWorkOrderLine {
  id: string;
  position: number;
  catalogItemId: string;
  catalogVariantId: string | null;
  itemCode: string;
  itemName: string;
  itemType: WorkshopItemType;
  variantCode: string | null;
  variantName: string | null;
  quantity: string;
  currency: string;
  unitPrice: string;
  lineAmount: string;
  components: WorkshopWorkOrderLineComponent[];
}

export type WorkshopLineAdjustmentType = 'ADD' | 'QUANTITY_CHANGE' | 'REMOVE';

/** One durable item change. Item facts are the accepted snapshot of the affected Line. */
export interface WorkshopLineAdjustmentEntry {
  id: string;
  sequence: number;
  type: WorkshopLineAdjustmentType;
  lineId: string;
  itemCode: string;
  itemName: string;
  itemType: WorkshopItemType;
  variantName: string | null;
  /** Null for ADD. */
  previousQuantity: string | null;
  /** Effective quantity after the change; 0 for REMOVE. */
  quantity: string;
  workOrderVersion: number;
  adjustedAt: string;
}

/** Effective Lines (accepted Lines with adjustments applied) and the change history. */
export interface WorkshopWorkOrderDetail extends WorkshopQueueWorkOrder {
  lines: WorkshopWorkOrderLine[];
  adjustments: WorkshopLineAdjustmentEntry[];
}

/** Selection intent only; Runtime resolves every name, type, price and composition fact. */
export interface WorkshopLineSelectionInput {
  catalogItemId: string;
  catalogVariantId?: string;
  quantity: string;
  additionalComponents?: {
    componentItemId: string;
    componentVariantId?: string;
    quantity: string;
  }[];
}

export type WorkshopLineAdjustmentInput =
  | ({ type: 'ADD' } & WorkshopLineSelectionInput)
  | { type: 'QUANTITY_CHANGE'; lineId: string; quantity: string }
  | { type: 'REMOVE'; lineId: string };

/** Authoritative Catalog price as the shared Operational projection resolved it. */
export interface PickerPrice {
  amount: string;
  currency: string;
}

export interface PickerFixedComponent {
  componentItemId: string;
  itemName: string;
  variantName: string | null;
  quantity: string;
}

export interface PickerVariant {
  id: string;
  code: string;
  name: string;
  status: string;
  resolvedPrice: PickerPrice | null;
  fixedComponents?: PickerFixedComponent[];
}

export interface PickerItem {
  id: string;
  code: string;
  name: string;
  type: WorkshopItemType;
  lifecycle: string;
  productUsage?: 'STANDALONE_AND_COMPONENT' | 'COMPONENT_ONLY';
  variantSelectionMode?: 'REQUIRED' | 'OPTIONAL';
  requireAdditionalItemAtSale?: boolean;
  resolvedPrice?: PickerPrice | null;
  variants?: PickerVariant[];
  fixedComponents?: PickerFixedComponent[];
}

export interface PickerCandidateVariant {
  id: string;
  name: string;
  resolvedPrice: PickerPrice | null;
}

export interface PickerCandidate {
  id: string;
  code: string;
  name: string;
  variantSelectionMode: 'REQUIRED' | 'OPTIONAL';
  resolvedPrice: PickerPrice | null;
  variants: PickerCandidateVariant[];
}

/**
 * Thin transport for Work Order items. Selection reads reuse the shared
 * Operational Catalog projection; the accepted Lines always come back from
 * Runtime and are never recomputed in the browser.
 */
export class WorkshopLinesApi {
  constructor(private readonly client: ApiClient) {}

  getDetail(id: string) {
    return this.client.get<WorkshopWorkOrderDetail>(`/api/v1/workshop/work-orders/${id}`);
  }

  getCatalog(locationId: string, currency: string) {
    const query = new URLSearchParams({ locationId, currency });
    return this.client.get<{ items: PickerItem[] }>(
      `/api/v1/operational/catalog?${query.toString()}`,
    );
  }

  getAdditionalItemCandidates(locationId: string, currency: string) {
    const query = new URLSearchParams({ locationId, currency });
    return this.client.get<{ items: PickerCandidate[] }>(
      `/api/v1/operational/component-candidates?${query.toString()}`,
    );
  }

  acceptInitialLines(id: string, expectedVersion: number, lines: WorkshopLineSelectionInput[]) {
    return this.client.post<WorkshopWorkOrderDetail>(`/api/v1/workshop/work-orders/${id}/lines`, {
      expectedVersion,
      lines,
    });
  }

  adjustLines(id: string, expectedVersion: number, adjustments: WorkshopLineAdjustmentInput[]) {
    return this.client.post<WorkshopWorkOrderDetail>(
      `/api/v1/workshop/work-orders/${id}/lines/adjustments`,
      { expectedVersion, adjustments },
    );
  }
}
