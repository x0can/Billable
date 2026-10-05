import { describe, it, expect } from 'vitest';
import { formatMoney, formatHours } from './format';

describe('format', () => {
  it('formats money as USD', () => {
    expect(formatMoney(290)).toBe('$290.00');
    expect(formatMoney('1234.5')).toBe('$1,234.50');
    expect(formatMoney(null)).toBe('$0.00');
  });
  it('formats hours with two decimals', () => {
    expect(formatHours(2.5)).toBe('2.50h');
    expect(formatHours(undefined)).toBe('0.00h');
  });
});
