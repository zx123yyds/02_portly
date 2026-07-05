import { app } from 'electron';

export interface LoginItemResult {
  ok: boolean;
  openAtLogin: boolean;
  error?: string;
}

interface LoginItemApp {
  getLoginItemSettings: () => { openAtLogin: boolean };
  setLoginItemSettings: (settings: { openAtLogin: boolean }) => void;
}

export function getLoginItemState(loginItemApp: LoginItemApp = app): LoginItemResult {
  return {
    ok: true,
    openAtLogin: loginItemApp.getLoginItemSettings().openAtLogin
  };
}

export function setLoginItemState(openAtLogin: boolean, {
  isDev = false,
  loginItemApp = app
}: {
  isDev?: boolean;
  loginItemApp?: LoginItemApp;
} = {}): LoginItemResult {
  if (isDev) {
    return {
      ok: false,
      openAtLogin: false,
      error: '开机自启需要在安装后的 Portly.app 中设置'
    };
  }

  loginItemApp.setLoginItemSettings({ openAtLogin });
  const current = loginItemApp.getLoginItemSettings().openAtLogin;
  if (current !== openAtLogin) {
    return {
      ok: false,
      openAtLogin: current,
      error: '系统未接受开机自启设置，请确认 Portly 已安装到 Applications'
    };
  }

  return {
    ok: true,
    openAtLogin: current
  };
}
