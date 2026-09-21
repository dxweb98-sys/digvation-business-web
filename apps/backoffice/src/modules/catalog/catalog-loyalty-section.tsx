import { DSkeleton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';

import type { LoyaltyApi } from '../loyalty/loyalty-api';
import type { CatalogManagementItem } from './catalog-api';
import { CatalogSection, DetailField } from './catalog-shared';

const keys = {
  configuration: ['loyalty', 'configuration'] as const,
  rules: ['loyalty', 'earning-rules'] as const,
};

export function CatalogLoyaltySection({
  item,
  api,
}: {
  item: CatalogManagementItem;
  api: LoyaltyApi;
}) {
  const configuration = useQuery({
    queryKey: keys.configuration,
    queryFn: () => api.getConfiguration(),
  });
  const rules = useQuery({ queryKey: keys.rules, queryFn: () => api.listEarningRules() });
  const rule = rules.data?.find((candidate) => candidate.catalogItemId === item.id);
  const behavior = rule?.behavior ?? configuration.data?.defaultEarningBehavior;
  const points = rule?.fixedPointsPerUnit ?? configuration.data?.defaultFixedPointsPerUnit;
  const effective =
    behavior === 'EXCLUDED'
      ? 'Tidak dapat poin'
      : points !== undefined
        ? `${points} poin / unit`
        : 'Memuat aturan poin...';
  return (
    <CatalogSection title="Loyalty" tone="secondary">
      {configuration.isLoading || rules.isLoading ? (
        <DSkeleton className="h-16" />
      ) : (
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <DetailField label="Sumber aturan" value={rule ? 'Aturan khusus' : 'Mengikuti default'} />
          <DetailField label="Hasil efektif" value={effective} />
        </dl>
      )}
    </CatalogSection>
  );
}
