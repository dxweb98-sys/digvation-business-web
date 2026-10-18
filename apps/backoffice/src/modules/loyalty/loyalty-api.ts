import type { ApiClient } from '@digvation/business-api';

export type LoyaltyEarningBehavior = 'FIXED' | 'EXCLUDED';
/** Exactly one earning mode is authoritative per Sale; modes never stack. */
export type LoyaltyEarningMode = 'PER_ITEM' | 'TRANSACTION_TOTAL';
export type LoyaltyEarnWhileRedeemingPolicy = 'EARN_WHEN_REDEEMING' | 'NO_EARN_WHEN_REDEEMING';

export interface LoyaltyConfiguration {
  configured: boolean;
  earningMode: LoyaltyEarningMode;
  defaultEarningBehavior: LoyaltyEarningBehavior;
  defaultFixedPointsPerUnit: number;
  /** Kept while PER_ITEM is active; Runtime requires it while TRANSACTION_TOTAL is active. */
  transactionAmountPerStep: string | null;
  transactionPointsPerStep: number | null;
  earnWhileRedeemingPolicy: LoyaltyEarnWhileRedeemingPolicy;
  pointValue: string | null;
  currency: string;
  version: number;
}

export interface LoyaltyEarningRule {
  catalogItemId: string;
  behavior: LoyaltyEarningBehavior;
  fixedPointsPerUnit: number;
  version: number;
}

export interface UpdateLoyaltyConfigurationInput {
  expectedVersion: number;
  defaultEarningBehavior: LoyaltyEarningBehavior;
  defaultFixedPointsPerUnit: number;
  pointValue: string;
  earningMode?: LoyaltyEarningMode;
  transactionAmountPerStep?: string;
  transactionPointsPerStep?: number;
  earnWhileRedeemingPolicy?: LoyaltyEarnWhileRedeemingPolicy;
}

export interface UpdateLoyaltyEarningRuleInput {
  expectedVersion: number;
  behavior: LoyaltyEarningBehavior;
  fixedPointsPerUnit: number;
}

export class LoyaltyApi {
  public constructor(private readonly client: ApiClient) {}

  getConfiguration() {
    return this.client.get<LoyaltyConfiguration>('/api/v1/loyalty/configuration');
  }
  updateConfiguration(input: UpdateLoyaltyConfigurationInput) {
    return this.client.put<LoyaltyConfiguration>('/api/v1/loyalty/configuration', input);
  }
  listEarningRules() {
    return this.client.get<LoyaltyEarningRule[]>('/api/v1/loyalty/earning-rules');
  }
  updateEarningRule(catalogItemId: string, input: UpdateLoyaltyEarningRuleInput) {
    return this.client.put<LoyaltyEarningRule>(
      `/api/v1/loyalty/earning-rules/${catalogItemId}`,
      input,
    );
  }
}
