import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { site } from '../config/site';
import { ShieldCheck, X } from 'lucide-react';

/*
 * The two pages a public service that collects email addresses and takes money
 * is expected to publish. The wording is a plain, factual starting point: it
 * describes what this code actually stores, so it is true on day one, but an
 * owner should have it reviewed before launch rather than treat it as legal
 * advice.
 */
export type LegalPage = 'privacy' | 'terms';

export function LegalPanel({ page, onClose }: { page: LegalPage; onClose: () => void }) {
  const dialog = useDialogBehavior<HTMLElement>({ onClose });

  return (
    <div className="overlay">
      <section
        ref={dialog}
        className="account-panel legal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={page === 'privacy' ? 'Privacy policy' : 'Terms of use'}
      >
        <header>
          <div>
            <ShieldCheck />
            <h2>{page === 'privacy' ? 'Privacy' : 'Terms of use'}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}><X /></button>
        </header>

        <p className="legal-panel__note">
          Template wording for this deployment. Review it before launch.
        </p>

        {page === 'privacy' ? <PrivacyBody /> : <TermsBody />}
      </section>
    </div>
  );
}

function PrivacyBody() {
  return (
    <>
      <h3>What this site stores</h3>
      <ul>
        <li>Your email address, when you create an account or sign in.</li>
        <li>The titles you save, like or skip, and how far you got in a player that reports a position.</li>
        <li>Watch-party rooms, the messages in them, and the display name you choose.</li>
        <li>Support messages you send.</li>
        <li>Whether your membership is active.</li>
      </ul>

      <h3>What it does not store</h3>
      <ul>
        <li>Card or bank details. Membership is paid in Bitcoin through a hosted payment provider, which handles the payment itself.</li>
        <li>Your contacts, photos or location.</li>
      </ul>

      <h3>Kept in your browser</h3>
      <ul>
        <li>A session, so you stay signed in between visits.</li>
        <li>Preferences such as the trailer sound setting and notices you dismissed.</li>
        <li>An anonymous guest identity, if you have not created an account.</li>
      </ul>

      <h3>Who else is involved</h3>
      <ul>
        <li>TMDB supplies film and TV data and artwork.</li>
        <li>The backend provider stores accounts, rooms, progress and tickets.</li>
        <li>Stream and event providers serve the players that playbacks load in.</li>
        <li>An advertising network, when this deployment has one configured. Ads run inside an isolated frame that cannot read this site's data.</li>
        <li>A payment provider, once you start a purchase.</li>
      </ul>

      <h3>Your choices</h3>
      <ul>
        <li>Sign out at any time from the account panel.</li>
        <li>Clear this browser's storage to remove what is kept on the device.</li>
        <li>Ask for your account and its data to be deleted by writing through {site.name}'s support desk in the account panel.</li>
      </ul>

      <h3>Children</h3>
      <p>{site.name} is not intended for children, and accounts should not be created for them.</p>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <h3>Using {site.name}</h3>
      <p>
        By using this site you accept these terms. If you do not, please do not use it.
      </p>

      <h3>The catalogue</h3>
      <p>
        Titles, artwork, schedules and streams come from third-party services. {site.name} does not
        host them and cannot guarantee that any particular title, channel or event is available, or
        that a stream will play.
      </p>

      <h3>Your account</h3>
      <ul>
        <li>Keep your password to yourself, and use one account per person.</li>
        <li>You are responsible for what happens under your account.</li>
        <li>We may close an account that breaks these terms.</li>
      </ul>

      <h3>Membership</h3>
      <ul>
        <li>Membership is paid in Bitcoin through a hosted payment provider and covers one period at a time.</li>
        <li>It does not renew by itself. When the period ends the account returns to the free, ad-supported tier.</li>
        <li>Access is unlocked by the provider's confirmed payment, not by the browser.</li>
      </ul>

      <h3>Acceptable use</h3>
      <ul>
        <li>Do not scrape, overload or probe the service, or try to bypass payment, the age of an ad frame or any other safeguard.</li>
        <li>Do not harass other people in rooms or in support.</li>
        <li>Do not redistribute streams or recordings.</li>
      </ul>

      <h3>Availability and liability</h3>
      <p>
        The service is provided as it is, without warranties. To the extent the law allows, {site.name}
        is not liable for interruptions, for what third-party players show, or for lost data.
      </p>

      <h3>Changes</h3>
      <p>These terms may be updated; continuing to use the site means accepting the current version.</p>
    </>
  );
}
