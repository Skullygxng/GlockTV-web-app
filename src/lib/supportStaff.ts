import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, type SupabaseConfig } from './supabaseClient';
import {
  BODY_MAX,
  rowToMessage,
  rowToTicket,
  type SupportMessage,
  type SupportTicket,
} from './support';

/*
 * The staff side of support.
 *
 * Deliberately a separate service from `support.ts`: the customer surface must
 * keep exactly its four methods (no status, no role, no privilege), and the one
 * thing that tells the two sides apart - `is_support_staff()` - is answered by
 * the database about the caller alone. Nothing here can grant staff, widen a
 * policy or set a ticket's status; every one of those is decided in SQL.
 */

export interface SupportStaffService {
  /* False for anybody who is not in staff_members, including signed-out. */
  isStaff(): Promise<boolean>;
  listTickets(): Promise<{ tickets: SupportTicket[]; error: string }>;
  listMessages(ticketId: string): Promise<{ messages: SupportMessage[]; error: string }>;
  /* author_role is derived by the database from staff membership. */
  reply(ticketId: string, body: string): Promise<SupportMessage>;
}

const TICKETS = 'support_tickets';
const MESSAGES = 'support_messages';
/* Staff triage the whole queue, not one customer's history. */
const STAFF_TICKET_LIMIT = 200;

export function createSupportStaffService(client: SupabaseClient): SupportStaffService {
  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  return {
    async isStaff() {
      try {
        if (!(await currentUserId())) return false;
        const { data, error } = await client.rpc('is_support_staff');
        if (error) return false;
        return data === true;
      } catch {
        return false;
      }
    },

    async listTickets() {
      try {
        if (!(await currentUserId())) return { tickets: [], error: '' };
        /*
         * No owner filter: RLS already returns every ticket to a staff caller
         * and only the caller's own to anyone else, so this query cannot widen
         * what a non-staff account sees.
         */
        const { data, error } = await client
          .from(TICKETS)
          .select('id, category, subject, status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(STAFF_TICKET_LIMIT);
        if (error) return { tickets: [], error: error.message };
        return {
          tickets: (data ?? [])
            .map((row) => rowToTicket(row as Parameters<typeof rowToTicket>[0]))
            .filter((ticket): ticket is SupportTicket => ticket !== null),
          error: '',
        };
      } catch (reason) {
        return {
          tickets: [],
          error: reason instanceof Error ? reason.message : 'The inbox could not be loaded.',
        };
      }
    },

    async listMessages(ticketId: string) {
      try {
        const { data, error } = await client
          .from(MESSAGES)
          .select('id, ticket_id, author_role, body, created_at')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true })
          .limit(200);
        if (error) return { messages: [], error: error.message };
        return {
          messages: (data ?? [])
            .map((row) => rowToMessage(row as Parameters<typeof rowToMessage>[0]))
            .filter((message): message is SupportMessage => message !== null),
          error: '',
        };
      } catch (reason) {
        return {
          messages: [],
          error: reason instanceof Error ? reason.message : 'That conversation could not be loaded.',
        };
      }
    },

    async reply(ticketId: string, body: string) {
      const trimmed = body.trim().slice(0, BODY_MAX);
      if (!trimmed) throw new Error('Write a reply first.');
      const userId = await currentUserId();
      if (!userId) throw new Error('Sign in to reply.');

      const { data, error } = await client
        .from(MESSAGES)
        .insert({ ticket_id: ticketId, author_id: userId, body: trimmed })
        .select('id, ticket_id, author_role, body, created_at')
        .single();
      if (error) throw new Error(error.message);

      const message = rowToMessage(data as Parameters<typeof rowToMessage>[0]);
      if (!message) throw new Error('That reply could not be sent.');
      return message;
    },
  };
}

export function createDefaultSupportStaffService(config: SupabaseConfig = {}): SupportStaffService | null {
  const client = getSupabaseClient(config);
  return client ? createSupportStaffService(client) : null;
}
