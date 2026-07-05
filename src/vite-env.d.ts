/// <reference types="vite/client" />

import type { PortScanResult } from './types';

declare global {
  interface Window {
    portly?: {
      scanPorts: () => Promise<PortScanResult>;
      diagnostics: () => Promise<{
        cwd: string;
        testScanMode: string | null;
        nodeEnv: string | null;
        keepVisibleForTests: boolean;
        showOnReadyForTests: boolean;
        devToolsOpened: boolean;
        trayIconPath: string | null;
        trayIconEmpty: boolean;
      }>;
      windowState: () => Promise<{ visible: boolean; focused: boolean; devToolsOpened: boolean }>;
      testBlur: () => Promise<{ visible: boolean; focused: boolean; devToolsOpened: boolean }>;
      getLoginItemSettings: () => Promise<{ ok: boolean; openAtLogin: boolean; error?: string }>;
      setLoginItemSettings: (openAtLogin: boolean) => Promise<{ ok: boolean; openAtLogin: boolean; error?: string }>;
      openPort: (port: number) => Promise<{ ok: boolean; error?: string }>;
      openTerminal: (cwd: string) => Promise<{ ok: boolean; error?: string }>;
      killProcess: (payload: { pid: number; port: number }) => Promise<{ ok: boolean; error?: string; signal?: string }>;
      quit: () => void;
    };
  }
}
