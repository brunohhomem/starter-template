export function safeAppPath(value: string | null): string {
  if (value === '/app' || value?.startsWith('/app/')) return value;
  return '/app';
}
