export type PortKind = 'dev' | 'other';

export interface PortEntry {
  id: string;
  port: number;
  name: string;
  project: string;
  pid: number;
  protocol: string;
  address: string;
  command: string;
  cwd: string;
  uptime: string;
  mem: string;
  cpu: string;
  kind: PortKind;
}

export interface PortScanResult {
  ok: boolean;
  ports: PortEntry[];
  scannedAt: string;
  source: 'lsof' | 'browser-fallback' | 'mock';
  error?: string;
}
