import { describe, expect, it } from 'vitest';
import { displayPathFromContext, formatElapsedTime, inferProjectNameFromContext, parsePsOutput, preferReliableCommand } from './portScanner';

describe('formatElapsedTime', () => {
  it('drops seconds and formats elapsed time as hours and minutes', () => {
    expect(formatElapsedTime('31:03')).toBe('31min');
    expect(formatElapsedTime('02:48:03')).toBe('2h 48min');
    expect(formatElapsedTime('1-02:03:04')).toBe('26h 3min');
  });
});

describe('inferProjectNameFromContext', () => {
  it('uses package names before generic process names', () => {
    expect(inferProjectNameFromContext({
      command: 'node',
      cwd: '/Users/me/work/portly',
      packageName: 'portly',
      args: ''
    })).toBe('portly');
  });

  it('uses the cwd folder when package name is unavailable', () => {
    expect(inferProjectNameFromContext({
      command: 'node',
      cwd: '/Users/me/work/dashboard',
      packageName: null,
      args: ''
    })).toBe('dashboard');
  });

  it('keeps non-generic commands when cwd is not useful', () => {
    expect(inferProjectNameFromContext({
      command: 'WeChat',
      cwd: '/',
      packageName: null,
      args: ''
    })).toBe('WeChat');
  });

  it('does not replace concrete app names with generic cwd folders', () => {
    expect(inferProjectNameFromContext({
      command: 'WeChat',
      cwd: '/Applications/WeChat.app/Contents/Data',
      packageName: null,
      args: ''
    })).toBe('WeChat');
  });

  it('uses process args when command is generic and cwd is not useful', () => {
    expect(inferProjectNameFromContext({
      command: 'node',
      cwd: '/',
      packageName: null,
      args: '/usr/local/bin/node /Users/me/.vscode/extensions/baidu.comate-4.8.0/dist/zulu-cli/bin/zulu serve --port 8193'
    })).toBe('baidu.comate');
  });

  it('uses the reliable lsof command when ps returns a truncated command', () => {
    const command = preferReliableCommand('Comate', 'Co');

    expect(inferProjectNameFromContext({
      command,
      cwd: '/',
      packageName: null,
      args: '/Applications/Comate.app/Contents/Frameworks/Comate Helper.app/Contents/MacOS/Comate Helper'
    })).toBe('Comate');
  });
});

describe('preferReliableCommand', () => {
  it('keeps a complete lsof command when ps comm returns a truncated app path', () => {
    expect(preferReliableCommand('Comate', 'Co')).toBe('Comate');
  });

  it('keeps generic lsof commands in details instead of showing truncated ps comm values', () => {
    expect(preferReliableCommand('Python', 'Ce')).toBe('Python');
  });

  it('keeps concrete lsof app names instead of replacing them with ps paths', () => {
    expect(preferReliableCommand('Code Helper', 'Electron')).toBe('Code Helper');
  });

  it('keeps generic lsof command names for details', () => {
    expect(preferReliableCommand('node', 'vite')).toBe('node');
  });
});

describe('displayPathFromContext', () => {
  it('keeps a useful cwd as the display path', () => {
    expect(displayPathFromContext({
      command: 'node',
      cwd: '/Users/me/work/portly',
      args: '--user-data-dir=/Users/me/Library/Application Support/Comate'
    })).toBe('/Users/me/work/portly');
  });

  it('uses cwd before an application bundle for generic development commands', () => {
    expect(displayPathFromContext({
      command: 'node',
      cwd: '/Users/me/work/portly',
      args: '/Applications/Electron.app/Contents/MacOS/Electron /Users/me/work/portly/server.js'
    })).toBe('/Users/me/work/portly');
  });

  it('uses the application bundle before cwd for concrete apps', () => {
    expect(displayPathFromContext({
      command: 'WeChat',
      cwd: '/Users/me/Library/Containers/com.tencent.xinWeChat/Data',
      args: '/Applications/WeChat.app/Contents/MacOS/WeChat'
    })).toBe('/Applications/WeChat.app');
  });

  it('uses the application bundle before user-data-dir for concrete apps', () => {
    expect(displayPathFromContext({
      command: 'Comate',
      cwd: '/',
      args: '/Applications/Comate.app/Contents/MacOS/Comate --user-data-dir=/Users/me/Library/Application Support/Comate --lang=zh-CN'
    })).toBe('/Applications/Comate.app');
  });

  it('uses user-data-dir when cwd and application bundle are unavailable', () => {
    expect(displayPathFromContext({
      command: 'Comate',
      cwd: '/',
      args: '/opt/comate-helper --user-data-dir=/Users/me/Library/Application Support/Comate --lang=zh-CN'
    })).toBe('/Users/me/Library/Application Support/Comate');
  });

  it('falls back to the application bundle when cwd is unavailable', () => {
    expect(displayPathFromContext({
      command: 'Comate',
      cwd: '未知',
      args: '/Applications/Comate.app/Contents/Frameworks/Comate Helper.app/Contents/MacOS/Comate Helper'
    })).toBe('/Applications/Comate.app');
  });
});

describe('parsePsOutput', () => {
  it('parses batched ps output and indexes details by pid', () => {
    const output = [
      '  123 01:02   0.4  1.2 /usr/local/bin/node /usr/local/bin/node server.js',
      '  456 1-02:03:04   0.1  0.0 /Applications/App.app/Contents/MacOS/App /Applications/App.app/Contents/MacOS/App --port 8080'
    ].join('\n');

    const details = parsePsOutput(output);

    expect(details.get(123)).toMatchObject({
      uptime: '1min',
      mem: '0.4%',
      cpu: '1.2%',
      command: 'node',
      args: '/usr/local/bin/node server.js'
    });
    expect(details.get(456)).toMatchObject({
      uptime: '26h 3min',
      mem: '0.1%',
      cpu: '0.0%',
      command: 'App'
    });
  });
});
