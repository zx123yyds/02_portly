import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { PortEntry, PortScanResult } from '../src/types.js';
import { parseLsofOutput } from '../src/lib/ports.js';

const execFileAsync = promisify(execFile);

type ProcessDetails = Partial<PortEntry> & { args?: string };

export async function scanListeningPorts(): Promise<PortScanResult> {
  if (process.env.PORTLY_TEST_SCAN_MODE === 'sample') {
    return {
      ok: true,
      ports: [{
        id: '4242:5173:TCP',
        port: 5173,
        name: 'portly',
        project: 'portly',
        pid: 4242,
        protocol: 'TCP',
        address: 'localhost:5173',
        command: 'node',
        cwd: process.cwd(),
        uptime: '1min',
        mem: '0.3%',
        cpu: '0.0%',
        kind: 'dev'
      }],
      scannedAt: new Date().toISOString(),
      source: 'lsof'
    };
  }

  if (process.env.PORTLY_TEST_SCAN_MODE === 'empty') {
    return {
      ok: true,
      ports: [],
      scannedAt: new Date().toISOString(),
      source: 'lsof'
    };
  }

  if (process.env.PORTLY_TEST_SCAN_MODE === 'error') {
    return {
      ok: false,
      ports: [],
      scannedAt: new Date().toISOString(),
      source: 'lsof',
      error: '测试模式：模拟 lsof 读取失败'
    };
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    const ports = await hydrateProcessDetails(parseLsofOutput(stdout));

    return {
      ok: true,
      ports,
      scannedAt: new Date().toISOString(),
      source: 'lsof'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      ports: [],
      scannedAt: new Date().toISOString(),
      source: 'lsof',
      error: `无法读取监听端口：${message}`
    };
  }
}

async function hydrateProcessDetails(ports: PortEntry[]): Promise<PortEntry[]> {
  if (ports.length === 0) return ports;

  const uniquePids = [...new Set(ports.map((port) => port.pid))];
  const details = new Map<number, Partial<PortEntry>>();
  const psDetails = await readProcessStats(uniquePids);

  await Promise.all(
    uniquePids.map(async (pid) => {
      try {
        const [cwd] = await Promise.all([readProcessCwd(pid)]);
        const parsed = psDetails.get(pid) ?? {};
        const packageName = await readPackageName(cwd);
        const lsofCommand = ports.find((port) => port.pid === pid)?.command ?? '';
        const command = preferReliableCommand(lsofCommand, parsed.command);
        const args = parsed.args ?? '';
        const displayPath = displayPathFromContext({ command, cwd, args });
        const projectName = inferProjectNameFromContext({
          command,
          cwd: displayPath,
          packageName,
          args
        });
        details.set(pid, {
          ...parsed,
          command,
          cwd: displayPath,
          name: projectName,
          project: projectName
        });
      } catch {
        details.set(pid, {});
      }
    })
  );

  return ports.map((port) => ({ ...port, ...details.get(port.pid) }));
}

async function readProcessStats(pids: number[]): Promise<Map<number, ProcessDetails>> {
  if (pids.length === 0) return new Map();

  try {
    const { stdout } = await execFileAsync('ps', ['-p', pids.join(','), '-o', 'pid=,etime=,%mem=,%cpu=,comm=,args='], {
      timeout: 2000,
      maxBuffer: 256 * 1024
    });
    return parsePsOutput(stdout);
  } catch {
    return new Map();
  }
}

export function parsePsOutput(output: string): Map<number, ProcessDetails> {
  const details = new Map<number, ProcessDetails>();
  for (const line of output.split(/\r?\n/)) {
    const parsed = parsePsLine(line);
    if (parsed) details.set(parsed.pid, parsed.details);
  }
  return details;
}

function parsePsLine(line: string): { pid: number; details: ProcessDetails } | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
  if (!match) return null;

  const [, pidText, uptime, memPct, cpuPct, commandPath, args] = match;
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const commandName = commandPath.split('/').pop() || commandPath;
  return {
    pid,
    details: {
      uptime: formatElapsedTime(uptime),
      mem: `${memPct}%`,
      cpu: `${cpuPct}%`,
      command: commandName,
      args
    }
  };
}

