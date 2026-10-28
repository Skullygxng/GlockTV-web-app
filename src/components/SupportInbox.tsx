import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Inbox, LoaderCircle, MessageSquare, Send, X } from 'lucide-react';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import {
  BODY_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUS_LABELS,
  type SupportMessage,
  type SupportTicket,
} from '../lib/support';
import { createDefaultSupportStaffService, type SupportStaffService } from '../lib/supportStaff';
import '../support.css';
import { site } from '../config/site';

/*
 * The staff side of support: every ticket the caller is allowed to see, and a
 * reply box that says what it is. Nothing here can change a ticket's status or
 * choose who a message is from - the database derives the author from staff
 * membership and refuses status writes from the browser entirely.
 */

let defaultService: SupportStaffService | null | undefined;
function getDefaultService(): SupportStaffService | null {
  if (defaultService === undefined) defaultService = createDefaultSupportStaffService();
  return defaultService;
}

export function SupportInbox({
  onClose,
  service: providedService,
}: {
  onClose: () => void;
  /* Omit for the app's own service; pass null to run with no backend. */
  service?: SupportStaffService | null;
}) {
  const service = providedService === undefined ? getDefaultService() : providedService;
  const dialog = useDialogBehavior<HTMLElement>({ onClose });

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(service));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  const refresh = useCallback(async () => {
    if (!service) { setLoading(false); return; }
    setLoading(true);
    const result = await service.listTickets();
    setTickets(result.tickets);
    setError(result.error);
    setLoading(false);
  }, [service]);

  useEffect(() => { void refresh(); }, [refresh]);

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

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || busy || !openTicket || !reply.trim()) return;
    setBusy(true); setError('');
    try {
      const message = await service.reply(openTicket.id, reply);
      setMessages((current) => [...current, message]);
      setReply('');
      setTickets((current) => current.map((ticket) => (
        ticket.id === openTicket.id ? { ...ticket, updatedAt: new Date().toISOString() } : ticket
      )));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That reply could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay overlay--right">
      <section
        ref={dialog}
        className="support-panel support-inbox"
        role="dialog"
        aria-label={`${site.name} support inbox`}
        aria-modal="true"
      >
        <header>
          <div><Inbox /><h2>Support inbox</h2></div>
          <button type="button" aria-label="Close support inbox" onClick={onClose}><X /></button>
        </header>

        {!service && (
          <p className="support-panel__note" role="status">
            The inbox is unavailable in this build.
          </p>
        )}

        {error && <p className="support-panel__error" role="alert">{error}</p>}

        {service && !openTicket && (
          <section className="support-list" aria-label="All tickets">
            <div className="support-inbox__toolbar">
              <span>{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
              <button type="button" onClick={() => void refresh()} disabled={loading}>
                {loading ? <LoaderCircle className="spin" /> : null} Refresh
              </button>
            </div>
            {!loading && !tickets.length && (
              <p className="support-panel__note">Nothing in the queue.</p>
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
        )}

        {service && openTicket && (
          <section className="support-thread" aria-label={`Ticket: ${openTicket.subject}`}>
            <header className="support-thread__header">
              <button type="button" onClick={() => setOpenTicket(null)}>Back to inbox</button>
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
                    {/* Derived by the database from staff membership. */}
                    <strong>{message.authorRole === 'staff' ? `${site.name} Support` : 'Customer'}</strong>
                  </header>
                  <p>{message.body}</p>
                </article>
              ))}
            </div>

            <form className="support-reply" onSubmit={send}>
              <label className="sr-only" htmlFor="support-inbox-reply">Reply</label>
              <textarea
                id="support-inbox-reply"
                aria-label="Reply"
                value={reply}
                maxLength={BODY_MAX}
                rows={3}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Answer the customer. It is sent as staff."
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
