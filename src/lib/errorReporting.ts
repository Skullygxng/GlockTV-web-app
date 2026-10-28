/*
 * Where a client-side failure goes.
 *
 * No third-party SDK: an optional https endpoint is enough, and a deployment
 * that sets none still gets a console line rather than silence. Nothing
 * identifying is sent - no email, no account id, no room code - so a report
 * cannot become a privacy problem of its own.
 */
function endpoint(): string | null {
  const value = (import.meta.env.VITE_ERROR_WEBHOOK_URL as string | undefined ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function pageUrl(): string {
  if (typeof window === 'undefined') return '';
  /* Query strings can carry a room code, so only the path is reported. */
  return `${window.location.origin}${window.location.pathname}`;
}

export function reportError(reason: unknown, source = 'app'): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack ?? '' : '';

  /* Always visible to a developer, even with no endpoint configured. */
  console.error('[app]', source, reason);

  const url = endpoint();
  if (!url || typeof window === 'undefined') return;

  const body = JSON.stringify({
    source,
    message: message.slice(0, 500),
    stack: stack.slice(0, 2000),
    page: pageUrl(),
  });

  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body)) return;
  } catch {
    /* Fall through to fetch. */
  }

  void fetch(url, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    keepalive: true,
  }).catch(() => undefined);
}
