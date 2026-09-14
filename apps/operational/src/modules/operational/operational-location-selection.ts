import type { OperationalLocation } from './operational-access-api';

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
