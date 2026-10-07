export const cashierTransactionKeys = {
  all: ['cashier-transaction'] as const,
  locations: () => ['cashier-transaction', 'locations'] as const,
  operationalCatalog: (sellingLocationId: string, currency: string) =>
    ['cashier-transaction', 'operational-catalog', sellingLocationId, currency] as const,
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
  servicePerformers: () => ['cashier-transaction', 'service-performers'] as const,
  productSalespeople: () => ['cashier-transaction', 'product-salespeople'] as const,
  paymentRoutes: (sellingLocationId: string, currency: string) =>
    ['cashier-transaction', 'payment-routes', sellingLocationId, currency] as const,
  taxConfiguration: () => ['cashier-transaction', 'tax-configuration'] as const,
  /** One entry per exact draft pricing input, so a response can only ever describe its own cart. */
  pricingPreview: (input: unknown) => ['cashier-transaction', 'pricing-preview', input] as const,
  contributionPreview: (saleId: string, saleLineId: string) =>
    ['cashier-transaction', 'contribution-preview', saleId, saleLineId] as const,
  sales: () => ['cashier-transaction', 'operational-queue'] as const,
  sale: (saleId: string) => ['cashier-transaction', 'sale', saleId] as const,
};
