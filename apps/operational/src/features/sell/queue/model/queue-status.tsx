import { CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';
import type { QueueSale } from '../../transaction/model/cashier-transaction.types';

export type QueueStatus = 'QUEUED' | 'PROGRESS' | 'COMPLETED' | 'CANCELED';

export const statusMeta: Record<
  QueueStatus,
  { value: string; icon: ReactNode; tone: string; soft: string }
> = {
  QUEUED: {
    value: 'QUEUED',
    icon: <Clock className="size-3.75" />,
    tone: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    soft: 'bg-[var(--color-warning)]/[.045]',
  },
  PROGRESS: {
    value: 'IN_PROGRESS',
    icon: <PlayCircle className="size-3.75" />,
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    soft: 'bg-[var(--color-brand)]/[.045]',
  },
  COMPLETED: {
    value: 'COMPLETED',
    icon: <CheckCircle2 className="size-3.75" />,
    tone: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    soft: 'bg-[var(--color-success)]/[.045]',
  },
  CANCELED: {
    value: 'CANCELED',
    icon: <XCircle className="size-3.75" />,
    tone: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    soft: 'bg-[var(--color-danger)]/[.045]',
  },
};

/**
 * True once Runtime has appended a reversal to this FINALIZED Sale, from the full Sale or from the
 * restricted completed-sale summary alike. The Sale itself stays FINALIZED and immutable.
 */
export function isReversedSale(
  sale: Pick<QueueSale, 'status'> & { reversal?: unknown; reversed?: boolean },
): boolean {
  return sale.status === 'FINALIZED' && (sale.reversed === true || sale.reversal != null);
}

/** User-facing status: an authoritative reversal takes precedence over FINALIZED. */
export function queueStatus(
  sale: Pick<QueueSale, 'status' | 'operationalState'> & {
    reversal?: unknown;
    reversed?: boolean;
  },
): QueueStatus | null {
  if (isReversedSale(sale)) return 'CANCELED';
  if (sale.status === 'FINALIZED') return 'COMPLETED';
  if (sale.status === 'VOIDED') return 'CANCELED';
  if (sale.operationalState === 'IN_PROGRESS') return 'PROGRESS';
  if (sale.operationalState === 'QUEUED') return 'QUEUED';
  return null;
}

export function queueStatusTone(status: QueueStatus | null) {
  if (status === 'QUEUED') return 'warning' as const;
  if (status === 'PROGRESS') return 'brand' as const;
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'CANCELED') return 'danger' as const;
  return 'neutral' as const;
}
