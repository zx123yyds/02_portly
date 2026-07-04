import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

try {
  const { stdout } = await execFileAsync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
    timeout: 5000,
    maxBuffer: 1024 * 1024
  });

  const rows = stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 10 || parts.at(-1) !== '(LISTEN)') return null;
      const command = parts[0];
      const pid = parts[1];
      const protocol = parts[7];
      const endpoint = parts.slice(8, -1).join(' ');
      const port = endpoint.match(/:(\d+)$/)?.[1];
      return port ? { command, pid: Number(pid), protocol, endpoint, port: Number(port) } : null;
    })
    .filter(Boolean);

  console.log(JSON.stringify({ ok: true, source: 'lsof', count: rows.length, ports: rows }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, source: 'lsof', error: message }, null, 2));
  process.exitCode = 1;
}
