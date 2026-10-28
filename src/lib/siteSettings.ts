import { useEffect, useState } from 'react';
import { AD_PLACEMENTS, type AdPlacementId } from './ads';
import { site } from '../config/site';
import { getSupabaseClient } from './supabaseClient';

/*
 * The instance's own branding, read from the deployment's database rather than
 * from the build.
 *
 * Build-time env still supplies the first-run defaults (that is what a fork
 * builds with), but once an owner opens the admin dashboard the database wins:
 * name, tagline, accent colours, logo and ad network all change without a
 * rebuild or a code editor. Everyone can read the row - it renders the page -
 * and only staff can write it, enforced by RLS.
 */

export interface SiteSettings {
  name: string;
  tagline: string;
  accentColor: string;
  accentColor2: string;
  logoUrl: string;
  ads: {
    scriptUrl: string;
    zones: Partial<Record<AdPlacementId, string>>;
    maxPerSession: number | null;
  };
}

const PLACEMENT_IDS = Object.keys(AD_PLACEMENTS) as AdPlacementId[];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ZONE = /^[A-Za-z0-9_-]{1,64}$/;
const HTTPS = /^https:\/\//i;

export function defaultSiteSettings(): SiteSettings {
  return {
    name: site.name,
    tagline: site.description,
    accentColor: '#7b16ff',
    accentColor2: '#9f37ff',
    logoUrl: '',
    ads: { scriptUrl: '', zones: {}, maxPerSession: null },
  };
}

interface SettingsRow {
  site_name?: unknown; tagline?: unknown; accent_color?: unknown; accent_color_2?: unknown;
  logo_url?: unknown; ads_script_url?: unknown; ads_zones?: unknown; ads_max_per_session?: unknown;
}

function textOr(value: unknown, max: number, fallback: string): string {
  const next = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return next || fallback;
}

function colourOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback;
}

function httpsOrBlank(value: unknown): string {
  return typeof value === 'string' && HTTPS.test(value.trim()) ? value.trim() : '';
}

export function rowToSiteSettings(
  row: SettingsRow | null | undefined,
  fallback: SiteSettings = defaultSiteSettings(),
): SiteSettings {
  if (!row || typeof row !== 'object') return fallback;

  const zones: Partial<Record<AdPlacementId, string>> = {};
  if (row.ads_zones && typeof row.ads_zones === 'object' && !Array.isArray(row.ads_zones)) {
    for (const id of PLACEMENT_IDS) {
      const value = (row.ads_zones as Record<string, unknown>)[id];
      if (typeof value === 'string' && ZONE.test(value)) zones[id] = value;
    }
  }

  const max = row.ads_max_per_session;

  return {
    name: textOr(row.site_name, 60, fallback.name),
    tagline: textOr(row.tagline, 140, fallback.tagline),
    accentColor: colourOr(row.accent_color, fallback.accentColor),
    accentColor2: colourOr(row.accent_color_2, fallback.accentColor2),
    logoUrl: httpsOrBlank(row.logo_url),
    ads: {
      scriptUrl: httpsOrBlank(row.ads_script_url),
      zones,
      maxPerSession: typeof max === 'number' && Number.isFinite(max) && max >= 0 && max <= 100
        ? Math.trunc(max)
        : null,
    },
  };
}

/* What the save button refuses, before a round trip. The database re-checks. */
export function validateSiteSettings(next: SiteSettings): string {
  if (!next.name.trim()) return 'The site needs a name.';
  if (next.name.trim().length > 60) return 'Keep the site name under 60 characters.';
  if (next.tagline.length > 140) return 'Keep the tagline under 140 characters.';
  if (!HEX.test(next.accentColor) || !HEX.test(next.accentColor2)) return 'Colours must be six-digit hex, like #7b16ff.';
  if (next.logoUrl && !HTTPS.test(next.logoUrl)) return 'The logo URL must start with https://.';
  if (next.ads.scriptUrl && !HTTPS.test(next.ads.scriptUrl)) return 'The ad script URL must start with https://.';
  return '';
}

/* --- one live value, so the header and the dashboard agree ----------------- */

let current: SiteSettings = defaultSiteSettings();
const listeners = new Set<() => void>();

export function getSiteSettings(): SiteSettings {
  return current;
}

export function subscribeSiteSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/* Applies what the CSS and the document title read. */
export function applySiteSettings(next: SiteSettings): void {
  current = next;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--violet', next.accentColor);
    root.style.setProperty('--purple', next.accentColor2);
    document.title = `${next.name} - Find your next watch`;
  }
  for (const listener of listeners) listener();
}

export function useSiteSettings(): SiteSettings {
  const [value, setValue] = useState(current);
  useEffect(() => {
    setValue(current);
    return subscribeSiteSettings(() => setValue(current));
  }, []);
  return value;
}

/* Boot: ask the deployment for its settings and apply whatever comes back. */
export function useLoadSiteSettings(): void {
  useEffect(() => {
    let active = true;
    void loadSiteSettings().then((next) => { if (active) applySiteSettings(next); });
    return () => { active = false; };
  }, []);
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  const client = getSupabaseClient();
  if (!client) return defaultSiteSettings();
  try {
    const { data, error } = await client.from('site_settings').select('*').eq('id', 'default').maybeSingle();
    if (error || !data) return defaultSiteSettings();
    return rowToSiteSettings(data as SettingsRow);
  } catch {
    return defaultSiteSettings();
  }
}

export async function saveSiteSettings(next: SiteSettings): Promise<SiteSettings> {
  const problem = validateSiteSettings(next);
  if (problem) throw new Error(problem);

  const client = getSupabaseClient();
  if (!client) throw new Error('Settings need the deployment’s backend.');

  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('Sign in as an admin first.');

  const { error } = await client.from('site_settings').upsert({
    id: 'default',
    site_name: next.name.trim(),
    tagline: next.tagline.trim(),
    accent_color: next.accentColor,
    accent_color_2: next.accentColor2,
    logo_url: next.logoUrl || null,
    ads_script_url: next.ads.scriptUrl || null,
    ads_zones: next.ads.zones,
    ads_max_per_session: next.ads.maxPerSession,
    updated_at: new Date().toISOString(),
    updated_by: data.session.user.id,
  }, { onConflict: 'id' });

  if (error) throw new Error(error.message);
  applySiteSettings(next);
  return next;
}
