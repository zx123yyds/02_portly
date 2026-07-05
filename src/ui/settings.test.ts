import { describe, expect, it } from 'vitest';
import { normalizeRefreshInterval, normalizeTheme, refreshIntervalFillPercent } from './settings';

describe('settings normalization', () => {
  it('keeps refresh interval inside the supported 1-60 second range', () => {
    expect(normalizeRefreshInterval(0)).toBe(1);
    expect(normalizeRefreshInterval(5)).toBe(5);
    expect(normalizeRefreshInterval(61)).toBe(60);
    expect(normalizeRefreshInterval('30')).toBe(30);
    expect(normalizeRefreshInterval('abc')).toBe(5);
  });

  it('accepts only supported theme values', () => {
    expect(normalizeTheme('system')).toBe('system');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('purple')).toBe('system');
  });

  it('maps refresh interval to slider fill percentage', () => {
    expect(refreshIntervalFillPercent(1)).toBe('0%');
    expect(refreshIntervalFillPercent(60)).toBe('100%');
    expect(refreshIntervalFillPercent(30)).toBe('49.2%');
  });
});
