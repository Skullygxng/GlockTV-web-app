import { useEffect, useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';
import { site } from '../config/site';

/*
 * The install invitation.
 *
 * On an iPhone the only route to a home-screen icon is Safari's share sheet,
 * which most people never find; the app says it out loud instead - once, and
 * never again once it is dismissed or already installed. Chrome and Android
 * get a real button, because there the browser offers a prompt the page can
 * raise on demand.
 */

const DISMISSED_KEY = 'glocktv-install-prompt-dismissed';
const SHOW_AFTER_MS = 5000;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/* Launched from the home screen already: there is nothing left to offer. */
function isStandalone(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  /* iPadOS reports itself as a Mac; the touch points give it away. */
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/* Only Safari offers "Add to Home Screen"; the others wrap their own browser. */
function isSafariOnIos(): boolean {
  return isIos() && /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
}

function isPhone(): boolean {
  return window.matchMedia?.('(max-width: 700px)').matches ?? false;
}

export function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || window.localStorage.getItem(DISMISSED_KEY)) return;

    if (isSafariOnIos()) {
      const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }

    /* The Chromium prompt only exists on phones; a desktop install is rare
       enough that the banner would just be noise. */
    if (!isPhone()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  const install = () => {
    if (!prompt) return;
    void prompt
      .prompt()
      .then(() => prompt.userChoice)
      .then(({ outcome }) => {
        if (outcome === 'accepted') dismiss();
        else setVisible(false);
      });
  };

  return (
    <aside className="install-prompt" aria-label={`Install ${site.name}`}>
      <div>
        <span className="install-prompt__icon" aria-hidden="true">
          {prompt ? <SquarePlus /> : <Share />}
        </span>
        <div>
          <strong>Put {site.name} on your Home Screen</strong>
          {prompt ? (
            <p>It opens without browser chrome, like an app of its own.</p>
          ) : (
            <p>
              Tap <Share aria-hidden="true" /> below, then <b>Add to Home Screen</b>.
            </p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Not now">
          <X />
        </button>
      </div>
      {prompt && (
        <button type="button" className="install-prompt__go" onClick={install}>
          Add to Home Screen
        </button>
      )}
    </aside>
  );
}