export function formatElapsedTime(etime: string): string {
  const normalized = etime.trim();
  const dayMatch = normalized.match(/^(\d+)-(.+)$/);
  const timeText = dayMatch ? dayMatch[2] : normalized;
  const parts = timeText.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return etime;

  const days = dayMatch ? Number.parseInt(dayMatch[1], 10) : 0;
  let hours = 0;
  let minutes = 0;

  if (parts.length === 3) {
    [hours, minutes] = parts;
  } else if (parts.length === 2) {
    [minutes] = parts;
  } else {
    return etime;
  }

  const totalHours = days * 24 + hours;
  if (totalHours > 0) return `${totalHours}h ${minutes}min`;
  return `${minutes}min`;
}

export function preferReliableCommand(lsofCommand: string, psCommand?: string): string {
  const original = lsofCommand.trim();
  const candidate = psCommand?.trim() ?? '';

  if (!original) return candidate;
  return original;
}

export function inferProjectNameFromContext({ command, cwd, packageName, args }: {
  command: string;
  cwd: string;
  packageName: string | null;
  args: string;
}): string {
  if (packageName) return packageName;

  const folderName = usefulFolderName(cwd);
  if (isGenericCommand(command) && folderName) return folderName;

  const argName = usefulNameFromArgs(args);
  if (isGenericCommand(command) && argName) return argName;

  return command || 'Unknown';
}

export function displayPathFromContext({ command, cwd, args }: { command: string; cwd: string; args: string }): string {
  const appPath = appBundlePathFromArgs(args);
  if (!isGenericCommand(command) && appPath) return appPath;

  if (usefulFolderName(cwd)) return cwd;

  if (appPath) return appPath;

  const userDataDir = pathValueFromArgs(args, '--user-data-dir');
  if (userDataDir) return userDataDir;

  return cwd || '未知';
}

function usefulNameFromArgs(args: string): string | null {
  const extensionMatch = args.match(/\/\.vscode\/extensions\/([^/\s]+?)-\d/i);
  if (extensionMatch) return extensionMatch[1];

  const pathMatch = args.match(/(?:^|\s)(\/[^\s]+)/g);
  if (!pathMatch) return null;

  for (const rawPath of pathMatch.map((item) => item.trim())) {
    const base = path.basename(rawPath);
    if (base && !isGenericCommand(base) && base !== 'bin') return base;
  }
  return null;
}

function pathValueFromArgs(args: string, key: string): string | null {
  const start = args.indexOf(`${key}=`);
  if (start === -1) return null;

  const valueStart = start + key.length + 1;
  let nextOption = args.indexOf(' --', valueStart);
  if (nextOption === -1) nextOption = args.length;
  const value = args.slice(valueStart, nextOption).trim();
  return value || null;
}

function appBundlePathFromArgs(args: string): string | null {
  const match = args.match(/(\/Applications\/.*?\.app)(?:\/|\s|$)/);
  return match?.[1] ?? null;
}

function isGenericCommand(command: string): boolean {
  return /^(node|npm|pnpm|yarn|bun|deno|python|python3|ruby|n|electron)$/i.test(command);
}

async function readPackageName(cwd: string): Promise<string | null> {
  if (!cwd || cwd === '未知' || cwd === '/') return null;

  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
  } catch {
    return null;
  }
}

function usefulFolderName(cwd: string): string | null {
  if (!cwd || cwd === '未知' || cwd === '/') return null;
  const base = path.basename(cwd);
  if (!base || base === '.' || base === '/') return null;
  return base;
}

async function readProcessCwd(pid: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {
      timeout: 2000,
      maxBuffer: 64 * 1024
    });
    const cwd = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith('n'))
      ?.slice(1);
    return cwd || '未知';
  } catch {
    return '未知';
  }
}
