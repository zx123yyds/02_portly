import { describe, expect, it } from 'vitest';
import { classifyPort, parseLsofOutput } from './ports';

describe('parseLsofOutput', () => {
  it('extracts listening TCP ports from lsof output', () => {
    const output = [
      'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      'node    12847  zx   21u  IPv4 0x1234567890abcdef      0t0  TCP 127.0.0.1:5173 (LISTEN)',
      'rapportd   493 zx   10u  IPv6 0x1234567890abcdef      0t0  TCP *:8770 (LISTEN)',
      'node    12847  zx   22u  IPv4 0x1234567890abcdef      0t0  TCP 127.0.0.1:5173 (LISTEN)'
    ].join('\n');

    const ports = parseLsofOutput(output);

    expect(ports).toHaveLength(2);
    expect(ports[0]).toMatchObject({
      port: 5173,
      name: 'Vite',
      pid: 12847,
      protocol: 'TCP',
      kind: 'dev'
    });
    expect(ports[1]).toMatchObject({
      port: 8770,
      name: 'rapportd',
      pid: 493,
      kind: 'other'
    });
  });

  it('ignores malformed rows instead of inventing ports', () => {
    const ports = parseLsofOutput('not lsof\nnode abc TCP no-port (LISTEN)');

    expect(ports).toEqual([]);
  });

  it('decodes lsof escaped process names before display', () => {
    const output = [
      'COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME',
      'Code\\x20H 94939 zx  21u  IPv4 0x1234567890abcdef      0t0  TCP 127.0.0.1:8830 (LISTEN)'
    ].join('\n');

    const ports = parseLsofOutput(output);

    expect(ports[0]).toMatchObject({
      command: 'Code H',
      name: 'Code H',
      project: 'Code H'
    });
  });
});

describe('classifyPort', () => {
  it('treats common app ports and dev commands as development services', () => {
    expect(classifyPort('node', 5173)).toBe('dev');
    expect(classifyPort('python3', 8000)).toBe('dev');
    expect(classifyPort('com.docker.backend', 8080)).toBe('dev');
  });

  it('keeps low system ports outside the development group', () => {
    expect(classifyPort('mDNSResponder', 53)).toBe('other');
    expect(classifyPort('mDNSResponder', 5353)).toBe('other');
    expect(classifyPort('cupsd', 631)).toBe('other');
  });
});
