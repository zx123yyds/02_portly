import { ChevronRight, Clock, Cpu, ExternalLink, HardDrive, Power, Terminal } from 'lucide-react';
import type { PortEntry } from '../types';

export function PortRow({
  port,
  index,
  expanded,
  confirmingKill = false,
  onToggle,
  onOpen,
  onOpenTerminal,
  onKill,
  onCancelKill,
  onConfirmKill
}: {
  port: PortEntry;
  index?: number;
  expanded: boolean;
  confirmingKill?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onOpenTerminal: () => void;
  onKill: () => void;
  onCancelKill?: () => void;
  onConfirmKill?: () => void;
}) {
  return (
    <article
      className={`row ${expanded ? 'expanded' : ''} ${confirmingKill ? 'confirming-kill' : ''}`}
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
        <span className="port" aria-label={`端口 ${port.port}`}>:{port.port}</span>
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
              <button className="action-tip" aria-label={`在浏览器打开 localhost:${port.port}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}>
                <ExternalLink size={13} />
                <span className="action-tip-label" role="tooltip">浏览器</span>
              </button>
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
      {expanded ? (
        <div className="row-detail">
          <DetailRow label="PID" value={String(port.pid)} />
          <DetailRow label="命令" value={port.command} />
          <DetailRow label="目录" value={port.cwd} />
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
