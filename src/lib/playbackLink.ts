/*
 * Deep link for the playback modal: `?watch=movie|tv&title=<tmdb id>` with
 * optional `season=` and `episode=` for a series. The standalone home-screen
 * app on iOS cannot enter Picture-in-Picture (WebKit bug 303885), so its
 * player hands the viewer off to Safari — and this makes that hand-off land
 * on the same title, season and episode. Other parameters are preserved
 * untouched.
 */

export interface PlaybackDeepLink {
  type: 'movie' | 'tv';
  id: number;
  season: number | null;
  episode: number | null;
}

export function readPlaybackDeepLink(): PlaybackDeepLink | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('watch');
    if (type !== 'movie' && type !== 'tv') return null;
    const id = Number(params.get('title'));
    if (!Number.isInteger(id) || id <= 0) return null;
    const season = Number(params.get('season'));
    const episode = Number(params.get('episode'));
    return {
      type,
      id,
      season: Number.isInteger(season) && season > 0 ? season : null,
      episode: Number.isInteger(episode) && episode > 0 ? episode : null,
    };
  } catch {
    return null;
  }
}

export function writePlaybackLink({
  type,
  id,
  season,
  episode,
}: { type: 'movie' | 'tv'; id: number; season?: number; episode?: number }): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    params.set('watch', type);
    params.set('title', String(id));
    if (season) params.set('season', String(season));
    else params.delete('season');
    if (episode) params.set('episode', String(episode));
    else params.delete('episode');
    const query = params.toString();
    const search = query ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  } catch {
    /* Address-bar updates are best-effort; playback never depends on them. */
  }
}

export function clearPlaybackLink(): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete('watch');
    params.delete('title');
    params.delete('season');
    params.delete('episode');
    const query = params.toString();
    const search = query ? `?${query}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
  } catch {
    /* Address-bar updates are best-effort; playback never depends on them. */
  }
}