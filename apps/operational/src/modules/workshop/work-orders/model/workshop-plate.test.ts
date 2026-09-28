import { describe, expect, it } from 'vitest';

import { composePlate, parsePlate, sanitizePlatePart } from './workshop-plate';

describe('workshop plate', () => {
  it('sanitizes each segment to its own alphabet and length', () => {
    expect(sanitizePlatePart('prefix', 'b1')).toBe('B');
    expect(sanitizePlatePart('prefix', 'abc')).toBe('AB');
    expect(sanitizePlatePart('number', '12a34567')).toBe('1234');
    expect(sanitizePlatePart('suffix', 'ab-c1d')).toBe('ABC');
  });

  it('composes the canonical plate string', () => {
    expect(composePlate({ prefix: 'B', number: '1234', suffix: 'ABC' })).toBe('B 1234 ABC');
    expect(composePlate({ prefix: 'AD', number: '12', suffix: '' })).toBe('AD 12');
  });

  it('is empty until prefix and number exist', () => {
    expect(composePlate({ prefix: '', number: '1234', suffix: 'ABC' })).toBe('');
    expect(composePlate({ prefix: 'B', number: '', suffix: 'ABC' })).toBe('');
  });

  it.each([
    ['B 1234 ABC', { prefix: 'B', number: '1234', suffix: 'ABC' }],
    ['b1234abc', { prefix: 'B', number: '1234', suffix: 'ABC' }],
    ['AD 12', { prefix: 'AD', number: '12', suffix: '' }],
  ])('parses %s', (input, expected) => {
    expect(parsePlate(input)).toEqual(expected);
  });

  it.each(['', 'ABC', '1234', 'B 12345 ABC', 'B 1234 ABCD'])('rejects %j', (input) => {
    expect(parsePlate(input)).toBeNull();
  });
});
