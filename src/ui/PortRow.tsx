import { ChevronRight, Clock, Cpu, Globe, HardDrive, Power, Terminal } from 'lucide-react';
import type { PortEntry } from '../types';

export function PortRow({
  port,
  ports,
  variant = 'default',
  index,
  expanded,
  confirmingKill = false,
  onToggle,
  onOpen,
  showOpenAction = true,
  onOpenTerminal,
  onKill,
  onCancelKill,
  onConfirmKill
}: {
  port: PortEntry;
  ports?: PortEntry[];
  variant?: 'default' | 'chips';
  index?: number;
  expanded: boolean;
  confirmingKill?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  showOpenAction?: boolean;
  onOpenTerminal: () => void;
  onKill: () => void;
  onCancelKill?: () => void;
  onConfirmKill?: () => void;
}) {
  const groupedPorts = ports?.length ? ports : [port];
  const extraPortCount = groupedPorts.length - 1;
  const showChipLayout = variant === 'chips' && extraPortCount > 0;

  return (
    <article
      className={`row ${showChipLayout ? 'port-chip-row' : ''} ${expanded ? 'expanded' : ''} ${confirmingKill ? 'confirming-kill' : ''}`}
      role="listitem"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={expanded}
    >
      <div className="row-main">
        <span className="port" aria-label={extraPortCount > 0 ? `端口 ${groupedPorts.map((item) => item.port).join('、')}` : `端口 ${port.port}`}>
          :{port.port}
          {extraPortCount > 0 ? <small>+{extraPortCount}</small> : null}
        </span>
        <span className="row-disclosure" aria-hidden="true">
          <ChevronRight size={13} />
        </span>
        <div className="row-info">
          <div className="row-name">
            {displayName(port)}
            {typeof index === 'number' && index < 9 ? <span className="kbd" aria-hidden="true">⌘{index + 1}</span> : null}
          </div>
          <MetaLine port={port} />
        </div>
        <div className="row-actions" aria-label="操作">
          {confirmingKill ? (
            <>
              <button className="action-btn cancel-btn" type="button" aria-label="取消" onClick={(event) => { event.stopPropagation(); onCancelKill?.(); }}>
                取消
              </button>
              <button className="action-btn kill-btn" type="button" aria-label={`确认结束进程 ${port.pid}`} onClick={(event) => { event.stopPropagation(); onConfirmKill?.(); }}>
                结束
              </button>
            </>
          ) : (
            <>
              {showOpenAction ? (
                <button className="action-tip" aria-label={`在浏览器打开 localhost:${port.port}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}>
                  <Globe size={13} />
                  <span className="action-tip-label" role="tooltip">浏览器</span>
                </button>
              ) : <span className="action-spacer" aria-hidden="true" />}
              <button className="action-tip" aria-label={`在终端打开 ${port.cwd}`} onClick={(event) => { event.stopPropagation(); onOpenTerminal(); }}>
                <Terminal size={13} />
                <span className="action-tip-label" role="tooltip">终端</span>
              </button>
              <button className="action-tip danger-action" aria-label={`结束进程 ${port.pid}`} onClick={(event) => { event.stopPropagation(); onKill(); }}>
                <Power size={13} />
                <span className="action-tip-label" role="tooltip">结束</span>
              </button>
            </>
          )}
        </div>
      </div>
      {showChipLayout ? (
        <div className="port-chips" aria-label={`${displayName(port)} 监听端口`}>
          {groupedPorts.slice(1).map((item) => (
            <span
              key={item.id}
              className="port-chip"
              aria-label={`端口 ${item.port}`}
            >
              {item.port}
            </span>
          ))}
        </div>
      ) : null}
      {expanded ? (
        <div className="row-detail">
          <DetailRow label="PID" value={String(port.pid)} />
          <DetailRow label="命令" value={port.command} />
          {extraPortCount > 0 && !showChipLayout ? <DetailRow label="端口" value={groupedPorts.map((item) => item.port).join('、')} /> : null}
          <DetailRow label="路径" value={port.cwd} />
        </div>
      ) : null}
    </article>
  );
}

export function displayName(port: PortEntry) {
  return port.name === port.project ? port.name : `${port.name} — ${port.project}`;
}

function MetaLine({ port }: { port: PortEntry }) {
  return (
    <div className="row-meta">
      <MetricItem label="Uptime" value={port.uptime}><Clock className="meta-icon" size={12} /></MetricItem>
      <MetricItem label="Memory" value={port.mem}><HardDrive className="meta-icon" size={12} /></MetricItem>
      <MetricItem label="CPU" value={port.cpu}><Cpu className="meta-icon" size={12} /></MetricItem>
    </div>
  );
}

function MetricItem({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <span className="metric-tip" tabIndex={0} aria-label={label}>
      {children}
      <span>{value}</span>
      <span className="metric-tip-label" role="tooltip">{label}</span>
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
