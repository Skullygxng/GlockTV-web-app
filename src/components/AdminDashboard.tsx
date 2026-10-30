import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Copy, LoaderCircle, Palette, Palette as PaletteIcon, Save, ShieldCheck, Ticket, Trash2, UserPlus, X } from 'lucide-react';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { AD_PLACEMENTS, type AdPlacementId } from '../lib/ads';
import { defaultSiteSettings, loadSiteSettings, saveSiteSettings, type SiteSettings } from '../lib/siteSettings';
import { createInvites, disableInvite, listInvites, type InviteRow } from '../lib/invites';
import { getSupabaseClient } from '../lib/supabaseClient';
import { site } from '../config/site';

/*
 * The owner's dashboard.
 *
 * Everything here is written to this deployment's own database, so a buyer can
 * rename, recolour, re-logo and connect an ad network without touching code or
 * waiting for a redeploy. The panel is a form; the authority is the database -
 * only staff may write site_settings, and only an admin may add or remove staff.
 */

interface StaffRow {
  userId: string;
  email: string;
  role: string;
}

const PLACEMENT_IDS = Object.keys(AD_PLACEMENTS) as AdPlacementId[];

const PLACEMENT_LABELS: Record<AdPlacementId, string> = {
  'context-rail': 'Right-hand rail (desktop)',
  'sidebar-bottom': 'Under the sidebar (desktop)',
  'in-feed': 'Between feed cards',
  'details-panel': 'Title details panel',
};

