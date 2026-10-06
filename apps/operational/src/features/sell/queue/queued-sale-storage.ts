export interface QueuedSaleEntry {
  saleId: string;
  sellingLocationId: string;
  saleCreatedAt: string;
}

const QUEUED_SALE_IDS_KEY = 'digvation-pos-demo-queued-sale-ids';

const CANCELED_SALE_REASONS_KEY = 'digvation-pos-demo-canceled-sale-reasons';

export function readQueuedSaleEntries(): QueuedSaleEntry[] {
  try {
    const raw = window.sessionStorage.getItem(QUEUED_SALE_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is QueuedSaleEntry =>
            typeof value === 'object' &&
            value !== null &&
            typeof value.saleId === 'string' &&
            typeof value.sellingLocationId === 'string' &&
            typeof value.saleCreatedAt === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function writeQueuedSaleEntries(entries: readonly QueuedSaleEntry[]): void {
  try {
    window.sessionStorage.setItem(QUEUED_SALE_IDS_KEY, JSON.stringify(entries));
  } catch {
    // Queue presentation state remains available for the current session when storage is unavailable.
  }
}

export function readCancellationReasons(): Record<string, string> {
  try {
    const raw = window.sessionStorage.getItem(CANCELED_SALE_REASONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};
  } catch {
    return {};
  }
}

export function writeCancellationReason(saleId: string, reason: string): void {
  try {
    window.sessionStorage.setItem(
      CANCELED_SALE_REASONS_KEY,
      JSON.stringify({ ...readCancellationReasons(), [saleId]: reason }),
    );
  } catch {
    // This local/demo presentation metadata is optional when session storage is unavailable.
  }
}
