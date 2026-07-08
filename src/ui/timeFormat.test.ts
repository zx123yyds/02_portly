import { describe, expect, it } from 'vitest';
import { formatScanTime, formatTime } from './timeFormat';

describe('time formatting', () => {
  it('formats scan time with seconds because refresh runs every few seconds', () => {
    expect(formatScanTime('2026-07-06T05:27:08.000Z')).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('keeps invalid scan time readable', () => {
    expect(formatScanTime('not-a-date')).toBe('未扫描');
    expect(formatTime('not-a-date')).toBe('未扫描');
  });
});
