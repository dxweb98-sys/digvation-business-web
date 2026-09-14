import { describe, expect, it } from 'vitest';

import { resolveOperationalLocationSelection } from './operational-location-selection';

const locations = [
  { id: 'branch-a', code: 'A', name: 'Branch A' },
  { id: 'branch-b', code: 'B', name: 'Branch B' },
];

describe('resolveOperationalLocationSelection', () => {
  it('uses the only permitted location', () => {
    expect(resolveOperationalLocationSelection(locations.slice(0, 1), null, null)).toBe('branch-a');
  });

  it('uses a permitted stored selection before the canonical Main Branch', () => {
    expect(resolveOperationalLocationSelection(locations, 'branch-a', 'branch-b')).toBe('branch-a');
  });

  it('uses the permitted canonical Main Branch without inferring from names or order', () => {
    expect(resolveOperationalLocationSelection(locations, null, 'branch-b')).toBe('branch-b');
  });

  it('requires explicit selection when no permitted canonical Main Branch exists', () => {
    expect(resolveOperationalLocationSelection(locations, null, null)).toBeNull();
    expect(resolveOperationalLocationSelection(locations, null, 'outside-scope')).toBeNull();
  });

  it('discards a stored selection that is no longer permitted', () => {
    expect(resolveOperationalLocationSelection(locations, 'outside-scope', null)).toBeNull();
  });
});
