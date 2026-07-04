import { contextBridge, ipcRenderer } from 'electron';
import type { PortScanResult } from '../src/types.js';

contextBridge.exposeInMainWorld('portly', {
  scanPorts: (): Promise<PortScanResult> => ipcRenderer.invoke('ports:scan'),
  diagnostics: (): Promise<{
    cwd: string;
    testScanMode: string | null;
    nodeEnv: string | null;
    keepVisibleForTests: boolean;
    showOnReadyForTests: boolean;
    devToolsOpened: boolean;
    trayIconPath: string | null;
    trayIconEmpty: boolean;
  }> => ipcRenderer.invoke('app:diagnostics'),
  windowState: (): Promise<{ visible: boolean; focused: boolean; devToolsOpened: boolean }> => ipcRenderer.invoke('app:window-state'),
  testBlur: (): Promise<{ visible: boolean; focused: boolean; devToolsOpened: boolean }> => ipcRenderer.invoke('app:test-blur'),
  openPort: (port: number): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ports:open', port),
  openTerminal: (cwd: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('ports:open-terminal', cwd),
  killProcess: (payload: { pid: number; port: number }): Promise<{ ok: boolean; error?: string; signal?: string }> => ipcRenderer.invoke('ports:kill', payload),
  quit: (): void => ipcRenderer.send('app:quit')
});
