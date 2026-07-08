import { AlertCircle, LoaderCircle, RefreshCw, Search, Settings, X } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { filterPorts } from '../lib/filterPorts';
import { groupPortsByProcess } from '../lib/groupPorts';
import type { PortEntry } from '../types';
import { PortRow, displayName } from './PortRow';
import { StatePanel } from './StatePanel';
import { DEFAULT_SETTINGS, loadSettings, normalizeRefreshInterval, refreshIntervalFillPercent, type PortlySettings, type PortlyTheme, saveSettings } from './settings';
import { formatScanTime } from './timeFormat';
import { usePortScan } from './usePortScan';
import { useToast } from './useToast';

export function App() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [showOthers, setShowOthers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pendingKill, setPendingKill] = useState<PortEntry | null>(null);
  const [closingPortIds, setClosingPortIds] = useState<Set<string>>(() => new Set());
  const [settings, setSettings] = useState<PortlySettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    return loadSettings();
  });
  const { toast, setToast } = useToast();
  const handleScanError = useCallback(() => setToast('端口读取失败'), [setToast]);
  const { scan, loading, devPorts, otherPorts, refreshPorts } = usePortScan(handleScanError);
  const visibleDevPorts = devPorts.filter((port) => !closingPortIds.has(port.id) && !closingPortIds.has(processClosingId(port.pid)));
  const visibleOtherPorts = otherPorts.filter((port) => !closingPortIds.has(port.id) && !closingPortIds.has(processClosingId(port.pid)));
  const filteredDevPorts = filterPorts(visibleDevPorts, query);
  const filteredOtherPorts = filterPorts(visibleOtherPorts, query);
  const groupedDevPorts = groupPortsByProcess(filteredDevPorts);
  const groupedOtherPorts = groupPortsByProcess(filteredOtherPorts);
  const hasQuery = query.trim().length > 0;

  async function refreshPortList({ clearToast = true, showLoading = true } = {}) {
    if (clearToast) setToast('');
    await refreshPorts({ showLoading });
    setExpandedIds(new Set());
  }

  async function refreshPortListQuietly() {
    await refreshPorts({ notifyError: false, preserveOnError: true, showLoading: false });
  }

  function updateSettings(patch: Partial<PortlySettings>) {
    setSettings((current) => {
      const next = {
        ...current,
        ...patch,
        refreshIntervalSeconds: normalizeRefreshInterval(patch.refreshIntervalSeconds ?? current.refreshIntervalSeconds)
      };
      saveSettings(next);
      return next;
    });
  }

  async function updateLaunchAtLogin(launchAtLogin: boolean) {
    updateSettings({ launchAtLogin });
    if (!window.portly) {
      updateSettings({ launchAtLogin: !launchAtLogin });
      setToast('开机自启需要在安装后的 Portly.app 中设置');
      return;
    }

    try {
      const result = await window.portly.setLoginItemSettings(launchAtLogin);
      if (!result.ok) {
        updateSettings({ launchAtLogin: result.openAtLogin });
        setToast(result.error || '开机自启设置失败');
        return;
      }
      updateSettings({ launchAtLogin: result.openAtLogin });
    } catch {
      updateSettings({ launchAtLogin: !launchAtLogin });
      setToast('开机自启设置失败');
    }
  }

  useEffect(() => {
    void refreshPortList();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function syncLaunchAtLogin() {
      if (!window.portly) return;
      try {
        const result = await window.portly.getLoginItemSettings();
        if (!cancelled && result.ok) updateSettings({ launchAtLogin: result.openAtLogin });
      } catch {
        // Keep the locally stored setting when the system value is unavailable.
      }
    }

    void syncLaunchAtLogin();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshPortListQuietly();
    }, settings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [refreshPorts, settings.refreshIntervalSeconds]);

  useEffect(() => {
    function returnToPortList() {
      setShowSettings(false);
    }

    function onVisibilityChange() {
      if (document.hidden) returnToPortList();
    }

    window.addEventListener('blur', returnToPortList);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', returnToPortList);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      const index = Number.parseInt(event.key, 10);
      if (event.metaKey && index >= 1 && index <= devPorts.length) {
        event.preventDefault();
        void openPort(devPorts[index - 1].port);
      }
    }
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [devPorts]);

  async function openPort(port: number) {
    if (window.portly) {
      const result = await window.portly.openPort(port);
      setToast(result.ok ? `正在打开 :${port}` : result.error || '打开失败');
      return;
    }
    window.open(`http://localhost:${port}`, '_blank', 'noopener,noreferrer');
    setToast(`正在打开 :${port}`);
  }

  async function openTerminal(port: PortEntry) {
    if (!window.portly) {
      setToast('预览模式不能打开终端');
      return;
    }

    const result = await window.portly.openTerminal(port.cwd);
    setToast(result.ok ? `正在打开终端：${displayName(port)}` : result.error || '打开终端失败');
  }

  async function killPortProcess(port: PortEntry) {
    setPendingKill(port);
  }

  async function confirmKillProcess() {
    const port = pendingKill;
    if (!port) return;
    setPendingKill(null);
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(port.id);
      return next;
    });
    setClosingPortIds((current) => {
      const next = new Set(current);
      next.add(port.id);
      next.add(processClosingId(port.pid));
      return next;
    });

    if (!window.portly) {
      setClosingPortIds((current) => {
        const next = new Set(current);
        next.delete(port.id);
        next.delete(processClosingId(port.pid));
        return next;
      });
      setToast('预览模式不能结束进程');
      return;
    }

    const result = await window.portly.killProcess({ pid: port.pid, port: port.port });
    if (!result.ok) {
      setClosingPortIds((current) => {
        const next = new Set(current);
        next.delete(port.id);
        return next;
      });
      setToast(result.error || '结束进程失败');
      return;
    }

    await refreshPortList({ clearToast: false, showLoading: false });
    setClosingPortIds((current) => {
      const next = new Set(current);
      next.delete(port.id);
      next.delete(processClosingId(port.pid));
      return next;
    });
  }

  function cancelKillProcess() {
    setPendingKill(null);
  }

  function clearSearch() {
    setQuery('');
    searchInputRef.current?.focus();
  }

  function quit() {
    if (window.portly) {
      window.portly.quit();
      return;
    }
    setToast('预览模式不会退出应用');
  }

  const footerLabel = loading ? '正在更新' : scan.ok ? '更新于' : '读取失败';

  return (
    <div className="popover-shell">
      <main className={`popover theme-${settings.theme}`} role="application" aria-label="Portly 端口监控">
        {showSettings ? (
          <>
            <header className="header settings-view-header">
              <h1>设置</h1>
              <button type="button" className="settings-done-btn" onClick={() => setShowSettings(false)}>完成</button>
            </header>
            <SettingsPanel
              settings={settings}
              onThemeChange={(theme) => updateSettings({ theme })}
              onRefreshIntervalChange={(refreshIntervalSeconds) => updateSettings({ refreshIntervalSeconds })}
              onLaunchAtLoginChange={(launchAtLogin) => void updateLaunchAtLogin(launchAtLogin)}
            />
          </>
        ) : (
          <>
            <div className="popover-top">
              <header className="header">
                <div>
                  <h1>Portly</h1>
                  <span className={`dev-badge ${scan.ok ? '' : 'is-error'}`} aria-live="polite">
                    {loading ? '正在扫描' : `${devPorts.length} 个开发服务`}
                  </span>
                </div>
                <div className="header-actions">
                  <button title="刷新" aria-label="刷新端口列表" onMouseDown={(event) => event.preventDefault()} onClick={() => void refreshPortList()} disabled={loading}>
                    {loading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                  </button>
                  <button title="设置" aria-label="打开设置" onMouseDown={(event) => event.preventDefault()} onClick={() => setShowSettings(true)}>
                    <Settings size={14} />
                  </button>
                </div>
              </header>

              <div className={`search-wrap ${hasQuery ? 'has-query' : ''}`}>
                <Search className="search-icon" size={16} aria-hidden="true" />
                <input
                  aria-label="搜索端口或服务名"
                  className="search-input"
                  placeholder="搜索端口或服务名..."
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && query) {
                      event.preventDefault();
                      setQuery('');
                    }
                  }}
                />
                {hasQuery ? (
                  <button
                    aria-label="清空搜索"
                    className="search-clear"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearSearch}
                    title="清空搜索"
                    type="button"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="port-scroll">
              <section className="list" role="list" aria-label="开发服务端口列表">
                {loading ? (
                  <StatePanel icon={<LoaderCircle className="spin" size={32} />} title="正在读取监听端口" />
                ) : !scan.ok ? (
                  <StatePanel icon={<AlertCircle size={32} />} title="无法读取端口" detail={scan.error || '系统命令返回失败，未使用 mock 数据。'} tone="error" />
                ) : devPorts.length === 0 && !hasQuery ? (
                  <StatePanel icon={<AlertCircle size={32} />} title="暂无开发服务运行" detail="当前没有识别到常见开发端口或开发进程。" />
                ) : filteredDevPorts.length === 0 && filteredOtherPorts.length === 0 ? (
                  <StatePanel icon={<Search size={32} />} title="没有匹配的端口" detail="换个端口号、服务名或命令试试。" />
                ) : (
                  groupedDevPorts.map(({ primary, ports }, index) => (
                    <PortRow
                      key={primary.id}
                      port={primary}
                      ports={ports}
                      variant="chips"
                      index={index}
                      expanded={expandedIds.has(primary.id)}
                      onToggle={() => toggleExpanded(primary.id)}
                      onOpen={() => void openPort(primary.port)}
                      onOpenTerminal={() => void openTerminal(primary)}
                      onKill={() => void killPortProcess(primary)}
                      confirmingKill={pendingKill?.id === primary.id}
                      onCancelKill={cancelKillProcess}
                      onConfirmKill={() => void confirmKillProcess()}
                    />
                  ))
                )}
              </section>

              <div className="separator" role="separator" />

              <button
                className={`toggle-btn ${showOthers ? 'open' : ''}`}
                onClick={() => setShowOthers(!showOthers)}
                aria-expanded={showOthers}
              >
                另有 <span>{filteredOtherPorts.length}</span> 个端口监听中
              </button>

              <section className={`other-list ${showOthers ? 'show' : ''}`} role="list" aria-label="其他端口列表">
                {filteredOtherPorts.length === 0 ? (
                  <div className="other-empty">没有其他监听端口</div>
                ) : (
                  groupedOtherPorts.map(({ primary, ports }) => (
                    <PortRow
                      key={primary.id}
                      port={primary}
                      ports={ports}
                      variant="chips"
                      expanded={expandedIds.has(primary.id)}
                      onToggle={() => toggleExpanded(primary.id)}
                      onOpen={() => {}}
                      showOpenAction={false}
                      onOpenTerminal={() => void openTerminal(primary)}
                      onKill={() => void killPortProcess(primary)}
                      confirmingKill={pendingKill?.id === primary.id}
                      onCancelKill={cancelKillProcess}
                      onConfirmKill={() => void confirmKillProcess()}
                    />
                  ))
                )}
              </section>
            </div>

            <div className="popover-bottom">
              <div className="separator" role="separator" />
              <footer className="footer">
                <span className="footer-left" title={`最近刷新：${formatScanTime(scan.scannedAt)}`}>
                  {footerLabel} {formatScanTime(scan.scannedAt)}
                </span>
                <div className="footer-right">
                  <button onClick={quit} aria-label="退出 Portly">退出</button>
                </div>
              </footer>
            </div>
          </>
        )}
      </main>
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast || ' '}</div>
    </div>
  );

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}

