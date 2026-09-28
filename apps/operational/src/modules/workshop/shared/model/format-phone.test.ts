import { describe, expect, it } from 'vitest';

import { formatPhoneForDisplay } from './format-phone';

describe('Workshop phone display', () => {
  it('shows an Indonesian E.164 number in local grouped form without changing the stored value', () => {
    expect(formatPhoneForDisplay('+6281234567890')).toBe('0812 3456 7890');
    expect(formatPhoneForDisplay('+628111222333')).toBe('0811 1222 333');
  });

  it('keeps an already-local number readable', () => {
    expect(formatPhoneForDisplay('081234567890')).toBe('0812 3456 7890');
  });
});
