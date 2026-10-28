import { useEffect, useState } from 'react';

/*
 * Whether a class is on <body>, kept in sync as it changes.
 *
 * Some UI is global rather than local: Live TV is mounted beside the app and
 * says it is open by adding a body class, so a component that wants to stand
 * down while it is open - the Discover trailer preview, say - has to watch the
 * body rather than wait for a prop that will never arrive.
 */
export function useBodyClass(className: string): boolean {
  const [active, setActive] = useState(
    () => typeof document !== 'undefined' && document.body.classList.contains(className),
  );

  useEffect(() => {
    const sync = () => setActive(document.body.classList.contains(className));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
    return () => observer.disconnect();
  }, [className]);

  return active;
}
