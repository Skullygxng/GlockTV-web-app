/*
 * Address-bar state for deep-linked playback surfaces. The standalone
 * home-screen app on iOS cannot enter Picture-in-Picture (WebKit bug 303885),
 * so its players hand the viewer off to Safari — and this is what makes that
 * hand-off land on the same channel, event or title instead of the site's
 * front page. All state lives entirely in the query string, and other
 * parameters (a watch-party `room=`, for instance) are preserved untouched.
 */

export function isHomeScreenApp(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface LiveTvDeepLink {
  open: boolean;
  channelId: string;
  ppvEventId: string;
}

export function readLiveTvDeepLink(): LiveTvDeepLink {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      open: params.get('live') === '1',
      channelId: params.get('channel') ?? '',
      ppvEventId: params.get('ppv') ?? '',
    };
  } catch {
    return { open: false, channelId: '', ppvEventId: '' };
  }
}

/*
 * The undocumented `x-safari-` URL scheme is the one reliable way for a
 * standalone iOS home-screen web app to hand a URL to the real Safari browser
 * (iOS 17+, confirmed through current releases). window.open of the app's own
 * URL is special-cased back into the app window — which is why a scripted
 * hand-off simply reloads it. The result is meant to be rendered as a real
 * anchor href, so every tap is a fresh user gesture: iOS can block a scripted
 * second attempt after a user declines its confirm prompt once.
 */
export function safariHandOffUrl(): string {
  return typeof window === 'undefined' ? '' : `x-safari-${window.location.href}`;
}

export function writeLiveTvLink({
  open,
  channelId,
  ppvEventId,
}: { open: boolean; channelId?: string; ppvEventId?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set('live', '1');
      /* Undefined leaves the parameter alone; '' clears it. Selecting one
         surface clears the other, so a hand-off never carries both. */
      if (channelId !== undefined) {
        if (channelId) params.set('channel', channelId);
        else params.delete('channel');
      }
      if (ppvEventId !== undefined) {
        if (ppvEventId) params.set('ppv', ppvEventId);
        else params.delete('ppv');
      }
    } else {
      params.delete('live');
      params.delete('channel');
      params.delete('ppv');
    }
    const query = params.toString();
    const search = query ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  } catch {
    /* Address-bar updates are best-effort; playback never depends on them. */
  }
}