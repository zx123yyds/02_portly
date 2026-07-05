import { describe, expect, it, vi } from 'vitest';
import { setLoginItemState } from './loginItem';

describe('setLoginItemState', () => {
  it('rejects launch-at-login changes in dev mode', () => {
    const loginItemApp = {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
      setLoginItemSettings: vi.fn()
    };

    const result = setLoginItemState(true, { isDev: true, loginItemApp });

    expect(result).toEqual({
      ok: false,
      openAtLogin: false,
      error: '开机自启需要在安装后的 Portly.app 中设置'
    });
    expect(loginItemApp.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('reports when macOS does not apply the requested value', () => {
    const loginItemApp = {
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
      setLoginItemSettings: vi.fn()
    };

    const result = setLoginItemState(true, { loginItemApp });

    expect(result.ok).toBe(false);
    expect(result.openAtLogin).toBe(false);
    expect(result.error).toContain('Applications');
  });
});
