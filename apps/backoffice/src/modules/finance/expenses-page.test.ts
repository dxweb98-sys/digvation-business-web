import { describe, expect, it } from 'vitest';
import { actorDisplayName } from './expenses-page';

describe('Expense actor presentation', () => {
  it('uses Runtime-projected display names rather than stable actor IDs', () => {
    expect(
      actorDisplayName(
        { id: '00000000-0000-4000-8000-000000000002', kind: 'user', displayName: 'Rina' },
        'Not set',
      ),
    ).toBe('Rina');
    expect(
      actorDisplayName(
        { id: 'expense-workflow', kind: 'machine', displayName: 'System' },
        'Not set',
      ),
    ).toBe('System');
  });
});
