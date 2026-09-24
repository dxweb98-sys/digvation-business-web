import type { ApiClient } from '@digvation/business-api';
import { buildQueryString } from '../../../shared/api/build-query-string';
import type { Promotion } from '../model/promotion.types';

import type {
  PromotionListQuery,
  PromotionPage,
  PromotionReferenceOptions,
  PromotionWriteInput,
} from './promotion.contracts';

export class PromotionsApi {
  public constructor(private readonly client: ApiClient) {}

  list(query: PromotionListQuery = { limit: 100, offset: 0 }) {
    return this.client.get<PromotionPage>(
      `/api/v1/promotions?${buildQueryString({ limit: 100, offset: 0, ...query })}`,
    );
  }

  options() {
    return this.client.get<PromotionReferenceOptions>('/api/v1/promotions/options');
  }

  create(input: PromotionWriteInput) {
    return this.client.post<Promotion>('/api/v1/promotions', input);
  }

  update(id: string, expectedVersion: number, input: PromotionWriteInput) {
    return this.client.patch<Promotion>(`/api/v1/promotions/${id}`, {
      expectedVersion,
      ...input,
    });
  }
}
