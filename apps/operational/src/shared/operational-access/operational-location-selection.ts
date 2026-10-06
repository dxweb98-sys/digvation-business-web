import type { OperationalLocation } from './operational-access-api';

/**
 * The receipt header must reflect the SALE's own sellingLocationId, never the
 * operator's currently-selected branch or the tenant's Main Branch: a
 * historical Sale may belong to a different Location than either of those.
 */
export function resolveReceiptLocation(
  sellingLocationId: string,
  locations: readonly OperationalLocation[],
): OperationalLocation | null {
  return locations.find((location) => location.id === sellingLocationId) ?? null;
}

export function resolveOperationalLocationSelection(
  locations: readonly OperationalLocation[],
  selectedLocationId: string | null,
  mainLocationId: string | null,
): string | null {
  if (selectedLocationId && locations.some((location) => location.id === selectedLocationId))
    return selectedLocationId;
  if (locations.length === 1) return locations[0]!.id;
  if (
    locations.length > 1 &&
    mainLocationId &&
    locations.some((location) => location.id === mainLocationId)
  )
    return mainLocationId;
  return null;
}
