import { DBadge, DSkeleton } from '@digvation/ui';
import { Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import type { LoyaltyApi } from '../../../modules/loyalty/loyalty-api';
import type { CatalogManagementItem } from '../api/catalog-api';
import { CatalogInfoTile } from './catalog-shared';

const keys = {
  configuration: ['loyalty', 'configuration'] as const,
  rules: ['loyalty', 'earning-rules'] as const,
};

export function CatalogLoyaltyTile({
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
  const excluded = behavior === 'EXCLUDED';
  const effective = excluded
    ? 'Tidak dapat poin'
    : points !== undefined
      ? `+${points} PTS`
      : 'Belum diatur';

  return (
    <CatalogInfoTile
      label="Poin Loyalitas Member"
      icon={<Star className="size-3.5" aria-hidden="true" />}
      className="border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[0.035]"
    >
      {configuration.isLoading || rules.isLoading ? (
        <DSkeleton className="mt-2 h-12" />
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {excluded ? effective : `${effective} `}
                {!excluded ? (
                  <span className="font-medium text-[var(--color-text-muted)]">/ unit</span>
                ) : null}
              </p>
            </div>
            <DBadge variant={excluded ? 'secondary' : 'success'}>
              {excluded ? 'Nonaktif' : 'Aktif'}
            </DBadge>
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-[var(--color-text-muted)]">
            {excluded
              ? 'Item ini tidak memberikan poin member.'
              : rule
                ? 'Menggunakan aturan poin khusus untuk item ini.'
                : 'Mengikuti aturan poin default bisnis.'}
          </p>
        </>
      )}
    </CatalogInfoTile>
  );
}
