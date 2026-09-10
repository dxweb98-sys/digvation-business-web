export const cashierTransactionKeys = {
  all: ['cashier-transaction'] as const,
  locations: () => ['cashier-transaction', 'locations'] as const,
  categories: () => ['cashier-transaction', 'catalog-categories'] as const,
  items: (sellingLocationId: string, currency: string) =>
    ['cashier-transaction', 'catalog-items', sellingLocationId, currency] as const,
  variants: (catalogItemId: string) =>
    ['cashier-transaction', 'catalog-variants', catalogItemId] as const,
  resolvedPrice: (
    catalogItemId: string,
    catalogVariantId: string | null,
    sellingLocationId: string,
    currency: string,
  ) =>
    [
      'cashier-transaction',
      'resolved-price',
      catalogItemId,
      catalogVariantId ?? 'base',
      sellingLocationId,
      currency,
    ] as const,
  employees: () => ['cashier-transaction', 'employees'] as const,
  contributionPreview: (saleId: string, saleLineId: string) =>
    ['cashier-transaction', 'contribution-preview', saleId, saleLineId] as const,
  sales: () => ['cashier-transaction', 'sales'] as const,
  sale: (saleId: string) => ['cashier-transaction', 'sale', saleId] as const,
};
