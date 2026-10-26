import type { MemoryTransport } from '../src/modules/mail/transports/memory.transport';

export async function waitForEmail(
  memoryTransport: MemoryTransport,
  to: string,
  maxWaitMs = 8000,
): Promise<MemoryTransport['sent'][number] | undefined> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const found = memoryTransport.sent.find((msg) => msg.to === to);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return undefined;
}

export function extractToken(email: MemoryTransport['sent'][number], param: string): string {
  const content = email.text ?? email.html ?? '';
  const match = content.match(new RegExp(`[?&]${param}=([A-Za-z0-9_-]+)`));
  if (!match?.[1]) throw new Error(`Token param "${param}" not found in email`);
  return match[1];
}
