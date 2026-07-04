import { describe, expect, it } from 'vitest';
import { collectKillTargets, isProjectDevProcess, parsePsRows } from './dev-clean.mjs';

const root = '/Users/example/02_portly';

describe('dev-clean process matching', () => {
  it('matches only Portly dev processes in the project root', () => {
    expect(isProjectDevProcess(`node ${root}/node_modules/.bin/vite --host 127.0.0.1`, root)).toBe(true);
    expect(isProjectDevProcess(`node ${root}/node_modules/.bin/electron .`, root)).toBe(true);
    expect(isProjectDevProcess(`node ${root}/node_modules/.bin/concurrently -k npm:dev:renderer npm:dev:electron`, root)).toBe(true);
    expect(isProjectDevProcess(`/Applications/Visual Studio Code.app/Contents/MacOS/Code --goto ${root}/README.md`, root)).toBe(false);
    expect(isProjectDevProcess('node /tmp/other/node_modules/.bin/vite --host 127.0.0.1', root)).toBe(false);
  });

  it('collects process groups for matched dev processes and skips the current pid', () => {
    const rows = parsePsRows([
      `101 99 77 node ${root}/node_modules/.bin/concurrently -k npm:dev:renderer npm:dev:electron`,
      `102 101 77 node ${root}/node_modules/.bin/vite --host 127.0.0.1`,
      `103 101 77 node ${root}/node_modules/.bin/electron .`,
      `201 1 201 /Applications/Visual Studio Code.app/Contents/MacOS/Code --goto ${root}/README.md`,
      `999 1 999 node ${root}/scripts/dev-clean.mjs`
    ].join('\n'));

    const targets = collectKillTargets(rows, root, 999);

    expect([...targets.processGroups]).toEqual([77]);
    expect([...targets.pids]).toEqual([101, 102, 103]);
  });
});
