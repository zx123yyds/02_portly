import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getLoginItemState, setLoginItemState } from './loginItem.js';
import { resolveTerminalDirectory } from './pathUtils.js';
import { killProcess } from './processControl.js';
import { scanListeningPorts } from './portScanner.js';
import type { PortScanResult } from '../src/types.js';

const execFileAsync = promisify(execFile);

let tray: Tray | null = null;
let popover: BrowserWindow | null = null;
let trayIconPath: string | null = null;
let trayIconEmpty = true;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const keepVisibleForTests = process.env.PORTLY_TEST_KEEP_VISIBLE === '1';
const showOnReadyForTests = process.env.PORTLY_TEST_SHOW_ON_READY === '1';
const mockKillForTests = process.env.PORTLY_TEST_KILL_MODE === 'mock';
const mockTerminalForTests = process.env.PORTLY_TEST_TERMINAL_MODE === 'mock';
let mockKillCount = 0;
let allowSyntheticBlurForTests = false;

app.setName('Portly');

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createTray();
  createPopover();

  app.on('activate', () => {
    showPopover();
  });
});

app.on('window-all-closed', () => {});

ipcMain.handle('ports:scan', async () => {
  const result = await scanListeningPorts();
  updateTrayStatus(result);
  return result;
});

ipcMain.handle('app:diagnostics', () => ({
  cwd: process.cwd(),
  testScanMode: process.env.PORTLY_TEST_SCAN_MODE ?? null,
  nodeEnv: process.env.NODE_ENV ?? null,
  keepVisibleForTests,
  showOnReadyForTests,
  devToolsOpened: Boolean(popover?.webContents.isDevToolsOpened()),
  trayIconPath,
  trayIconEmpty
}));

ipcMain.handle('app:window-state', () => ({
  visible: Boolean(popover?.isVisible()),
  focused: Boolean(popover?.isFocused()),
  devToolsOpened: Boolean(popover?.webContents.isDevToolsOpened())
}));

ipcMain.handle('app:test-blur', () => {
  allowSyntheticBlurForTests = true;
  handlePopoverBlur();
  allowSyntheticBlurForTests = false;
  return {
    visible: Boolean(popover?.isVisible()),
    focused: Boolean(popover?.isFocused()),
    devToolsOpened: Boolean(popover?.webContents.isDevToolsOpened())
  };
});

ipcMain.handle('app:get-login-item-settings', () => getLoginItemState());

ipcMain.handle('app:set-login-item-settings', (_event, openAtLogin: boolean) => setLoginItemState(Boolean(openAtLogin), { isDev }));

ipcMain.handle('ports:open', async (_event, port: number) => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: '端口号无效' };
  }

  await shell.openExternal(`http://localhost:${port}`);
  return { ok: true };
});

ipcMain.handle('ports:open-terminal', async (_event, cwd: string) => {
  if (typeof cwd !== 'string' || cwd.trim().length === 0) {
    return { ok: false, error: '执行路径无效' };
  }

  const normalizedCwd = resolveTerminalDirectory(cwd);
  try {
    if (!statSync(normalizedCwd).isDirectory()) {
      return { ok: false, error: '执行路径不是目录' };
    }
  } catch {
    return { ok: false, error: '执行路径不存在' };
  }

  if (mockTerminalForTests) return { ok: true };

  const script = [
    'tell application "Terminal"',
    'activate',
    `do script "cd " & quoted form of "${escapeAppleScriptString(normalizedCwd)}"`,
    'end tell'
  ].join('\n');

  await execFileAsync('/usr/bin/osascript', ['-e', script]);
  return { ok: true };
});

ipcMain.handle('ports:kill', async (_event, payload: { pid: number; port: number }) => {
  if (mockKillForTests) {
    mockKillCount += 1;
    return { ok: true, signal: mockKillCount % 2 === 0 ? 'SIGKILL' : 'SIGTERM' };
  }
  return killProcess(payload);
});

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

ipcMain.on('app:quit', () => {
  app.quit();
});

function createTray(): void {
  const icon = loadTrayIcon();
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Portly');
  tray.on('click', () => togglePopover());
  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      { label: '显示 Portly', click: () => showPopover() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray?.popUpContextMenu(menu);
  });
}

function loadTrayIcon(): Electron.NativeImage {
  const candidatePaths = [
    path.join(process.cwd(), 'assets', 'tray-iconTemplate.png'),
    path.join(app.getAppPath(), 'assets', 'tray-iconTemplate.png')
  ];

  for (const iconPath of candidatePaths) {
    trayIconPath = iconPath;
    const icon = nativeImage.createFromPath(iconPath);
    trayIconEmpty = icon.isEmpty();
    if (!trayIconEmpty) return icon;
  }

  const fallback = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAq0lEQVR4nL2UQQ6AIAwE7///dDGxkCBIybtpcB+hFNJLoIboKWI7kG9hAtMnoPHxoKnMF4mAHwNZyu0pBgTGdUnTXE7vFx3dlGtLOsrNg1awSUnGw9MDSBgMgJsfPq90h2Q56DQE7CBm5agojtMLdCbqhu8t+wnWKCqQPQzdcK7Dv2tMcx0DSRqaBOMQUJUZfAjh5/KE1g/YxW7SCOdlIaybTRp1rHJc8xobx07al51G4gAAAABJRU5ErkJggg=='
  );
  trayIconEmpty = fallback.isEmpty();
  return fallback;
}

function updateTrayStatus(result: PortScanResult): void {
  if (!tray) return;

  const devCount = result.ok ? result.ports.filter((port) => port.kind === 'dev').length : 0;
  tray.setTitle(devCount > 0 ? String(devCount) : '');
  tray.setToolTip(devCount > 0 ? `Portly · ${devCount} 个开发服务` : 'Portly');
}

function createPopover(): void {
  popover = new BrowserWindow({
    width: 448,
    height: 620,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  popover.setBackgroundColor('#00000000');

  popover.on('blur', () => handlePopoverBlur());

  if (keepVisibleForTests || showOnReadyForTests) {
    popover.once('ready-to-show', () => {
      popover?.show();
    });
  }

  if (isDev) {
    void popover.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void popover.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function handlePopoverBlur(): void {
  if (showOnReadyForTests && !allowSyntheticBlurForTests) return;
  if (!keepVisibleForTests) popover?.hide();
}

function togglePopover(): void {
  if (!popover) return;
  if (popover.isVisible()) {
    popover.hide();
  } else {
    showPopover();
  }
}

function showPopover(): void {
  if (!popover || !tray) return;

  const trayBounds = tray.getBounds();
  const windowBounds = popover.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 2);

  popover.setPosition(x, y, false);
  popover.show();
  popover.focus();
}
