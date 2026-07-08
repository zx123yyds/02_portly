import path from 'node:path';

export function resolveTerminalDirectory(value: string): string {
  const normalized = path.resolve(value);
  if (normalized.endsWith('.app')) return path.dirname(normalized);
  return normalized;
}
