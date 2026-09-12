import { useQuery } from '@tanstack/react-query';
import { Image as ImageIcon } from 'lucide-react';
import type { CatalogApi } from './catalog-api';

export function CatalogItemThumbnail({
  api,
  itemId,
  itemName,
  size = 'table',
}: {
  api: CatalogApi;
  itemId: string;
  itemName: string;
  size?: 'table' | 'detail';
}) {
  const image = useQuery({
    queryKey: ['catalog', 'image', itemId],
    queryFn: () => api.getItemImage(itemId),
    staleTime: 60_000,
  });
  const dimensions = size === 'detail' ? 'size-32 rounded-2xl' : 'size-11 rounded-xl';

  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-muted)] ${dimensions}`}
    >
      {image.data?.url ? (
        <img src={image.data.url} alt={itemName} className="size-full object-cover" />
      ) : (
        <ImageIcon
          aria-hidden="true"
          className={size === 'detail' ? 'size-8 text-[var(--color-text-muted)]' : 'size-4 text-[var(--color-text-muted)]'}
        />
      )}
    </div>
  );
}
