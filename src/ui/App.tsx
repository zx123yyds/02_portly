import { AlertCircle, LoaderCircle, RefreshCw, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { filterPorts } from '../lib/filterPorts';
import type { PortEntry } from '../types';
import { PortRow, displayName } from './PortRow';
import { StatePanel } from './StatePanel';
import { usePortScan } from './usePortScan';
import { useToast } from './useToast';

const AUTO_REFRESH_INTERVAL_MS = 5000;

export function App() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [showOthers, setShowOthers] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingKill, setPendingKill] = useState<PortEntry | null>(null);
  const { toast, setToast } = useToast();
  const handleScanError = useCallback(() => setToast('端口读取失败'), [setToast]);
  const { scan, loading, devPorts, otherPorts, refreshPorts } = usePortScan(handleScanError);
  const filteredDevPorts = filterPorts(devPorts, query);
  const filteredOtherPorts = filterPorts(otherPorts, query);
  const hasQuery = query.trim().length > 0;

  async function refreshPortList({ clearToast = true } = {}) {
    if (clearToast) setToast('');
    await refreshPorts();
    setExpandedIds(new Set());
  }

  async function refreshPortListQuietly() {
    await refreshPorts({ notifyError: false, preserveOnError: true, showLoading: false });
  }

  useEffect(() => {
    void refreshPortList();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshPortListQuietly();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshPorts]);

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

    if (!window.portly) {
      setToast('预览模式不能结束进程');
      return;
    }

    setToast(`正在结束 ${displayName(port)}`);
    const result = await window.portly.killProcess({ pid: port.pid, port: port.port });
    if (!result.ok) {
      setToast(result.error || '结束进程失败');
      return;
    }

    setToast(result.signal === 'SIGKILL' ? `已强制结束 ${displayName(port)}` : `已结束 ${displayName(port)}`);
    await refreshPortList({ clearToast: false });
  }

  function cancelKillProcess() {
    setPendingKill(null);
  }

  function quit() {
    if (window.portly) {
      window.portly.quit();
      return;
    }
    setToast('预览模式不会退出应用');
  }

  const statusLabel = loading ? '扫描中' : scan.ok ? 'lsof 实时数据' : '读取失败';

  return (
    <div className="popover-shell">
      <main className="popover" role="application" aria-label="Portly 端口监控">
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
            <button title="设置" aria-label="打开设置" onMouseDown={(event) => event.preventDefault()} onClick={() => setToast('设置将在下一版开放')}>
              <Settings size={14} />
            </button>
          </div>
        </header>

        <div className="search-wrap">
          <Search className="search-icon" size={16} aria-hidden="true" />
          <input
            aria-label="搜索端口或服务名"
            className="search-input"
            placeholder="搜索端口或服务名..."
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

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
            filteredDevPorts.map((port, index) => (
              <PortRow
                key={port.id}
                port={port}
                index={index}
                expanded={expandedIds.has(port.id)}
                onToggle={() => toggleExpanded(port.id)}
                onOpen={() => void openPort(port.port)}
                onOpenTerminal={() => void openTerminal(port)}
                onKill={() => void killPortProcess(port)}
                confirmingKill={pendingKill?.id === port.id}
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
            filteredOtherPorts.map((port) => (
              <PortRow
                key={port.id}
                port={port}
                expanded={expandedIds.has(port.id)}
                onToggle={() => toggleExpanded(port.id)}
                onOpen={() => void openPort(port.port)}
                onOpenTerminal={() => void openTerminal(port)}
                onKill={() => void killPortProcess(port)}
                confirmingKill={pendingKill?.id === port.id}
                onCancelKill={cancelKillProcess}
                onConfirmKill={() => void confirmKillProcess()}
              />
            ))
          )}
        </section>

        <div className="separator" role="separator" />

        <footer className="footer">
          <span className="footer-left" title={`最近刷新：${formatExactTime(scan.scannedAt)}`}>
            {statusLabel} · {formatTime(scan.scannedAt)}
          </span>
          <div className="footer-right">
            <button onClick={quit} aria-label="退出 Portly">退出</button>
          </div>
        </footer>
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未扫描';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatExactTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未扫描';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
