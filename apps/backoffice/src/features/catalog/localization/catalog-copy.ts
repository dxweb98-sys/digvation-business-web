import { catalogDetailCopy } from './catalog-detail-copy';
import { catalogPricingCopy } from './catalog-pricing-copy';
import { catalogWorkspaceCopy } from './catalog-workspace-copy';

export const catalogCopy: Record<string, { id: string; en: string }> = {
  ...catalogWorkspaceCopy,
  ...catalogDetailCopy,
  ...catalogPricingCopy,
};
