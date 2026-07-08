import { describe, expect, it } from 'vitest';
import { resolveTerminalDirectory } from './pathUtils';

describe('resolveTerminalDirectory', () => {
  it('opens app bundle paths from their containing directory', () => {
    expect(resolveTerminalDirectory('/Applications/Comate.app')).toBe('/Applications');
  });

  it('keeps normal directories unchanged', () => {
    expect(resolveTerminalDirectory('/Users/me/work/portly')).toBe('/Users/me/work/portly');
  });
});