export function AdminDashboard({ onClose }: { onClose: () => void }) {
  const dialog = useDialogBehavior<HTMLElement>({ onClose });

  const [settings, setSettings] = useState(defaultSiteSettings());
  const [loading, setLoading] = useState(true);
  const [busy, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<'agent' | 'admin'>('admin');
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamNote, setTeamError] = useState('');

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteCount, setInviteCount] = useState(5);
  const [inviteUses, setInviteUses] = useState(1);
  const [inviteDays, setInviteDays] = useState('');
  const [invitesBusy, setInvitesBusy] = useState(false);
  const [invitesNote, setInvitesNote] = useState('');

  const client = getSupabaseClient();

  const loadStaff = useCallback(async () => {
    if (!client) return;
    try {
      const { data, error: listError } = await client.rpc('list_staff');
      if (listError) return;
      setStaff((Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
        userId: String(row.user_id ?? ''),
        email: String(row.email ?? ''),
        role: String(row.role ?? 'agent'),
      })).filter((row) => row.email));
    } catch {
      /* A non-staff caller is refused by the function; the panel simply shows none. */
    }
  }, [client]);

  const loadInvites = useCallback(async () => {
    if (!client) return;
    try {
      setInvites(await listInvites(client));
    } catch {
      /* The function refuses non-admins; the panel simply shows none. */
      setInvites([]);
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    void loadSiteSettings().then((next) => {
      if (!active) return;
      setSettings(next);
      setLoading(false);
    });
    void loadStaff();
    void loadInvites();
    return () => { active = false; };
  }, [loadStaff, loadInvites]);

  const update = (patch: Partial<SiteSettings>) => { setSettings((current) => ({ ...current, ...patch })); setStatus(''); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true); setError(''); setStatus('');
    try {
      await saveSiteSettings(settings);
      setStatus('Saved. Every visitor sees this now.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const addStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!client || teamBusy || !staffEmail.trim()) return;
    setTeamBusy(true); setTeamError('');
    try {
      const { error: addError } = await client.rpc('add_staff', {
        member_email: staffEmail.trim(),
        member_role: staffRole,
      });
      if (addError) throw new Error(addError.message);
      setStaffEmail('');
      setTeamError('Added. They are staff as soon as they reload.');
      await loadStaff();
    } catch (reason) {
      setTeamError(reason instanceof Error ? reason.message : 'That did not work.');
    } finally {
      setTeamBusy(false);
    }
  };

  const removeStaff = async (email: string) => {
    if (!client || teamBusy) return;
    setTeamBusy(true); setTeamError('');
    try {
      const { error: removeError } = await client.rpc('remove_staff', { member_email: email });
      if (removeError) throw new Error(removeError.message);
      setTeamError('Removed.');
      await loadStaff();
    } catch (reason) {
      setTeamError(reason instanceof Error ? reason.message : 'That did not work.');
    } finally {
      setTeamBusy(false);
    }
  };

  /* Issues codes in a batch, then refreshes the list so the panel shows them
     immediately — the codes are only visible here once, so the note repeats
     them for copying before the browser is closed. */
  const issueInvites = async () => {
    if (!client || invitesBusy) return;
    setInvitesBusy(true); setInvitesNote('');
    try {
      const codes = await createInvites(client, {
        count: inviteCount,
        maxUses: inviteUses,
        expiresInDays: inviteDays ? Number(inviteDays) : null,
      });
      await loadInvites();
      setInvitesNote(`Issued ${codes.length} code${codes.length === 1 ? '' : 's'} — copy them now: ${codes.join(', ')}`);
    } catch (reason) {
      setInvitesNote(reason instanceof Error ? reason.message : 'That did not work.');
    } finally {
      setInvitesBusy(false);
    }
  };

  const retireInvite = async (code: string) => {
    if (!client || invitesBusy) return;
    setInvitesBusy(true); setInvitesNote('');
    try {
      await disableInvite(client, code);
      await loadInvites();
      setInvitesNote('That code is retired — nobody can use it now.');
    } catch (reason) {
      setInvitesNote(reason instanceof Error ? reason.message : 'That did not work.');
    } finally {
      setInvitesBusy(false);
    }
  };

  return (
    <div className="overlay overlay--right">
      <section ref={dialog} className="support-panel admin-panel" role="dialog" aria-modal="true" aria-label={`${site.name} admin`}> 
        <header>
          <div><Palette /><h2>Admin dashboard</h2></div>
          <button type="button" aria-label="Close admin dashboard" onClick={onClose}><X /></button>
        </header>

        {!client && (
          <p className="support-panel__note" role="status">
            This build has no backend connected, so there is nothing to edit yet.
          </p>
        )}

        {error && <p className="support-panel__error" role="alert">{error}</p>}
        {status && <p className="support-panel__note" role="status">{status}</p>}

        {loading ? (
          <p className="support-panel__note"><LoaderCircle className="spin" /> Loading settings…</p>
        ) : (
          <>
            <form className="admin-form" onSubmit={save}>
              <fieldset>
                <legend><PaletteIcon /> Branding</legend>

                <label>
                  Site name
                  <input
                    aria-label="Site name"
                    value={settings.name}
                    maxLength={60}
                    onChange={(event) => update({ name: event.target.value })}
                    placeholder={site.name}
                  />
                </label>

                <label>
                  Tagline
                  <input
                    aria-label="Tagline"
                    value={settings.tagline}
                    maxLength={140}
                    onChange={(event) => update({ tagline: event.target.value })}
                    placeholder="Find your next watch"
                  />
                </label>

                <div className="admin-colours">
                  <label>
                    Accent colour
                    <input
                      aria-label="Accent colour"
                      type="color"
                      value={settings.accentColor}
                      onChange={(event) => update({ accentColor: event.target.value })}
                    />
                  </label>
                  <label>
                    Second accent
                    <input
                      aria-label="Second accent colour"
                      type="color"
                      value={settings.accentColor2}
                      onChange={(event) => update({ accentColor2: event.target.value })}
                    />
                  </label>
                </div>

                <label>
                  Logo image URL
                  <input
                    aria-label="Logo image URL"
                    value={settings.logoUrl}
                    onChange={(event) => update({ logoUrl: event.target.value })}
                    placeholder="https://example.com/logo.png (blank keeps the bundled mark)"
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend><ShieldCheck /> Ads</legend>

                <label>
                  Network script URL
                  <input
                    aria-label="Ad script URL"
                    value={settings.ads.scriptUrl}
                    onChange={(event) => update({ ads: { ...settings.ads, scriptUrl: event.target.value } })}
                    placeholder="https://your-network.example/ad.js (blank shows no ads at all)"
                  />
                </label>

                {PLACEMENT_IDS.map((placement) => (
                  <label key={placement}>
                    {PLACEMENT_LABELS[placement]} zone
                    <input
                      aria-label={`${PLACEMENT_LABELS[placement]} zone`}
                      value={settings.ads.zones[placement] ?? ''}
                      onChange={(event) => update({
                        ads: {
                          ...settings.ads,
                          zones: { ...settings.ads.zones, [placement]: event.target.value.trim() },
                        },
                      })}
                      placeholder="Zone id from your dashboard (optional)"
                    />
                  </label>
                ))}

                <label>
                  Ad frames per visit
                  <input
                    aria-label="Ad frames per visit"
                    type="number"
                    min={0}
                    max={100}
                    value={settings.ads.maxPerSession ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      const parsed = Number(raw);
                      update({
                        ads: {
                          ...settings.ads,
                          maxPerSession: raw && Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.trunc(parsed))) : null,
                        },
                      });
                    }}
                    placeholder="Blank = uncapped"
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend><Ticket /> Invite-only sign-ups</legend>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    aria-label="Invite-only sign-ups"
                    checked={settings.inviteGatingEnabled}
                    onChange={(event) => update({ inviteGatingEnabled: event.target.checked })}
                  />
                  <span>
                    New accounts need an invite code you issue here. Guests can still browse and watch
                    without an account, and existing accounts are never touched. Turn this on after your
                    own account exists, and issue codes for anyone you want to let in — including staff.
                  </span>
                </label>
              </fieldset>

              <button type="submit" className="admin-save" disabled={busy}>
                {busy ? <LoaderCircle className="spin" /> : <Save />} Save changes
              </button>
            </form>

            <section className="admin-team" aria-label="Team">
              <h3><ShieldCheck /> Team</h3>
              {teamNote && <p className="support-panel__note" role="status">{teamNote}</p>}

              <ul>
                {staff.map((person) => (
                  <li key={person.userId}>
                    <span>
                      <strong>{person.email}</strong>
                      <small>{person.role}</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${person.email}`}
                      disabled={teamBusy}
                      onClick={() => void removeStaff(person.email)}
                    >
                      <Trash2 />
                    </button>
                  </li>
                ))}
                {!staff.length && <li><span><small>No staff listed yet.</small></span></li>}
              </ul>

              <form className="admin-team__add" onSubmit={addStaff}>
                <label>
                  Add by email
                  <input
                    aria-label="Staff email"
                    type="email"
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                    placeholder="they must have signed in once"
                  />
                </label>
                <label>
                  Role
                  <select
                    aria-label="Staff role"
                    value={staffRole}
                    onChange={(event) => setStaffRole(event.target.value === 'admin' ? 'admin' : 'agent')}
                  >
                    <option value="admin">Admin</option>
                    <option value="agent">Agent (support only)</option>
                  </select>
                </label>
                <button type="submit" disabled={teamBusy || !staffEmail.trim()}>
                  {teamBusy ? <LoaderCircle className="spin" /> : <UserPlus />} Add
                </button>
              </form>
            </section>

            <section className="admin-team" aria-label="Invite codes">
              <h3><Ticket /> Invite codes</h3>
              {invitesNote && <p className="support-panel__note" role="status">{invitesNote}</p>}

              <ul>
                {invites.map((invite) => (
                  <li key={invite.code}>
                    <span>
                      <strong className="invite-code">{invite.code}</strong>
                      <small>
                        {invite.useCount}/{invite.maxUses} claimed
                        {invite.expiresAt ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}
                        {invite.disabled ? ' · retired' : ''}
                      </small>
                    </span>
                    <div className="admin-invite-actions">
                      <button
                        type="button"
                        aria-label={`Copy invite code ${invite.code}`}
                        onClick={() => {
                          void navigator.clipboard.writeText(invite.code).then(
                            () => setInvitesNote('Copied.'),
                            () => setInvitesNote(`Copy it by hand: ${invite.code}`),
                          );
                        }}
                      >
                        <Copy />
                      </button>
                      {!invite.disabled && (
                        <button
                          type="button"
                          aria-label={`Retire ${invite.code}`}
                          disabled={invitesBusy}
                          onClick={() => void retireInvite(invite.code)}
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {!invites.length && <li><span><small>No invite codes yet. Issue some, then turn invite-only on.</small></span></li>}
              </ul>

              <form className="admin-team__add" onSubmit={(event) => { event.preventDefault(); void issueInvites(); }}>
                <label>
                  How many
                  <input
                    aria-label="How many invite codes"
                    type="number"
                    min={1}
                    max={50}
                    value={inviteCount}
                    onChange={(event) => setInviteCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
                  />
                </label>
                <label>
                  Uses per code
                  <input
                    aria-label="Uses per invite code"
                    type="number"
                    min={1}
                    max={1000}
                    value={inviteUses}
                    onChange={(event) => setInviteUses(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
                  />
                </label>
                <label>
                  Expires in days
                  <input
                    aria-label="Invite expiry in days"
                    type="number"
                    min={1}
                    value={inviteDays}
                    onChange={(event) => setInviteDays(event.target.value)}
                    placeholder="Blank = never"
                  />
                </label>
                <button type="submit" disabled={invitesBusy}>
                  {invitesBusy ? <LoaderCircle className="spin" /> : <Ticket />} Issue codes
                </button>
              </form>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
