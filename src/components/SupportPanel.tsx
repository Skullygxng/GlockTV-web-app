import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, LifeBuoy, LoaderCircle, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import { useAccount } from './AccountProvider';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import {
  BODY_MAX,
  SUBJECT_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUS_LABELS,
  createDefaultSupportService,
  validateTicketDraft,
  type SupportCategory,
  type SupportMessage,
  type SupportService,
  type SupportTicket,
} from '../lib/support';
import { createDefaultSupportStaffService, type SupportStaffService } from '../lib/supportStaff';
import { SupportInbox } from './SupportInbox';
import '../support.css';
import { site } from '../config/site';

/*
 * Support, from the customer's side.
 *
 * The staff console is a separate surface with a different threat model, so it
 * lives in its own component and its own service: this panel only asks the
 * database whether the caller is staff, and offers the way in if it is. What
 * this panel cannot do is worth reading as part of the design: it never sends a
 * status, never sends an author role, and offers no path to either.
 */
let defaultService: SupportService | null | undefined;
function getDefaultService(): SupportService | null {
  if (defaultService === undefined) defaultService = createDefaultSupportService();
  return defaultService;
}

let defaultStaffService: SupportStaffService | null | undefined;
function getDefaultStaffService(): SupportStaffService | null {
  if (defaultStaffService === undefined) defaultStaffService = createDefaultSupportStaffService();
  return defaultStaffService;
}

