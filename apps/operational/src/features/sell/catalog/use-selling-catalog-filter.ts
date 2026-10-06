import { useMemo, useState } from 'react';
import { visibleCatalogItems } from './selling-catalog-eligibility';
import type { CatalogItemTypeFilter } from './use-selling-catalog';
import type { CatalogItem, NamedRecord } from '../transaction/model/cashier-transaction.types';

/** Catalog browsing state of the sell workspace: search text, category chip, item type switch. */
export function useSellingCatalogFilter({
  workspace,
}: {
  workspace: {
    categories: NamedRecord[];
    items: CatalogItem[];
    locale: string;
    setItemType: (itemType: CatalogItemTypeFilter) => void;
  };
}) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const categories = useMemo(
    () =>
      workspace.categories.filter((category) =>
        workspace.items.some((item) => item.categoryId === category.id),
      ),
    [workspace.categories, workspace.items],
  );
  const visibleItems = useMemo(
    () =>
      visibleCatalogItems(workspace.items, {
        search,
        categoryId: selectedCategory,
        locale: workspace.locale,
      }),
    [search, selectedCategory, workspace.items, workspace.locale],
  );
  const selectType = (type: CatalogItemTypeFilter) => {
    workspace.setItemType(type);
    setSelectedCategory('');
  };
  return {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    categories,
    visibleItems,
    selectType,
  };
}
