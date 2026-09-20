import { describe, expect, it } from 'vitest';
import { historyEvent } from './employee-detail-dialog';

describe('Employee lifecycle actor presentation', () => {
  it('carries the Runtime-projected actor display name into status history', () => {
    expect(
      historyEvent({
        id: 'history-1',
        previousStatus: 'ACTIVE',
        newStatus: 'INACTIVE',
        reason: 'Inactive',
        transitionedAt: '2026-09-20T00:00:00.000Z',
        actorId: '00000000-0000-4000-8000-000000000002',
        actorKind: 'user',
        actor: {
          id: '00000000-0000-4000-8000-000000000002',
          kind: 'user',
          displayName: 'Rina',
        },
      }),
    ).toMatchObject({ actorDisplayName: 'Rina' });
  });
});
