import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radio } from 'lucide-react';
import { LiveTvRoute } from './LiveTvRoute';
import { readLiveTvDeepLink, writeLiveTvLink } from '../lib/liveTvLink';

function findNavs() {
  return {
    desktop: document.querySelector('.topbar__nav'),
    mobile: document.querySelector('.bottom-nav'),
  };
}

export function LiveTvIntegration() {
  /* A deep link (?live=1) opens the stage directly, so the Safari hand-off
     from the player lands back on Live TV instead of the site's front page. */
  const [open, setOpen] = useState(() => readLiveTvDeepLink().open);
  const [desktopNav, setDesktopNav] = useState<Element | null>(null);
  const [mobileNav, setMobileNav] = useState<Element | null>(null);

  useEffect(() => {
    const attach = () => {
      const next = findNavs();
      setDesktopNav(next.desktop);
      setMobileNav(next.mobile);
      return Boolean(next.desktop && next.mobile);
    };

    if (attach()) return;

    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const retry = window.setInterval(() => {
      if (attach()) window.clearInterval(retry);
    }, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(retry);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('live-tv-open', open);
    return () => document.body.classList.remove('live-tv-open');
  }, [open]);

  useEffect(() => {
    /* Keep the address in step with the stage. When the deep link already
       matches, this leaves its channel parameter untouched. */
    if (readLiveTvDeepLink().open !== open) writeLiveTvLink({ open, channelId: '' });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeForOtherNavigation = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target || target.hasAttribute('data-live-tv-nav')) return;
      if (target.closest('.topbar__nav') || target.closest('.bottom-nav')) setOpen(false);
    };
    document.addEventListener('click', closeForOtherNavigation, true);
    return () => document.removeEventListener('click', closeForOtherNavigation, true);
  }, [open]);

  const toggle = () => setOpen((current) => !current);

  const desktopButton = (
    <button
      type="button"
      data-live-tv-nav
      className={open ? 'active live-tv-nav-button' : 'live-tv-nav-button'}
      onClick={toggle}
    >
      Live TV
    </button>
  );

  const mobileButton = (
    <button
      type="button"
      data-live-tv-nav
      aria-label="Mobile Live TV"
      className={open ? 'active live-tv-nav-button' : 'live-tv-nav-button'}
      onClick={toggle}
    >
      <Radio />
      <span>Live</span>
    </button>
  );

  return (
    <>
      {desktopNav && createPortal(desktopButton, desktopNav)}
      {mobileNav && createPortal(mobileButton, mobileNav)}
      {open && <LiveTvRoute onClose={() => setOpen(false)} />}
    </>
  );
}
