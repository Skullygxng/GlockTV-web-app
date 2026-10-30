import { getSupabaseClient } from './supabaseClient';

/*
 * Admin-issued invite codes, backed by the invite_codes / invite_claims tables
 * and their RPCs. All enforcement is server-side — auth.users triggers plus
 * security definer functions — so this lib is a control panel and a form field,
 * never the security boundary. Gating off makes redeemInvite a quiet no-op;
 * the caller cannot tell the difference and does not need to.
 */

export interface InviteRow {
  code: string;
  label: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
}

function clientOr(provided?: ReturnType<typeof getSupabaseClient>) {
  const client = provided ?? getSupabaseClient();
  if (!client) throw new Error('This needs the deployment’s backend.');
  return client;
}

export async function listInvites(client?: ReturnType<typeof getSupabaseClient>): Promise<InviteRow[]> {
  const db = clientOr(client);
  const { data, error } = await db.rpc('list_invites');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    code: String(row.code ?? ''),
    label: String(row.label ?? ''),
    maxUses: Number(row.max_uses ?? 1),
    useCount: Number(row.use_count ?? 0),
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : null,
    disabled: row.disabled === true,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  }));
}

export async function createInvites(
  client: ReturnType<typeof getSupabaseClient>,
  options: { count: number; maxUses: number; expiresInDays: number | null },
): Promise<string[]> {
  const db = clientOr(client);
  const days = options.expiresInDays;
  const expiresAt = days && Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86_400_000).toISOString()
    : null;
  const { data, error } = await db.rpc('create_invite_codes', {
    p_count: options.count,
    p_max_uses: options.maxUses,
    p_expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : [])
    .map((row: unknown) => String((row as { code?: string }).code ?? ''))
    .filter(Boolean);
}

export async function disableInvite(client: ReturnType<typeof getSupabaseClient>, code: string): Promise<void> {
  const db = clientOr(client);
  const { error } = await db.rpc('disable_invite', { p_code: code });
  if (error) throw new Error(error.message);
}

/*
 * Called by the sign-up form before it creates the account. Gating off = a
 * quiet no-op; gating on + bad code = a plain-text error the form can show.
 */
export async function redeemInvite(code: string, email: string, client?: ReturnType<typeof getSupabaseClient>): Promise<boolean> {
  const db = clientOr(client);
  const { data, error } = await db.rpc('redeem_invite', { p_code: code, p_email: email });
  if (error) throw new Error(error.message);
  return data === true;
}