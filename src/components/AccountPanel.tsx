import { type FormEvent, useEffect, useState } from 'react';
import { CreditCard, LifeBuoy, LoaderCircle, LogOut, Mail, Palette, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAccount } from './AccountProvider';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { createDefaultBillingService, type BillingService } from '../lib/billing';
import { createDefaultSupportStaffService, type SupportStaffService } from '../lib/supportStaff';
import { site } from '../config/site';

/*
 * The GlockTV account surface. It reads the global account layer and offers
 * the two identity actions; it has no way to change a tier, because nothing in
 * the browser does.
 *
 * The admin dashboard is one button further in, and only appears when the
 * database says this account is staff - the panel asks, it does not decide.
 */
let defaultBilling: BillingService | null | undefined;
function getDefaultBilling(): BillingService | null {
  if (defaultBilling === undefined) defaultBilling = createDefaultBillingService();
  return defaultBilling;
}

let defaultStaffService: SupportStaffService | null | undefined;
function getDefaultStaffService(): SupportStaffService | null {
  if (defaultStaffService === undefined) defaultStaffService = createDefaultSupportStaffService();
  return defaultStaffService;
}

export function AccountPanel({
  onClose,
  onOpenSupport,
  onOpenAdmin,
  billing: providedBilling,
  staffService: providedStaffService,
}: {
  onClose: () => void;
  /* Support is part of the account surface rather than a sixth destination. */
  onOpenSupport?: () => void;
  /* The owner's dashboard, offered only to staff. */
  onOpenAdmin?: () => void;
  /* Omit for the app's own billing client; pass null to run with no backend. */
  billing?: BillingService | null;
  /* Omit for the app's own check; pass null to run with no backend. */
  staffService?: SupportStaffService | null;
}) {
  const {
    account, entitlements, loading, error,
    confirmingMembership, confirmationTimedOut,
    linkEmail, sendSignInLink, canSignOut, signOut,
  } = useAccount();
  const billing = providedBilling === undefined ? getDefaultBilling() : providedBilling;
  const staffService = providedStaffService === undefined ? getDefaultStaffService() : providedStaffService;

  const [email, setEmail] = useState(account?.email ?? '');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  /* Separate from the identity actions: a checkout in flight must not be
     restartable by a second click while the first is still going. */
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [isStaff, setIsStaff] = useState(false);

  const dialog = useDialogBehavior<HTMLElement>({ onClose });

  useEffect(() => {
    if (!staffService) { setIsStaff(false); return; }
    let active = true;
    void staffService.isStaff().then((value) => { if (active) setIsStaff(value); });
    return () => { active = false; };
  }, [staffService]);

  const isGuest = !account || account.isAnonymous;
  const isPremium = entitlements.tier === 'premium';

  const run = async (action: () => Promise<void>, done: string) => {
    if (busy || !email.trim()) return;
    setBusy(true); setStatus(''); setActionError('');
    try {
      await action();
      setStatus(done);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const protectAccount = (event: FormEvent) => {
    event.preventDefault();
    void run(() => linkEmail(email), 'Check your email to finish protecting this account.');
  };

  /*
   * Both membership actions do the same thing: ask the server for a hosted
   * Bitcoin invoice (NOWPayments) and go there. The browser never talks to
   * the payment provider, and nothing here can change a tier - only the
   * verified IPN webhook does that.
   */
  const goToCheckout = async (request: () => Promise<string>, unavailable: string) => {
    if (billingBusy) return;
    if (!billing) { setBillingError(unavailable); return; }
    setBillingBusy(true); setBillingError('');
    try {
      window.location.assign(await request());
    } catch (reason) {
      setBillingError(reason instanceof Error ? reason.message : unavailable);
      /* Only cleared on failure: on success the page is navigating away, and
         re-enabling the button first would invite a second checkout. */
      setBillingBusy(false);
    }
  };

  return (
    <div className="overlay account-overlay">
      <section
        ref={dialog}
        className="account-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Your ${site.name} account`}
      >
        <header>
          <div><ShieldCheck /><h2>Your account</h2></div>
          <button type="button" aria-label="Close account" onClick={onClose}><X /></button>
        </header>

        <dl className="account-panel__status">
          <div>
            <dt>Signed in as</dt>
            <dd>
              {loading
                ? <span className="account-panel__pending"><LoaderCircle className="spin" /> Checking…</span>
                : isGuest ? 'Guest' : (account?.email ?? 'Signed in')}
            </dd>
          </div>
          <div>
            <dt>Membership</dt>
            {/* Free is what an account is until a server says otherwise, so it
                is stated plainly rather than as a downgrade. */}
            <dd className={isPremium ? 'account-panel__tier--premium' : undefined}>
              {isPremium ? <><Sparkles /> Premium · ad-free</> : 'Free'}
            </dd>
          </div>
        </dl>

        {error && <p className="account-panel__note" role="status">Membership status is unavailable right now, so this account is on the free tier.</p>}

        {/*
          * The membership card. Its state comes from the server's answer, never
          * from having just been through checkout.
          */}
        <section className="account-premium" aria-label={`${site.name} Premium`}>
          <header>
            <div><Sparkles /><strong>{site.name} Premium</strong></div>
            <span>Ad-free {site.name}</span>
          </header>

          {confirmingMembership && (
            <p className="account-premium__pending" role="status">
              <LoaderCircle className="spin" /> Confirming membership…
            </p>
          )}

          {confirmationTimedOut && !isPremium && !confirmingMembership && (
            <p className="account-premium__pending" role="status">
              We have not had confirmation from the payment provider yet. Nothing is lost - this
              updates by itself once it arrives, and you can reopen this panel to check.
            </p>
          )}

          {isPremium ? (
            <div className="account-premium__actions">
              <button
                type="button"
                disabled={billingBusy}
                onClick={() => void goToCheckout(
                  () => billing!.createCheckoutUrl(),
                  'Bitcoin checkout could not be started.',
                )}
              >
                {billingBusy ? <LoaderCircle className="spin" /> : <CreditCard />} Extend membership
              </button>
            </div>
          ) : isGuest ? (
            /* No checkout for an anonymous account: it lives in one browser's
               storage, so a membership bought against it could be lost with a
               cleared cache and never recovered. */
            <p className="account-premium__gate" role="status">
              Protect your account with email first, then you can go Premium.
            </p>
          ) : (
            <div className="account-premium__actions">
              <button
                type="button"
                disabled={billingBusy}
                onClick={() => void goToCheckout(
                  () => billing!.createCheckoutUrl(),
                  'Bitcoin checkout could not be started.',
                )}
              >
                {billingBusy ? <LoaderCircle className="spin" /> : <Sparkles />} Go Premium
              </button>
            </div>
          )}

          {billingError && <small className="account-panel__error" role="alert">{billingError}</small>}
        </section>

        <form onSubmit={protectAccount}>
          <p>
            {isGuest
              ? 'Add an email to keep this identity across devices. Your rooms, hosting and history stay with you.'
              : 'Need to sign in somewhere else? Send yourself a link.'}
          </p>
          <label>
            Account email
            <input
              type="email"
              aria-label="Account email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setStatus(''); setActionError(''); }}
              placeholder="you@example.com"
            />
          </label>
          <div className="account-panel__actions">
            {isGuest && (
              <button type="submit" disabled={busy || !email.trim()}>
                <ShieldCheck /> Protect guest account
              </button>
            )}
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void run(() => sendSignInLink(email), 'Sign-in link sent. Open it on this device.')}
            >
              <Mail /> Email sign-in link
            </button>
            {!isGuest && canSignOut && (
              /* Ends the session on this device only: the account itself, its
                 rooms and its history are untouched and sign back in by link. */
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true); setStatus(''); setActionError('');
                  void signOut().then(() => setStatus('Signed out on this device.'))
                    .catch((reason: unknown) => setActionError(reason instanceof Error ? reason.message : 'That did not work. Try again.'))
                    .finally(() => setBusy(false));
                }}
              >
                <LogOut /> Sign out
              </button>
            )}
          </div>
          {status && <small role="status">{status}</small>}
          {actionError && <small className="account-panel__error" role="alert">{actionError}</small>}
        </form>

        {(onOpenSupport || (onOpenAdmin && isStaff)) && (
          <div className="account-panel__actions">
            {onOpenAdmin && isStaff && (
              <button type="button" onClick={onOpenAdmin}>
                <Palette /> Admin dashboard
              </button>
            )}
            {onOpenSupport && (
              <button type="button" onClick={onOpenSupport}>
                <LifeBuoy /> Contact support
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
