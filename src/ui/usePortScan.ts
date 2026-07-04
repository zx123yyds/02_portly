import { useCallback, useMemo, useRef, useState } from 'react';
import type { PortEntry, PortScanResult } from '../types';

const fallbackResult: PortScanResult = {
  ok: true,
  ports: [],
  scannedAt: new Date().toISOString(),
  source: 'browser-fallback'
};

interface RefreshPortsOptions {
  notifyError?: boolean;
  preserveOnError?: boolean;
  showLoading?: boolean;
}

export function usePortScan(onError: () => void) {
  const [scan, setScan] = useState<PortScanResult>(fallbackResult);
  const [loading, setLoading] = useState(true);
  const refreshingRef = useRef<Promise<PortScanResult> | null>(null);

  const devPorts = useMemo(() => scan.ports.filter((port) => port.kind === 'dev'), [scan.ports]);
  const otherPorts = useMemo(() => scan.ports.filter((port) => port.kind === 'other'), [scan.ports]);

  const refreshPorts = useCallback(async ({
    notifyError = true,
    preserveOnError = false,
    showLoading = true
  }: RefreshPortsOptions = {}) => {
    if (refreshingRef.current) return refreshingRef.current;

    if (showLoading) setLoading(true);

    const task = (async () => {
      try {
        const result = window.portly ? await window.portly.scanPorts() : fallbackResult;
        if (result.ok || !preserveOnError) setScan(result);
        if (!result.ok && notifyError) onError();
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result: PortScanResult = {
          ok: false,
          ports: [],
          scannedAt: new Date().toISOString(),
          source: 'browser-fallback',
          error: `无法读取监听端口：${message}`
        };
        if (!preserveOnError) setScan(result);
        if (notifyError) onError();
        return result;
      } finally {
        if (showLoading) setLoading(false);
        refreshingRef.current = null;
      }
    })();

    refreshingRef.current = task;
    return task;
  }, [onError]);

  return {
    scan,
    loading,
    devPorts,
    otherPorts,
    refreshPorts
  };
}

export type PortScanController = ReturnType<typeof usePortScan>;
export type PortAction = (port: PortEntry) => void;
