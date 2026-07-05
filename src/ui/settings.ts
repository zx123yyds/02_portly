export type PortlyTheme = 'system' | 'light' | 'dark';

export interface PortlySettings {
  theme: PortlyTheme;
  refreshIntervalSeconds: number;
  launchAtLogin: boolean;
}

export const DEFAULT_SETTINGS: PortlySettings = {
  theme: 'system',
  refreshIntervalSeconds: 5,
  launchAtLogin: false
};

const STORAGE_KEY = 'portly.settings.v1';

export function normalizeTheme(value: unknown): PortlyTheme {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_SETTINGS.theme;
}

export function normalizeRefreshInterval(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.refreshIntervalSeconds;
  return Math.min(60, Math.max(1, Math.round(parsed)));
}

export function refreshIntervalFillPercent(value: unknown): string {
  const seconds = normalizeRefreshInterval(value);
  const percent = ((seconds - 1) / 59) * 100;
  return `${Number(percent.toFixed(1))}%`;
}

export function normalizeSettings(value: Partial<PortlySettings> = {}): PortlySettings {
  return {
    theme: normalizeTheme(value.theme),
    refreshIntervalSeconds: normalizeRefreshInterval(value.refreshIntervalSeconds),
    launchAtLogin: Boolean(value.launchAtLogin)
  };
}

export function loadSettings(storage: Pick<Storage, 'getItem'> = window.localStorage): PortlySettings {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PortlySettings, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}
