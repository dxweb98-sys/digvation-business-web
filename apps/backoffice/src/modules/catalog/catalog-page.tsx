import { useRuntime } from '@digvation/business-runtime';
import { DButton, DDataTable, DSelectFilter, type TableColumn } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { canPerformBackofficeAction, type BackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  CatalogApi,
  type CatalogManagementItem,
  type Category,
  type Item,
} from './catalog-api';
import { CatalogItemDetailDialog } from './catalog-item-detail-dialog';
import { CatalogItemDialog } from './catalog-item-dialog';
import { useCatalogLocalization } from './catalog-localization';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { PriceLabel, Status, humanize } from './catalog-shared';

type Section = 'items' | 'categories';
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
  taxCategories: ['catalog', 'tax-categories'] as const,
  taxProfile: ['catalog', 'tax-profile'] as const,
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
  const client = useQueryClient();
  const [section, setSection] = useState<Section>('items');
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
  const canViewTax = can('viewTax');

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
  const taxCategories = useQuery({
    queryKey: keys.taxCategories,
    queryFn: () => api.listTaxCategories(),
    enabled: Boolean(session && canViewTax),
  });
  const taxProfile = useQuery({
    queryKey: keys.taxProfile,
    queryFn: () => api.getTaxProfile(),
    enabled: Boolean(session && canViewTax),
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
    void client.invalidateQueries({ queryKey: keys.items });
    void client.invalidateQueries({ queryKey: ['catalog', 'default-prices'] });
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
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{candidate.name}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{candidate.code}</p>
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
      label: copy('Default Price'),
      render: (candidate) => (
        <PriceLabel
          price={defaultPriceByItemId.get(candidate.id)}
          loading={defaultPrices.isLoading}
          available={can('viewPricing')}
        />
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
          'Manage items, categories, pricing, variants, and tax assignment from one catalog workspace.',
        )}
      />

      <div className="mt-6 flex gap-1 border-b border-[var(--color-border)]">
        {(['items', 'categories'] as Section[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setSection(candidate)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              section === candidate
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {candidate === 'items' ? copy('Items') : copy('Categories')}
          </button>
        ))}
      </div>

      {section === 'items' ? (
        <section className="mt-6">
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
                  onChange={(type) =>
                    changeItemFilter({ type: (type ?? '') as '' | Item['type'] })
                  }
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
        </section>
      ) : (
        <section className="mt-6">
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
        </section>
      )}

      <CatalogItemDialog
        key={item?.id ?? (item === null ? 'new' : 'closed')}
        item={item}
        categories={allCategories}
        taxCategories={taxCategories.data?.items ?? []}
        taxProfile={taxProfile.data}
        currency={currency}
        api={api}
        canViewTax={canViewTax}
        canCreatePricing={can('createPricing')}
        canCreateVariants={can('createCatalog')}
        onClose={() => setItem(undefined)}
        onSaved={refreshItems}
      />
      <CatalogItemDetailDialog
        key={detailItem?.id ?? 'closed'}
        item={detailItem}
        categories={allCategories}
        taxCategories={taxCategories.data?.items ?? []}
        defaultPrice={detailItem ? defaultPriceByItemId.get(detailItem.id) : undefined}
        defaultPriceLoading={defaultPrices.isLoading}
        currency={currency}
        effectiveAt={pricingEffectiveAt}
        api={api}
        canCreate={can('createCatalog')}
        canUpdate={can('updateCatalog')}
        canViewPricing={can('viewPricing')}
        canCreatePricing={can('createPricing')}
        canCancelPricing={can('cancelPricing')}
        canViewTax={canViewTax}
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
          existing
            ? api.updateCategory(existing as Category, input)
            : api.createCategory(input)
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
