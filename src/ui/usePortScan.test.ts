import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForMinimumDuration } from './usePortScan';

describe('waitForMinimumDuration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps fast refresh feedback visible for the requested minimum duration', async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(100);

    let settled = false;
    const promise = waitForMinimumDuration(0, 450).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(349);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });

  it('does not wait when the minimum duration has already elapsed', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(600);

    await expect(waitForMinimumDuration(0, 450)).resolves.toBeUndefined();
  });
});
