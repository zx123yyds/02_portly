import type { PortEntry } from '../types';

export function filterPorts(ports: PortEntry[], query: string): PortEntry[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return ports;

  return ports.filter((port) => searchableText(port).includes(normalizedQuery));
}

function searchableText(port: PortEntry): string {
  return normalize([
    port.port,
    port.name,
    port.project,
    port.command,
    port.cwd,
    port.pid,
    port.address
  ].join(' '));
}

function normalize(value: unknown): string {
  return String(value).trim().toLowerCase();
}
