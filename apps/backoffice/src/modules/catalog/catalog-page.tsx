import { useRuntime } from '@digvation/business-runtime';
import {
  DButton,
  DDataTable,
  DSelectFilter,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { canPerformBackofficeAction, type BackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { CatalogApi, type CatalogManagementItem, type Category, type Item } from './catalog-api';
import { CatalogItemDetailDialog } from './catalog-item-detail-dialog';
import { LoyaltyApi } from '../loyalty/loyalty-api';
import { CatalogItemDialog } from './catalog-item-dialog';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { useCatalogLocalization } from './catalog-localization';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { PriceLabel, Status, humanize } from './catalog-shared';

type ItemFilterState = {
  q: string;
  type: '' | Item['type'];
  lifecycle: '' | Item['lifecycle'];
  categoryId: string;
};
type CategoryFilterState = { q: string; status: '' | Category['status'] };

const keys = {
  items: ['catalog', 'items'] as const,
  categories: ['catalog', 'categories'] as const,
  categoryOptions: ['catalog', 'category-options'] as const,
  defaults: (itemIds: string[], currency: string, effectiveAt: string) =>
    ['catalog', 'default-prices', itemIds, currency, effectiveAt] as const,
};

export function CatalogPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { copy } = useCatalogLocalization();
  const { apiBaseUrl, currency } = useRuntime();
  const api = useMemo(
    () => new CatalogApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const loyaltyApi = useMemo(
    () => new LoyaltyApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const client = useQueryClient();
  const [item, setItem] = useState<Item | null | undefined>();
  const [detailItem, setDetailItem] = useState<CatalogManagementItem | null>(null);
  const [category, setCategory] = useState<Category | null | undefined>();
  const [itemQuery, setItemQuery] = useState<ItemFilterState>({
    q: '',
    type: '',
    lifecycle: '',
    categoryId: '',
  });
  const [categoryQuery, setCategoryQuery] = useState<CategoryFilterState>({ q: '', status: '' });
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(10);
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);
  const [pricingEffectiveAt, setPricingEffectiveAt] = useState(() => new Date().toISOString());

  const can = (action: BackofficeAction) =>
    Boolean(session && canPerformBackofficeAction(session, action));
  const hasLoyaltyCapability = Boolean(
    session?.effectiveEntitlements.capabilities.includes('LOYALTY_POINTS'),
  );
  const canViewLoyalty = hasLoyaltyCapability && can('viewLoyalty');
  const canConfigureLoyalty = hasLoyaltyCapability && can('configureLoyalty');

  const categoryOptions = useQuery({
    queryKey: keys.categoryOptions,
    queryFn: () => api.listCategories({ limit: 100, offset: 0 }),
    enabled: Boolean(session),
  });
  const items = useQuery({
    queryKey: [...keys.items, itemQuery, itemPage, itemPageSize],
    queryFn: () =>
      api.listItems({
        ...toItemQuery(itemQuery),
        limit: itemPageSize,
        offset: (itemPage - 1) * itemPageSize,
      }),
    enabled: Boolean(session),
  });
  const categories = useQuery({
    queryKey: [...keys.categories, categoryQuery, categoryPage, categoryPageSize],
    queryFn: () =>
      api.listCategories({
        ...toCategoryQuery(categoryQuery),
        limit: categoryPageSize,
        offset: (categoryPage - 1) * categoryPageSize,
      }),
    enabled: Boolean(session),
  });
  const itemRows = items.data?.items ?? [];
  const defaultPrices = useQuery({
    queryKey: keys.defaults(
      itemRows.map((candidate) => candidate.id),
      currency,
      pricingEffectiveAt,
    ),
    queryFn: () =>
      api.listDefaultPrices(
        itemRows.map((candidate) => candidate.id),
        currency,
        pricingEffectiveAt,
      ),
    enabled: Boolean(session && can('viewPricing') && itemRows.length),
  });

  if (!session) return null;

  const refreshItems = () => {
    // Item saves can append prices effective now; read prices at a fresh instant.
    setPricingEffectiveAt(new Date().toISOString());
    void client.invalidateQueries({ queryKey: keys.items });
    void client.invalidateQueries({ queryKey: ['catalog', 'default-prices'] });
    void client.invalidateQueries({ queryKey: ['catalog', 'image'] });
  };
  const refreshCategories = () => {
    void client.invalidateQueries({ queryKey: keys.categories });
    void client.invalidateQueries({ queryKey: keys.categoryOptions });
  };
  const defaultPriceByItemId = new Map(
    defaultPrices.data?.items.map((price) => [price.catalogItemId, price]),
  );
  const allCategories = categoryOptions.data?.items ?? [];

  const itemColumns: TableColumn<CatalogManagementItem>[] = [
    {
      key: 'name',
      label: copy('Item'),
      render: (candidate) => (
        <div className="flex min-w-0 items-center gap-3">
          <CatalogItemThumbnail api={api} itemId={candidate.id} itemName={candidate.name} />
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium text-(--color-text)" title={candidate.name}>
              {candidate.name}
            </p>
            <p className="mt-0.5 text-xs text-(--color-text-muted)">{candidate.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', label: copy('Type'), render: (candidate) => copy(humanize(candidate.type)) },
    {
      key: 'categoryId',
      label: copy('Category'),
      render: (candidate) =>
        allCategories.find((record) => record.id === candidate.categoryId)?.name ?? '—',
    },
    {
      key: 'defaultPrice',
      label: copy('Price'),
      // Follow the selling model: an item that requires a variant has no price of its own to sell.
      render: (candidate) =>
        candidate.variantCount > 0 && candidate.variantSelectionMode === 'REQUIRED' ? (
          <span className="text-sm text-[var(--color-text-muted)]">Harga per varian</span>
        ) : (
          <div>
            <PriceLabel
              price={defaultPriceByItemId.get(candidate.id)}
              loading={defaultPrices.isLoading}
              available={can('viewPricing')}
            />
            {candidate.variantCount > 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">+ pilihan varian</p>
            ) : null}
          </div>
        ),
    },
    { key: 'variants', label: copy('Variants'), render: (candidate) => candidate.variantCount },
    {
      key: 'lifecycle',
      label: copy('Status'),
      render: (candidate) => <Status value={candidate.lifecycle} />,
    },
  ];
  const categoryColumns: TableColumn<Category>[] = [
    { key: 'name', label: copy('Name') },
    { key: 'code', label: copy('Code') },
    { key: 'status', label: copy('Status'), render: (record) => <Status value={record.status} /> },
  ];

  const changeItemFilter = (change: Partial<ItemFilterState>) => {
    setItemPage(1);
    setItemQuery((current) => ({ ...current, ...change }));
  };
  const changeCategoryFilter = (change: Partial<CategoryFilterState>) => {
    setCategoryPage(1);
    setCategoryQuery((current) => ({ ...current, ...change }));
  };

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Master Data')}
        title={copy('Catalog')}
        description={copy(
          'Manage items, categories, pricing, and variants from one catalog workspace.',
        )}
      />

      <DTabs defaultValue="items" className="mt-6">
        <DTabsList className="max-w-full overflow-x-auto">
          <DTabsTrigger value="items">{copy('Items')}</DTabsTrigger>
          <DTabsTrigger value="categories">{copy('Categories')}</DTabsTrigger>
        </DTabsList>

        <DTabsContent value="items" className="mt-4">
          <DDataTable
            columns={itemColumns}
            data={itemRows}
            loading={items.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search item name or code...')}
            searchValue={itemQuery.q}
            onSearchChange={(q) => changeItemFilter({ q })}
            filters={
              <>
                <DSelectFilter
                  label={copy('Type')}
                  value={itemQuery.type || null}
                  onChange={(type) => changeItemFilter({ type: (type ?? '') as '' | Item['type'] })}
                  clearable
                  options={[
                    { label: copy('Product'), value: 'PRODUCT' },
                    { label: copy('Service'), value: 'SERVICE' },
                  ]}
                />
                <DSelectFilter
                  label={copy('Status')}
                  value={itemQuery.lifecycle || null}
                  onChange={(lifecycle) =>
                    changeItemFilter({
                      lifecycle: (lifecycle ?? '') as '' | Item['lifecycle'],
                    })
                  }
                  clearable
                  options={[
                    { label: copy('Draft'), value: 'DRAFT' },
                    { label: copy('Active'), value: 'ACTIVE' },
                    { label: copy('Inactive'), value: 'INACTIVE' },
                  ]}
                />
                <DSelectFilter
                  label={copy('Category')}
                  value={itemQuery.categoryId || null}
                  onChange={(categoryId) =>
                    changeItemFilter({ categoryId: String(categoryId ?? '') })
                  }
                  clearable
                  options={allCategories.map((record) => ({
                    label: record.name,
                    value: record.id,
                  }))}
                />
              </>
            }
            headerActions={
              can('createCatalog') ? (
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setItem(null)}>
                  {copy('Add item')}
                </DButton>
              ) : null
            }
            emptyMessage={
              itemQuery.q || itemQuery.type || itemQuery.lifecycle || itemQuery.categoryId
                ? copy('No matching items found.')
                : copy('No catalog items are available.')
            }
            pagination={{
              page: itemPage,
              pageSize: itemPageSize,
              total: items.data?.total ?? 0,
            }}
            onPageChange={setItemPage}
            onPageSizeChange={(size) => {
              setItemPageSize(size);
              setItemPage(1);
            }}
            actions={[
              {
                label: copy('View details'),
                icon: <Eye className="size-4" />,
                onClick: setDetailItem,
              },
              {
                label: copy('Edit item'),
                icon: <Pencil className="size-4" />,
                onClick: setItem,
                show: () => can('updateCatalog'),
              },
            ]}
          />
        </DTabsContent>

        <DTabsContent value="categories" className="mt-4">
          <DDataTable
            columns={categoryColumns}
            data={categories.data?.items ?? []}
            loading={categories.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search category name or code...')}
            searchValue={categoryQuery.q}
            onSearchChange={(q) => changeCategoryFilter({ q })}
            filters={
              <DSelectFilter
                label={copy('Status')}
                value={categoryQuery.status || null}
                onChange={(status) =>
                  changeCategoryFilter({
                    status: (status ?? '') as '' | Category['status'],
                  })
                }
                clearable
                options={[
                  { label: copy('Active'), value: 'ACTIVE' },
                  { label: copy('Inactive'), value: 'INACTIVE' },
                ]}
              />
            }
            headerActions={
              can('createCatalog') ? (
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setCategory(null)}>
                  {copy('Add category')}
                </DButton>
              ) : null
            }
            emptyMessage={
              categoryQuery.q || categoryQuery.status
                ? copy('No matching categories found.')
                : copy('No catalog categories are available.')
            }
            pagination={{
              page: categoryPage,
              pageSize: categoryPageSize,
              total: categories.data?.total ?? 0,
            }}
            onPageChange={setCategoryPage}
            onPageSizeChange={(size) => {
              setCategoryPageSize(size);
              setCategoryPage(1);
            }}
            actions={[
              {
                label: copy('Edit category'),
                icon: <Pencil className="size-4" />,
                onClick: setCategory,
                show: () => can('updateCatalog'),
              },
            ]}
          />
        </DTabsContent>
      </DTabs>

      <CatalogItemDialog
        key={item?.id ?? (item === null ? 'new' : 'closed')}
        item={item}
        categories={allCategories}
        currency={currency}
        api={api}
        loyaltyApi={loyaltyApi}
        canViewLoyalty={canViewLoyalty}
        canConfigureLoyalty={canConfigureLoyalty}
        canViewPricing={can('viewPricing')}
        canCreatePricing={can('createPricing')}
        canCreateVariants={can('createCatalog')}
        canManageImage={can('updateCatalog')}
        onClose={() => setItem(undefined)}
        onSaved={refreshItems}
      />
      <CatalogItemDetailDialog
        key={detailItem?.id ?? 'closed'}
        item={detailItem}
        categories={allCategories}
        defaultPrice={detailItem ? defaultPriceByItemId.get(detailItem.id) : undefined}
        defaultPriceLoading={defaultPrices.isLoading}
        currency={currency}
        effectiveAt={pricingEffectiveAt}
        api={api}
        loyaltyApi={loyaltyApi}
        canViewLoyalty={canViewLoyalty}
        canCreate={can('createCatalog')}
        canUpdate={can('updateCatalog')}
        canViewPricing={can('viewPricing')}
        canCreatePricing={can('createPricing')}
        canCancelPricing={can('cancelPricing')}
        onPricingChanged={() => {
          setPricingEffectiveAt(new Date().toISOString());
          void client.invalidateQueries({ queryKey: ['catalog', 'prices', detailItem?.id ?? ''] });
          void client.invalidateQueries({ queryKey: ['catalog', 'default-prices'] });
        }}
        onVariantsChanged={refreshItems}
        onClose={() => setDetailItem(null)}
        onEdit={(selected) => {
          setDetailItem(null);
          setItem(selected);
        }}
      />
      <CatalogNamedRecordDialog
        key={`category-${category?.id ?? (category === null ? 'new' : 'closed')}`}
        entity="Category"
        item={category}
        onClose={() => setCategory(undefined)}
        onSave={(existing, input) =>
          existing ? api.updateCategory(existing as Category, input) : api.createCategory(input)
        }
        onSaved={refreshCategories}
      />
    </BackofficePage>
  );
}

function toItemQuery({ q, type, lifecycle, categoryId }: ItemFilterState) {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(type ? { type } : {}),
    ...(lifecycle ? { lifecycle } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
}

function toCategoryQuery({ q, status }: CategoryFilterState) {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(status ? { status } : {}),
  };
}
