import { useRuntime } from '@digvation/business-runtime';
import { DBadge, DButton, DDataTable, DSkeleton, type TableColumn } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../../auth/backoffice-access';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { PromotionsApi, type Promotion } from '../../../entities/promotion';
import { usePromotionsLocalization } from '../config/promotion.i18n';
import { percentageDisplay, promotionTargetSummary } from '../model/promotion-presentation';
import { PromotionDialog } from './promotion-dialog';

const keys = {
  list: ['promotions', 'list'] as const,
  options: ['promotions', 'options'] as const,
};

export function PromotionsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const promotionCopy = usePromotionsLocalization();
  const { formatDate } = useBackofficeLocalization();
  const api = useMemo(
    () => new PromotionsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [editing, setEditing] = useState<Promotion | null | undefined>(undefined);

  const canCreate = Boolean(session && canPerformBackofficeAction(session, 'createPromotion'));
  const canUpdate = Boolean(session && canPerformBackofficeAction(session, 'updatePromotion'));

  const promotions = useQuery({
    queryKey: keys.list,
    queryFn: () => api.list(),
  });
  const options = useQuery({
    queryKey: keys.options,
    queryFn: () => api.options(),
  });

  if (!session) return null;

  const columns: TableColumn<Promotion>[] = [
    {
      key: 'name',
      label: promotionCopy('name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{row.name}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {row.mode === 'CODE' ? row.code : promotionCopy('automatic')}
          </p>
        </div>
      ),
    },
    {
      key: 'scope',
      label: promotionCopy('scope'),
      render: (row) =>
        promotionCopy(row.scope.toLowerCase() as 'item' | 'category' | 'transaction'),
    },
    {
      key: 'discountValue',
      label: promotionCopy('discount'),
      render: (row) =>
        row.discountType === 'PERCENTAGE'
          ? percentageDisplay(row.discountValue)
          : `${row.currency ?? ''} ${row.discountValue}`.trim(),
    },
    {
      key: 'itemIds',
      label: promotionCopy('targetSummary'),
      render: (row) => promotionTargetSummary(row, promotionCopy),
    },
    {
      key: 'effectiveFrom',
      label: promotionCopy('effectivity'),
      render: (row) => {
        const from = row.effectiveFrom
          ? formatDate(new Date(row.effectiveFrom), { dateStyle: 'medium' })
          : promotionCopy('immediate');
        const until = row.effectiveUntil
          ? formatDate(new Date(row.effectiveUntil), { dateStyle: 'medium' })
          : promotionCopy('noEnd');
        return `${from} → ${until}`;
      },
    },
    {
      key: 'status',
      label: promotionCopy('status'),
      render: (row) => (
        <DBadge variant={row.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {promotionCopy(
            row.status === 'ACTIVE'
              ? 'active'
              : row.status === 'SCHEDULED'
                ? 'scheduled'
                : row.status === 'EXPIRED'
                  ? 'expired'
                  : 'disabled',
          )}
        </DBadge>
      ),
    },
  ];

  const loading = promotions.isLoading || options.isLoading;
  const referenceOptions = options.data ?? {
    items: [],
    variants: [],
    categories: [],
    locations: [],
  };

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={promotionCopy('title')}
        title={promotionCopy('title')}
        description={promotionCopy('description')}
      />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <DSkeleton className="h-12 w-full" />
            <DSkeleton className="h-16 w-full" />
            <DSkeleton className="h-16 w-full" />
          </div>
        ) : (
          <DDataTable
            columns={columns}
            data={promotions.data?.items ?? []}
            rowKey="id"
            emptyMessage={promotionCopy('empty')}
            headerActions={
              canCreate ? (
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
                  {promotionCopy('add')}
                </DButton>
              ) : null
            }
            actions={
              canUpdate
                ? [
                    {
                      label: promotionCopy('edit'),
                      icon: <Pencil className="size-4" />,
                      onClick: (row) => setEditing(row),
                    },
                  ]
                : []
            }
          />
        )}
      </div>

      {editing !== undefined ? (
        <PromotionDialog
          promotion={editing}
          options={referenceOptions}
          api={api}
          onClose={() => setEditing(undefined)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: keys.list });
          }}
        />
      ) : null}
    </BackofficePage>
  );
}
