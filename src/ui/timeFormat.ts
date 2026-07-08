export function formatScanTime(value: string) {
  return formatTime(value, { second: '2-digit' });
}

export function formatTime(value: string, options: Intl.DateTimeFormatOptions = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未扫描';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', ...options });
}
