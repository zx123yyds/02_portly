import { describe, expect, it } from 'vitest';
import type { PortEntry } from '../types';
import { groupPortsByProcess } from './groupPorts';

describe('groupPortsByProcess', () => {
  it('groups multiple listening ports from the same process', () => {
    const groups = groupPortsByProcess([
      makePort({ port: 14013, pid: 4535, name: 'WeChat', command: 'WeChat', cwd: '/Applications/WeChat.app' }),
      makePort({ port: 14016, pid: 4535, name: 'WeChat', command: 'WeChat', cwd: '/Applications/WeChat.app' }),
      makePort({ port: 8443, pid: 5638, name: 'Comate', command: 'Comate', cwd: '/Applications/Comate.app' })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].primary.port).toBe(14013);
    expect(groups[0].ports.map((port) => port.port)).toEqual([14013, 14016]);
    expect(groups[1].ports.map((port) => port.port)).toEqual([8443]);
  });

  it('groups concrete app helper ports across pids when they share the same app identity', () => {
    const groups = groupPortsByProcess([
      makePort({ port: 8151, pid: 1201, name: 'Comate', project: 'Comate', command: 'Comate', cwd: '/Applications/Comate.app' }),
      makePort({ port: 8443, pid: 1202, name: 'Comate', project: 'Comate', command: 'Comate', cwd: '/Applications/Comate.app' }),
      makePort({ port: 8828, pid: 1203, name: 'Comate', project: 'Comate', command: 'Comate', cwd: '/Applications/Comate.app' }),
      makePort({ port: 8829, pid: 1204, name: 'Comate', project: 'Comate', command: 'Comate', cwd: '/Applications/Comate.app' })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].primary.port).toBe(8151);
    expect(groups[0].ports.map((port) => port.port)).toEqual([8151, 8443, 8828, 8829]);
  });

  it('keeps generic development commands split by process', () => {
    const groups = groupPortsByProcess([
      makePort({ port: 5173, pid: 2001, name: 'portly', project: 'portly', command: 'node', cwd: '/Users/me/portly' }),
      makePort({ port: 3000, pid: 2002, name: 'portly', project: 'portly', command: 'node', cwd: '/Users/me/portly' })
    ]);

    expect(groups).toHaveLength(2);
  });
});

function makePort(overrides: Partial<PortEntry>): PortEntry {
  return {
    id: `${overrides.pid}:${overrides.port}:TCP`,
    port: overrides.port ?? 0,
    name: overrides.name ?? 'test',
    project: overrides.project ?? overrides.name ?? 'test',
    pid: overrides.pid ?? 1,
    protocol: 'TCP',
    address: `127.0.0.1:${overrides.port ?? 0}`,
    command: overrides.command ?? 'test',
    cwd: overrides.cwd ?? '/tmp',
    uptime: '1min',
    mem: '0.1%',
    cpu: '0.0%',
    kind: 'other',
    ...overrides
  };
}
