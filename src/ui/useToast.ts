import { useEffect, useState } from 'react';

export function useToast(timeoutMs = 1500) {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [toast, timeoutMs]);

  return { toast, setToast };
}
