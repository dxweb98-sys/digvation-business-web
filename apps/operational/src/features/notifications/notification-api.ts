import type { ApiClient } from '@digvation/business-api';

export type NotificationCategory = 'FINANCE' | 'TRANSACTION';
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type NotificationType =
  'EXPENSE_APPROVAL_REQUIRED' | 'EXPENSE_APPROVED' | 'EXPENSE_REJECTED' | 'PAYMENT_FAILED';

export interface BusinessNotification {
  id: string;
  category: NotificationCategory;
  type: NotificationType;
  severity: NotificationSeverity;
  displayData: Record<string, unknown>;
  resourceType: string | null;
  resourceId: string | null;
  sellingLocationId: string | null;
  actionPath: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: BusinessNotification[];
  total: number;
  limit: number;
  offset: number;
}

export class NotificationApi {
  constructor(private readonly client: ApiClient) {}

  list(limit: number, offset: number) {
    return this.client.get<NotificationPage>(
      `/api/v1/notifications?limit=${limit}&offset=${offset}`,
    );
  }

  unreadCount() {
    return this.client.get<{ count: number }>('/api/v1/notifications/unread-count');
  }

  markRead(id: string) {
    return this.client.post<BusinessNotification>(`/api/v1/notifications/${id}/read`, {});
  }

  markAllRead() {
    return this.client.post<{ updated: number }>('/api/v1/notifications/read-all', {});
  }
}
