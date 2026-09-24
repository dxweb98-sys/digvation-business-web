import type { ApiClient } from '@digvation/business-api';

export type LoyaltyEarningBehavior = 'FIXED' | 'EXCLUDED';

export interface LoyaltyConfiguration {
  configured: boolean;
  defaultEarningBehavior: LoyaltyEarningBehavior;
  defaultFixedPointsPerUnit: number;
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
