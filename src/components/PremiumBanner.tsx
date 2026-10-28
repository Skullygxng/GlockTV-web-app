import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAccount } from './AccountProvider';
import { site } from '../config/site';
import '../premium.css';

/*
 * The visible half of the business model.
 *
 * A visitor should be able to tell, without opening the account panel, that
 * there is a free ad-supported plan and a paid ad-free one. This is the one
 * place that says so: it appears once entitlements have settled, never for a
 * member who already paid, and it stays dismissed for the rest of the visit.
 */

const DISMISSED_KEY = 'glocktv-premium-banner-hidden';

export function PremiumBanner({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { account, entitlements, ready } = useAccount();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
  });

  if (!ready || hidden) return null;
  /* Nothing to sell to somebody who already has it. */
  if (entitlements.tier === 'premium') return null;

  const isGuest = !account || account.isAnonymous;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
    setHidden(true);
  };

  return (
    <aside className="premium-banner" aria-label={`${site.name} Premium`}>
      <div>
        <strong><Sparkles /> Premium, ad-free</strong>
        <span>
          {isGuest
            ? 'Free with ads. Create an account to keep your list, parties and progress — then go ad-free.'
            : 'You are on the free plan with ads. Premium removes them.'}
        </span>
      </div>
      <button type="button" onClick={onOpenAccount}>
        {isGuest ? 'Create account' : 'Go Premium'}
      </button>
      <button type="button" className="premium-banner__close" aria-label="Dismiss" onClick={dismiss}>
        <X />
      </button>
    </aside>
  );
}