export function SupportPanel({
  onClose,
  service: providedService,
  staffService: providedStaffService,
}: {
  onClose: () => void;
  /* Omit for the app's own service; pass null to run with no backend. */
  service?: SupportService | null;
  /* The console's service. Only used to answer "is this caller staff?". */
  staffService?: SupportStaffService | null;
}) {
  const { account } = useAccount();
  const service = providedService === undefined ? getDefaultService() : providedService;
  const staffService = providedStaffService === undefined ? getDefaultStaffService() : providedStaffService;
  const dialog = useDialogBehavior<HTMLElement>({ onClose });

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(service));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);

  const [category, setCategory] = useState<SupportCategory>('account');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');

  /*
   * A ticket needs somebody who can be reached and who can come back to it. An
   * anonymous session that clears its storage loses the ticket and every reply
   * on it, so this is a precondition rather than a nudge - and the insert
   * policy refuses it too, because this is not where it is decided.
   */
  const isGuest = !account || account.isAnonymous;

  const refresh = useCallback(async () => {
    if (!service) { setLoading(false); return; }
    setLoading(true);
    const result = await service.listTickets();
    setTickets(result.tickets);
    setError(result.error);
    setLoading(false);
  }, [service]);

  useEffect(() => { void refresh(); }, [refresh]);

  /*
   * Is this caller staff? Asked of the database about this user alone, so the
   * button is a convenience, not the boundary - the console's queries and the
   * reply trigger are refused for anybody is_support_staff() does not know.
   */
  useEffect(() => {
    if (!staffService) { setIsStaff(false); return; }
    let active = true;
    void staffService.isStaff().then((value) => { if (active) setIsStaff(value); });
    return () => { active = false; };
  }, [staffService]);

  useEffect(() => {
    if (!service || !openTicket) { setMessages([]); return; }
    let cancelled = false;
    void service.listMessages(openTicket.id).then((result) => {
      if (cancelled) return;
      setMessages(result.messages);
      if (result.error) setError(result.error);
    });
    return () => { cancelled = true; };
  }, [service, openTicket]);

  const draftError = useMemo(() => validateTicketDraft({ subject, body }), [subject, body]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || busy || draftError) return;
    setBusy(true); setError('');
    try {
      const ticket = await service.createTicket({ category, subject, body });
      setSubject(''); setBody('');
      setTickets((current) => [ticket, ...current]);
      setOpenTicket(ticket);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That ticket could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || busy || !openTicket || !reply.trim()) return;
    setBusy(true); setError('');
    try {
      const message = await service.reply(openTicket.id, reply);
      setMessages((current) => [...current, message]);
      setReply('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That reply could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  /* The console replaces the customer panel rather than stacking on top of it:
     two dialogs in the same overlay would fight over focus. */
  if (inboxOpen) {
    return <SupportInbox onClose={() => setInboxOpen(false)} service={staffService} />;
  }

  return (
    <div className="overlay overlay--right">
      <section ref={dialog} className="support-panel" role="dialog" aria-label={`${site.name} support`} aria-modal="true">
        <header>
          <div><LifeBuoy /><h2>Support</h2></div>
          {isStaff && (
            <button type="button" aria-label="Open support inbox" onClick={() => setInboxOpen(true)}>
              <Inbox />
            </button>
          )}
          <button type="button" aria-label="Close support" onClick={onClose}><X /></button>
        </header>

        {!service && (
          <p className="support-panel__note" role="status">
            Support is unavailable in this build.
          </p>
        )}

        {service && isGuest && (
          <p className="support-panel__note" role="status">
            <ShieldCheck /> Add an email to your account first. A ticket needs somewhere
            to send the reply, and a guest session that clears its storage would lose
            the conversation.
          </p>
        )}

        {error && <p className="support-panel__error" role="alert">{error}</p>}

        {service && !isGuest && !openTicket && (
          <>
            <form className="support-form" onSubmit={submit}>
              <label>
                What is this about?
                <select
                  aria-label="Ticket category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as SupportCategory)}
                >
                  {SUPPORT_CATEGORIES.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <input
                  aria-label="Ticket subject"
                  value={subject}
                  maxLength={SUBJECT_MAX}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Premium did not activate after checkout"
                />
              </label>
              <label>
                What happened?
                <textarea
                  aria-label="Ticket message"
                  value={body}
                  maxLength={BODY_MAX}
                  rows={5}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Include what you were doing, what you expected, and what happened instead."
                />
              </label>
              <button type="submit" disabled={busy || Boolean(draftError)}>
                {busy ? <LoaderCircle className="spin" /> : <Send />} Open ticket
              </button>
              {draftError && subject + body ? <small className="support-panel__hint">{draftError}</small> : null}
            </form>

            <section className="support-list" aria-label="Your tickets">
              <h3>Your tickets</h3>
              {loading && <p className="support-panel__note"><LoaderCircle className="spin" /> Loading…</p>}
              {!loading && !tickets.length && (
                <p className="support-panel__note">Nothing open. Anything you send appears here with its replies.</p>
              )}
              {tickets.map((ticket) => (
                <button type="button" key={ticket.id} className="support-list__item" onClick={() => setOpenTicket(ticket)}>
                  <span>
                    <strong>{ticket.subject}</strong>
                    <small>{SUPPORT_CATEGORIES.find((entry) => entry.value === ticket.category)?.label}</small>
                  </span>
                  <i className={`support-status support-status--${ticket.status}`}>
                    {SUPPORT_STATUS_LABELS[ticket.status]}
                  </i>
                </button>
              ))}
            </section>
          </>
        )}

        {service && openTicket && (
          <section className="support-thread" aria-label={`Ticket: ${openTicket.subject}`}>
            <header className="support-thread__header">
              <button type="button" onClick={() => setOpenTicket(null)}>Back to tickets</button>
              <i className={`support-status support-status--${openTicket.status}`}>
                {SUPPORT_STATUS_LABELS[openTicket.status]}
              </i>
            </header>
            <h3>{openTicket.subject}</h3>

            <div className="support-thread__messages">
              {!messages.length && <p className="support-panel__note"><MessageSquare /> No messages yet.</p>}
              {messages.map((message) => (
                <article key={message.id} className={`support-message support-message--${message.authorRole}`}>
                  <header>
                    {/* Said by the database, not chosen here. */}
                    <strong>{message.authorRole === 'staff' ? `${site.name} Support` : 'You'}</strong>
                  </header>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>

            <form className="support-reply" onSubmit={sendReply}>
              <label className="sr-only" htmlFor="support-reply-body">Reply</label>
              <textarea
                id="support-reply-body"
                aria-label="Reply"
                value={reply}
                maxLength={BODY_MAX}
                rows={3}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Add anything else that might help."
              />
              <button type="submit" disabled={busy || !reply.trim()}>
                {busy ? <LoaderCircle className="spin" /> : <Send />} Send
              </button>
            </form>
          </section>
        )}
      </section>
    </div>
  );
}
