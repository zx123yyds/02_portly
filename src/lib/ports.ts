import type { PortEntry } from '../types';

const DEV_COMMAND_PATTERNS = [
  /node/i,
  /vite/i,
  /next/i,
  /webpack/i,
  /bun/i,
  /deno/i,
  /python/i,
  /ruby/i,
  /rails/i,
  /go/i,
  /air/i,
  /cargo/i,
  /php/i
];

const DEV_PORTS = new Set([3000, 3001, 4200, 4321, 5000, 5173, 5174, 8000, 8080, 8787, 9000]);
const SYSTEM_COMMAND_PATTERNS = [/mdns/i, /cups/i, /rapportd/i, /controlcenter/i, /airplay/i, /nfsd/i];

export function parseLsofOutput(output: string, now = new Date()): PortEntry[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries = new Map<string, PortEntry>();

  for (const line of lines) {
    if (/^COMMAND\s+PID\s+/i.test(line)) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 10 || parts.at(-1) !== '(LISTEN)') continue;

    const command = decodeLsofEscapes(parts[0]);
    const pidText = parts[1];
    const protocol = parts[7];
    const nameField = parts.slice(8, -1).join(' ');
    const endpoint = nameField.replace(/^\[?::1\]?:/, 'localhost:');
    const portMatch = endpoint.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = Number(portMatch[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue;

    const pid = Number(pidText);
    const id = `${pid}:${port}:${protocol}`;
    if (entries.has(id)) continue;

    const displayName = inferDisplayName(command, port);
    entries.set(id, {
      id,
      port,
      name: displayName,
      project: inferProject(command, port),
      pid,
      protocol,
      address: endpoint,
      command,
      cwd: '未知',
      uptime: '刚刚',
      mem: '未知',
      cpu: '未知',
      kind: classifyPort(command, port, now)
    });
  }

  return [...entries.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dev' ? -1 : 1;
    return a.port - b.port;
  });
}

export function classifyPort(command: string, port: number, _now = new Date()): 'dev' | 'other' {
  if (SYSTEM_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) return 'other';
  if (DEV_PORTS.has(port)) return 'dev';
  if (DEV_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) return 'dev';
  return 'other';
}

function inferDisplayName(command: string, port: number): string {
  const lower = command.toLowerCase();
  if (lower.includes('node') && port === 5173) return 'Vite';
  if (lower.includes('node') && port === 3000) return 'Next.js';
  if (lower.includes('python')) return 'Python';
  if (lower.includes('ruby')) return 'Ruby';
  if (lower.includes('postgres')) return 'postgres';
  if (lower.includes('redis')) return 'redis-server';
  return command;
}

function inferProject(command: string, port: number): string {
  if (port === 5173) return 'local app';
  if (port === 3000) return 'web app';
  return command;
}

function decodeLsofEscapes(value: string): string {
  return value.replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}