function processClosingId(pid: number) {
  return `pid:${pid}`;
}

function SettingsPanel({
  settings,
  onThemeChange,
  onRefreshIntervalChange,
  onLaunchAtLoginChange
}: {
  settings: PortlySettings;
  onThemeChange: (theme: PortlyTheme) => void;
  onRefreshIntervalChange: (seconds: number) => void;
  onLaunchAtLoginChange: (launchAtLogin: boolean) => void;
}) {
  const [draftSeconds, setDraftSeconds] = useState(String(settings.refreshIntervalSeconds));

  useEffect(() => {
    setDraftSeconds(String(settings.refreshIntervalSeconds));
  }, [settings.refreshIntervalSeconds]);

  function commitSeconds(value: string) {
    const seconds = normalizeRefreshInterval(value);
    setDraftSeconds(String(seconds));
    onRefreshIntervalChange(seconds);
  }

  function updateSeconds(value: string) {
    setDraftSeconds(value);
    if (value === '') return;
    onRefreshIntervalChange(normalizeRefreshInterval(value));
  }

  return (
    <section className="settings-panel" aria-label="Portly 设置">
      <div className="settings-field">
        <span className="settings-label">外观主题</span>
        <div className="settings-segmented" role="radiogroup" aria-label="外观主题">
          {[
            ['system', '跟随系统'],
            ['light', '亮色'],
            ['dark', '暗色']
          ].map(([theme, label]) => (
            <button
              key={theme}
              type="button"
              className={settings.theme === theme ? 'active' : ''}
              role="radio"
              aria-checked={settings.theme === theme}
              onClick={() => onThemeChange(theme as PortlyTheme)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field">
        <span className="settings-label">刷新间隔</span>
        <div className="settings-range-line">
          <input
            aria-label="刷新间隔"
            className="settings-range"
            max={60}
            min={1}
            style={{ '--settings-range-fill': refreshIntervalFillPercent(settings.refreshIntervalSeconds) } as CSSProperties}
            type="range"
            value={settings.refreshIntervalSeconds}
            onChange={(event) => onRefreshIntervalChange(normalizeRefreshInterval(event.target.value))}
          />
          <input
            aria-label="刷新秒数"
            className="settings-seconds"
            max={60}
            min={1}
            type="number"
            value={draftSeconds}
            onBlur={() => commitSeconds(draftSeconds)}
            onChange={(event) => updateSeconds(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
          />
          <span className="settings-unit">秒</span>
        </div>
      </div>

      <label className="settings-login-row">
        <span className="settings-label">开机自启动</span>
        <span className="settings-switch">
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(event) => onLaunchAtLoginChange(event.target.checked)}
          />
          <span />
        </span>
      </label>
    </section>
  );
}
