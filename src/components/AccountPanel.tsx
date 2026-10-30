import { type FormEvent, useEffect, useState } from 'react';
import { CreditCard, LifeBuoy, LoaderCircle, LogIn, LogOut, Mail, Palette, ShieldCheck, Sparkles, UserPlus, X } from 'lucide-react';
import { useAccount } from './AccountProvider';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { createDefaultBillingService, type BillingService } from '../lib/billing';
import { createDefaultSupportStaffService, type SupportStaffService } from '../lib/supportStaff';
import type { LegalPage } from './LegalPanel';
import { authErrorMessage } from '../lib/authErrors';
import { redeemInvite } from '../lib/invites';
import { useSiteSettings } from '../lib/siteSettings';
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
  onOpenLegal,
  billing: providedBilling,
  staffService: providedStaffService,
}: {
  onClose: () => void;
  /* Support is part of the account surface rather than a sixth destination. */
  onOpenSupport?: () => void;
  /* The owner's dashboard, offered only to staff. */
  onOpenAdmin?: () => void;
  /* Privacy and terms, so they are reachable on a phone too. */
  onOpenLegal?: (page: LegalPage) => void;
  /* Omit for the app's own billing client; pass null to run with no backend. */
  billing?: BillingService | null;
  /* Omit for the app's own check; pass null to run with no backend. */
  staffService?: SupportStaffService | null;
}) {
  const {
    account, entitlements, loading, error,
    confirmingMembership, confirmationTimedOut,
    linkEmail, sendSignInLink, canSignOut, signOut,
    canUsePassword, signIn, signUp, sendPasswordReset,
  } = useAccount();
  const billing = providedBilling === undefined ? getDefaultBilling() : providedBilling;
  const staffService = providedStaffService === undefined ? getDefaultStaffService() : providedStaffService;

  const [email, setEmail] = useState(account?.email ?? '');
  const [password, setPassword] = useState('');
  /*
   * A guest meets one identity action at a time: create an account, or sign
   * in. Both use the same two fields, so the mode only decides which button
   * the form offers.
   */
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  /* Separate from the identity actions: a checkout in flight must not be
     restartable by a second click while the first is still going. */
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [isStaff, setIsStaff] = useState(false);
  /* The invite-only toggle lives in the deployment's settings, so the form only
     asks for a code while the deployment is actually gated. */
  const { inviteGatingEnabled } = useSiteSettings();
  const [inviteCode, setInviteCode] = useState('');

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
      /* An action may have set its own message; '' leaves it standing. */
      if (done) setStatus(done);
    } catch (reason) {
      setActionError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  /*
   * While invite gating is on, every guest path that ends in a new email
   * account — password sign-up, email sign-in link, protecting this guest —
   * claims an invite first. The database refuses an unclaimed account anyway;
   * this gives the visitor the friendly error before the round trip.
   */
  const ensureInvite = async () => {
    if (!isGuest || !inviteGatingEnabled) return;
    if (!inviteCode.trim()) {
      throw new Error('This site is invite-only right now — enter your invite code first.');
    }
    await redeemInvite(inviteCode, email);
  };

  const protectAccount = () => {
    void run(async () => {
      await ensureInvite();
      await linkEmail(email);
    }, 'Check your email to finish protecting this account.');
  };

  /*
   * Password sign-up and sign-in share one form: the same two fields, and one
   * button whose label says which of the two is about to happen. A returning
   * member arriving in a fresh browser is a guest here, so a panel that only
   * ever offered "Create account" had no way back in.
   */
  const applyPassword = () => {
    if (!canUsePassword) return;
    if (mode === 'signin') {
      void run(() => signIn(email, password), 'Signed in.');
      return;
    }
    void run(async () => {
      await ensureInvite();
      const result = await signUp(email, password);
      setStatus(result === 'confirm_email'
        ? 'Check your email to confirm the account, then sign in.'
        : 'Account created. You are signed in.');
    }, '');
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

        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            /* Enter follows whichever identity action the form presents. */
            if (isGuest && canUsePassword) applyPassword();
            else protectAccount();
          }}
        >
          <p>
            {isGuest
              ? 'Create an account or sign in with your email and password. Your rooms, hosting and history follow you across devices.'
              : 'Need to sign in somewhere else? Send yourself a link, or switch account with your password.'}
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
          {isGuest && inviteGatingEnabled && (
            <label>
              Invite code
              <input
                aria-label="Invite code"
                value={inviteCode}
                onChange={(event) => { setInviteCode(event.target.value); setStatus(''); setActionError(''); }}
                placeholder="From whoever invited you"
              />
            </label>
          )}
          {canUsePassword && (
            <>
              <label>
                Password
                <input
                  type="password"
                  aria-label="Account password"
                  value={password}
                  minLength={8}
                  autoComplete={isGuest && mode === 'create' ? 'new-password' : 'current-password'}
                  onChange={(event) => { setPassword(event.target.value); setStatus(''); setActionError(''); }}
                  placeholder="At least 8 characters"
                />
              </label>
              <div className="account-panel__actions">
                {isGuest ? (
                  <button
                    type="button"
                    disabled={busy || !email.trim() || password.length < 8}
                    onClick={applyPassword}
                  >
                    {mode === 'create' ? <><UserPlus /> Create account</> : <><LogIn /> Sign in</>}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || !email.trim() || password.length < 8}
                    onClick={() => void run(() => signIn(email, password), 'Signed in.')}
                  >
                    <LogIn /> Sign in
                  </button>
                )}
                {(!isGuest || mode === 'signin') && (
                  <button
                    type="button"
                    disabled={busy || !email.trim()}
                    onClick={() => void run(
                      () => sendPasswordReset(email),
                      'Password reset link sent. Open it on this device.',
                    )}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              {isGuest && (
                <button
                  type="button"
                  className="account-panel__switch"
                  onClick={() => {
                    setMode(mode === 'create' ? 'signin' : 'create');
                    setStatus('');
                    setActionError('');
                  }}
                >
                  {mode === 'create'
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account'}
                </button>
              )}
            </>
          )}
          <div className="account-panel__actions">
            {isGuest && (
              /* Attaches the email to the anonymous account this browser is
                 already using, so its rooms and history come along. */
              <button type="button" disabled={busy || !email.trim()} onClick={protectAccount}>
                <ShieldCheck /> Protect guest account
              </button>
            )}
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void run(async () => {
                await ensureInvite();
                await sendSignInLink(email);
              }, 'Sign-in link sent. Open it on this device.')}
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
                    .catch((reason: unknown) => setActionError(authErrorMessage(reason)))
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

        {(onOpenSupport || (onOpenAdmin && isStaff) || onOpenLegal) && (
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
            {onOpenLegal && (
              <>
                <button type="button" onClick={() => onOpenLegal('privacy')}>Privacy</button>
                <button type="button" onClick={() => onOpenLegal('terms')}>Terms</button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
