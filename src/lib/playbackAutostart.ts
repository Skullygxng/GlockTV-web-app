/*
 * Muted autostart for CineSrc on iPhone and iPad.
 *
 * The problem this solves: iOS will not let a video start on its own WITH
 * sound. So CineSrc's own autoplay=true is refused there, the player sits at
 * 0:00 until the viewer presses play, and during that window its fullscreen
 * button can be pressed before any video has loaded. CineSrc's player gets
 * stuck when that happens, and it is their code, inside their frame, so we
 * cannot fix the button itself.
 *
 * What we can do is close the window. iOS DOES allow a video to start on its
 * own when it is muted. So when CineSrc says it is ready, and it has not
 * already started playing by itself, GlockTV tells it to mute and play. The
 * video begins loading at once, and the viewer taps the player's own speaker
 * to turn the sound on - how most streaming sites behave on an iPhone.
 *
 * Three deliberate limits:
 *
 *   - iOS and iPadOS only. On a desktop, CineSrc's own autoplay usually
 *     succeeds with sound, and muting a viewer who never had the problem would
 *     be a regression for them. Android is left alone because nothing has been
 *     reported there and its fullscreen works differently.
 *   - CineSrc only. It has documented play/mute commands, which the watch
 *     party already drives. VidCore accepts no commands at all.
 *   - Once per player load. A second "ready" from the same frame must never
 *     re-mute a viewer who has already turned the sound back on.
 *
 * Unmuting: this originally left it to CineSrc's own speaker control, on the
 * reasoning that iOS only honours an unmute tapped inside the frame playing
 * the video. Real-iPhone testing showed that control does NOT unmute while
 * inline - only iOS's native fullscreen player's mute switch did. The likely
 * cause: iOS does not let a page change a video's volume at all, only mute
 * it, and a volume-style control cannot undo a mute. So GlockTV now offers its
 * own "Turn sound on", which sends CineSrc the exact inverse of the mute it
 * sent - setMuted(false). Whether iOS accepts that from a tap on our page is
 * something only a real device can confirm, so the UI also says where the
 * sound can always be turned on: in fullscreen.
 */

export const CINESRC_ORIGIN = 'https://cinesrc.st';

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

/*
 * Whether this browser refuses to autostart a video with sound, in the way
 * that strands CineSrc's player at 0:00.
 *
 * Every browser on iOS is WebKit underneath and says "iPhone" or "iPad" in its
 * user agent, so Chrome and Firefox on an iPhone are covered too. iPadOS 13
 * and later report themselves as a Mac; a "Mac" with a touchscreen is an iPad.
 */
export function needsMutedAutostart(nav: NavigatorLike | undefined | null): boolean {
  if (!nav) return false;
  if (/iPhone|iPad|iPod/.test(nav.userAgent ?? '')) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/* The event name from a CineSrc message ("ready", "play", ...), or null. */
export function cineSrcEventName(raw: unknown): string | null {
  let payload: unknown = raw;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== 'object') return null;
  const type = (payload as { type?: unknown }).type;
  if (typeof type !== 'string' || !type.startsWith('cinesrc:')) return null;
  const name = type.slice('cinesrc:'.length);
  /* "cinesrc:command" is what WE send; it is never an event from the player. */
  return name && name !== 'command' ? name : null;
}

/*
 * The two commands, in the order that matters: mute first, so the play is a
 * muted play that iOS will allow. Same message shape the watch party already
 * sends successfully.
 */
export function mutedAutostartCommands(): Array<{ type: 'cinesrc:command'; command: string; args: unknown[] }> {
  return [
    { type: 'cinesrc:command', command: 'setMuted', args: [true] },
    { type: 'cinesrc:command', command: 'play', args: [] },
  ];
}

/* The exact inverse of the mute in mutedAutostartCommands. */
export function unmuteCommand(): { type: 'cinesrc:command'; command: string; args: unknown[] } {
  return { type: 'cinesrc:command', command: 'setMuted', args: [false] };
}
