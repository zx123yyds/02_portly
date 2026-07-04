import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ProcessActionResult {
  ok: boolean;
  error?: string;
  signal?: NodeJS.Signals;
}

export interface KillProcessRequest {
  pid: number;
  port: number;
  waitMs?: number;
  isListening?: (pid: number, port: number) => Promise<boolean>;
}

export async function killProcess(request: KillProcessRequest): Promise<ProcessActionResult> {
  const { pid, port, waitMs = 900, isListening = isPidListeningOnPort } = request;
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, error: 'PID 无效' };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: '端口号无效' };
  }

  try {
    if (!(await isListening(pid, port))) {
      return { ok: false, error: '进程已不再监听该端口' };
    }

    process.kill(pid, 'SIGTERM');
    await sleep(waitMs);

    if (!(await isListening(pid, port))) {
      return { ok: true, signal: 'SIGTERM' };
    }

    process.kill(pid, 'SIGKILL');
    return { ok: true, signal: 'SIGKILL' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `无法结束进程：${message}` };
  }
}

async function isPidListeningOnPort(pid: number, port: number): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN'], {
      timeout: 2000,
      maxBuffer: 128 * 1024
    });
    return stdout
      .split(/\r?\n/)
      .some((line) => line.includes('(LISTEN)') && new RegExp(`:${port}(?:\\s|$)`).test(line));
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
