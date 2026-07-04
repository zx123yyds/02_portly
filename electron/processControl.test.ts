import { afterEach, describe, expect, it, vi } from 'vitest';
import { killProcess } from './processControl';

describe('killProcess', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects invalid pids without signalling a process', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const result = await killProcess({ pid: 0, port: 5173 });

    expect(result).toEqual({ ok: false, error: 'PID 无效' });
    expect(kill).not.toHaveBeenCalled();
  });

  it('rejects requests when the pid no longer owns the selected port', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const isListening = vi.fn().mockResolvedValue(false);

    const result = await killProcess({ pid: 12345, port: 5173, isListening });

    expect(result).toEqual({ ok: false, error: '进程已不再监听该端口' });
    expect(isListening).toHaveBeenCalledWith(12345, 5173);
    expect(kill).not.toHaveBeenCalled();
  });

  it('sends SIGTERM and reports success when the process exits before timeout', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const isListening = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await killProcess({ pid: 12345, port: 5173, isListening, waitMs: 1 });

    expect(result).toEqual({ ok: true, signal: 'SIGTERM' });
    expect(kill).toHaveBeenCalledWith(12345, 'SIGTERM');
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('falls back to SIGKILL when SIGTERM does not stop the listener in time', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const isListening = vi.fn().mockResolvedValue(true);

    const result = await killProcess({ pid: 12345, port: 5173, isListening, waitMs: 1 });

    expect(result).toEqual({ ok: true, signal: 'SIGKILL' });
    expect(kill).toHaveBeenNthCalledWith(1, 12345, 'SIGTERM');
    expect(kill).toHaveBeenNthCalledWith(2, 12345, 'SIGKILL');
  });

  it('returns the system error when termination fails', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('operation not permitted');
    });

    const result = await killProcess({ pid: 12345, port: 5173, isListening: vi.fn().mockResolvedValue(true), waitMs: 1 });

    expect(result).toEqual({ ok: false, error: '无法结束进程：operation not permitted' });
  });
});
