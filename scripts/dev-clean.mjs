import { execFile } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = 5173;

export function isProjectDevProcess(args, projectRoot) {
  if (!args.includes(projectRoot)) return false;
  if (args.includes('scripts/dev-clean.mjs')) return false;

  return [
    '/node_modules/.bin/concurrently',
    '/node_modules/.bin/vite',
    '/node_modules/.bin/electron',
    '/node_modules/electron/dist/Electron',
    'VITE_DEV_SERVER_URL=http://127.0.0.1:5173',
    'wait-on tcp:5173'
  ].some((needle) => args.includes(needle));
}

export function parsePsRows(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        pgid: Number(match[3]),
        args: match[4]
      };
    })
    .filter(Boolean);
}

export function collectKillTargets(rows, projectRoot, currentPid = process.pid) {
  const matched = rows.filter((row) => row.pid !== currentPid && isProjectDevProcess(row.args, projectRoot));
  return {
    pids: new Set(matched.map((row) => row.pid)),
    processGroups: new Set(matched.map((row) => row.pgid).filter((pgid) => pgid > 1 && pgid !== currentPid))
  };
}

async function listProcesses() {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid,ppid,pgid,args'], { maxBuffer: 1024 * 1024 });
  return parsePsRows(stdout);
}

async function portIsListening(port) {
  try {
    await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForPortRelease(port, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await portIsListening(port))) return;
    await delay(150);
  }
  throw new Error(`端口 ${port} 仍被占用，无法启动 dev server`);
}

async function main() {
  const projectRoot = process.cwd();
  const rows = await listProcesses();
  const targets = collectKillTargets(rows, projectRoot);

  for (const pgid of targets.processGroups) {
    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {}
  }

  for (const pid of targets.pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }

  await waitForPortRelease(DEFAULT_PORT);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
