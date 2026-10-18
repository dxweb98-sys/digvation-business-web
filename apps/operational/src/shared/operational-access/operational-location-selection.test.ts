import { describe, expect, it } from 'vitest';

import {
  resolveOperationalLocationSelection,
  resolveReceiptLocation,
} from './operational-location-selection';

const locations = [
  { id: 'branch-a', code: 'A', name: 'Branch A', address: null },
  { id: 'branch-b', code: 'B', name: 'Branch B', address: null },
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

describe('resolveReceiptLocation', () => {
  const multiLocation = [
    { id: 'branch-a', code: 'A', name: 'Branch A', address: 'Jl. A No. 1' },
    { id: 'branch-b', code: 'B', name: 'Branch B', address: null },
  ];

  it("resolves the Sale's own selling location, not the first or main location", () => {
    expect(resolveReceiptLocation('branch-b', multiLocation)).toMatchObject({
      id: 'branch-b',
      name: 'Branch B',
    });
  });

  it('carries the address of the resolved location, never another location', () => {
    expect(resolveReceiptLocation('branch-a', multiLocation)?.address).toBe('Jl. A No. 1');
    expect(resolveReceiptLocation('branch-b', multiLocation)?.address).toBeNull();
  });

  it('returns null instead of inventing a location when the id is not found', () => {
    expect(resolveReceiptLocation('unknown-location', multiLocation)).toBeNull();
  });
});
