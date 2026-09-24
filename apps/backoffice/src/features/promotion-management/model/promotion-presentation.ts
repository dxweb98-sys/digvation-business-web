import type { Promotion, PromotionReferenceOption } from '../../../entities/promotion';

export function percentageDisplay(value: string) {
  const amount = Number(value) * 100;
  return Number.isFinite(amount) ? `${amount.toLocaleString()}%` : value;
}

export type PromotionCopy = (
  key: 'transaction' | 'category' | 'item' | 'variants' | 'selected',
) => string;

export function promotionTargetSummary(row: Promotion, copy: PromotionCopy) {
  if (row.scope === 'TRANSACTION') return copy('transaction');
  if (row.scope === 'CATEGORY' && row.itemIds.length > 0) {
    return `${row.categoryIds.length} ${copy('category')} · ${row.itemIds.length} ${copy('item')}`;
  }
  if (row.scope === 'ITEM') {
    const targets = [
      row.itemIds.length ? `${row.itemIds.length} ${copy('item')}` : null,
      row.variantIds.length ? `${row.variantIds.length} ${copy('variants')}` : null,
    ].filter((value): value is string => value !== null);
    return targets.join(' · ') || `0 ${copy('selected')}`;
  }
  return `${row.categoryIds.length} ${copy('selected')}`;
}

export interface PromotionItemTargetGroup {
  item: PromotionReferenceOption;
  variants: PromotionReferenceOption[];
}

export function filterPromotionItemTargets(
  items: PromotionReferenceOption[],
  variants: PromotionReferenceOption[],
  query: string,
): PromotionItemTargetGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return items.flatMap((item) => {
    const children = variants.filter((variant) => variant.catalogItemId === item.id);
    if (!normalizedQuery) return [{ item, variants: children }];

    const itemMatches = [item.name, item.code]
      .filter(Boolean)
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    const matchingVariants = children.filter((variant) =>
      [variant.name, variant.code]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );

    if (!itemMatches && matchingVariants.length === 0) return [];
    return [{ item, variants: itemMatches ? children : matchingVariants }];
  });
}
