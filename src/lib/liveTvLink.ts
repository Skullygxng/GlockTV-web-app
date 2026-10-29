/*
 * The live stage's address-bar state. The standalone home-screen app on iOS
 * cannot enter Picture-in-Picture (WebKit bug 303885), so its Live TV player
 * hands the viewer off to Safari — and this is what makes that hand-off land
 * on the same channel instead of the site's front page. The state lives
 * entirely in the query string: `?live=1` opens the stage, `channel=<id>`
 * pre-selects a channel. Other parameters (a watch-party `room=`, for
 * instance) are preserved untouched.
 */

export function readLiveTvDeepLink(): { open: boolean; channelId: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    return { open: params.get('live') === '1', channelId: params.get('channel') ?? '' };
  } catch {
    return { open: false, channelId: '' };
  }
}

export function writeLiveTvLink({ open, channelId }: { open: boolean; channelId?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set('live', '1');
      if (channelId) params.set('channel', channelId);
      else params.delete('channel');
    } else {
      params.delete('live');
      params.delete('channel');
    }
    const query = params.toString();
    const search = query ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  } catch {
    /* Address-bar updates are best-effort; playback never depends on them. */
  }
}