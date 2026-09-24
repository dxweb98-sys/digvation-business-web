export { usePromotionsLocalization } from './config/promotion.i18n';
export type { PromotionMessageKey } from './config/promotion.i18n';

export {
  filterPromotionItemTargets,
  percentageDisplay,
  promotionTargetSummary,
} from './model/promotion-presentation';
export type {
  PromotionCopy,
  PromotionItemTargetGroup,
} from './model/promotion-presentation';

export { PromotionsPage } from './ui/promotions-page';
