import { describe, expect, it } from 'vitest';
import type { PortEntry } from '../types';
import { filterPorts } from './filterPorts';

const ports: PortEntry[] = [
  makePort({ port: 5173, name: 'portly', command: 'node', cwd: '/Users/me/portly' }),
  makePort({ port: 8193, name: 'baidu.comate', command: 'comate', cwd: '/Users/me/.vscode/extensions/baidu.comate' }),
  makePort({ port: 5432, name: 'postgres', command: 'postgres', cwd: '/opt/homebrew/var/postgres' })
];

describe('filterPorts', () => {
  it('returns all ports when the query is empty', () => {
    expect(filterPorts(ports, '')).toEqual(ports);
    expect(filterPorts(ports, '   ')).toEqual(ports);
  });

  it('matches by port number, visible service name, command, and directory', () => {
    expect(filterPorts(ports, '5173')).toEqual([ports[0]]);
    expect(filterPorts(ports, 'comate')).toEqual([ports[1]]);
    expect(filterPorts(ports, 'postgres')).toEqual([ports[2]]);
    expect(filterPorts(ports, 'extensions')).toEqual([ports[1]]);
  });

  it('matches case-insensitively', () => {
    expect(filterPorts(ports, 'PORTLY')).toEqual([ports[0]]);
    expect(filterPorts(ports, 'BAIDU')).toEqual([ports[1]]);
  });
});

function makePort(overrides: Partial<PortEntry>): PortEntry {
  return {
    id: `${overrides.port}:test`,
    port: overrides.port ?? 0,
    name: overrides.name ?? 'test',
    project: overrides.project ?? overrides.name ?? 'test',
    pid: 1234,
    protocol: 'TCP',
    address: `localhost:${overrides.port ?? 0}`,
    command: overrides.command ?? 'node',
    cwd: overrides.cwd ?? '/tmp',
    uptime: '1min',
    mem: '0.1%',
    cpu: '0.0%',
    kind: 'dev',
    ...overrides
  };
}
