/*
 * The browser-safe instance configuration: what a deployment is called and
 * where it is served from.
 *
 * Pure on purpose - it takes an env record rather than reading
 * import.meta.env - so vite.config.ts can resolve the exact same values at
 * build time (base path, <title>, favicon) that the app reads at runtime.
 *
 * Every value is optional. With nothing set, the result is the master GlockTV
 * instance served from the root of whatever host it lands on. Values that are
 * set but malformed are an error, not a silent fallback: a typo in a base path
 * or site URL would otherwise ship a build whose assets or links 404.
 *
 * Nothing here is secret. Everything prefixed VITE_ is compiled into the
 * browser bundle; server-only values (Stripe keys, the service-role key, the
 * billing functions' SITE_URL) never belong in this file.
 */

export type EnvRecord = Record<string, string | boolean | undefined>;

export interface SiteConfig {
  /** Brand name used in copy, e.g. "GlockTV Premium". */
  name: string;
  /** The header logo text: the name in capitals. */
  wordmark: string;
  /** The document <title>. */
  title: string;
  /** The <meta name="description"> content. */
  description: string;
  /** Path the app is served under; always starts and ends with "/". */
  basePath: string;
  /** Canonical public URL, when known at build time; ends with "/". */
  siteUrl: string | null;
  /** Hostname of siteUrl, when set. */
  siteHost: string | null;
  /** Favicon href as written into index.html, and its MIME type ('' = let the browser sniff). */
  favicon: { href: string; type: string };
}

export const DEFAULT_SITE_NAME = 'GlockTV';
const DEFAULT_FAVICON = '/favicon.png';

export class SiteConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid site configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'SiteConfigError';
  }
}

function read(env: EnvRecord, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/*
 * "/", "" and undefined all mean the domain root. Anything else becomes
 * "/segment/.../" - the shape Vite's `base` and URL resolution both expect.
 */
export function normalizeBasePath(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!value || value === '/') return '/';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
    throw new SiteConfigError([`VITE_BASE_PATH must be a path such as /watch/, not a URL (got "${value}")`]);
  }
  if (/[?#\\\s]/.test(value)) {
    throw new SiteConfigError([`VITE_BASE_PATH must not contain a query, fragment, backslash or space (got "${value}")`]);
  }
  const segments = value.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new SiteConfigError([`VITE_BASE_PATH must not contain "." or ".." segments (got "${value}")`]);
  }
  if (/\/\/+/.test(value.replace(/^\/|\/$/g, ''))) {
    throw new SiteConfigError([`VITE_BASE_PATH must not contain empty segments (got "${value}")`]);
  }
  return `/${segments.join('/')}/`;
}

/*
 * A public site URL: https, or http only for a local dev host; no
 * credentials, query or fragment. Returned with a trailing slash so it can be
 * used as a base for new URL(relative, siteUrl).
 */
export function parseSiteUrl(raw: string, name = 'VITE_SITE_URL'): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SiteConfigError([`${name} must be an absolute URL such as https://example.com/ (got "${raw}")`]);
  }
  const problems: string[] = [];
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    problems.push(`${name} must use https (http is only accepted for localhost)`);
  }
  if (url.username || url.password) problems.push(`${name} must not contain credentials`);
  if (url.search || raw.includes('?')) problems.push(`${name} must not contain a query string`);
  if (url.hash || raw.includes('#')) problems.push(`${name} must not contain a fragment`);
  if (url.hostname.includes('*')) problems.push(`${name} must be an exact host, not a wildcard`);
  if (problems.length) throw new SiteConfigError(problems);
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return url;
}

function faviconFrom(raw: string): { href: string; type: string } {
  const href = raw || DEFAULT_FAVICON;
  if (raw) {
    if (/^https:\/\//i.test(raw)) {
      parseSiteUrl(raw.replace(/[?#].*$/, ''), 'VITE_SITE_FAVICON_URL');
    } else if (!/^\/?[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(raw) || raw.split('/').includes('..')) {
      throw new SiteConfigError([
        `VITE_SITE_FAVICON_URL must be an https URL or a file in public/ such as /my-icon.png (got "${raw}")`,
      ]);
    }
  }
  /* A bare "icon.png" means the public/ file; Vite adds the base to "/icon.png". */
  const resolved = /^https:\/\//i.test(href) || href.startsWith('/') ? href : `/${href}`;
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(resolved)?.[1]?.toLowerCase() ?? '';
  const type =
    { svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' }[
      extension
    ] ?? '';
  return { href: resolved, type };
}

export function resolveSiteConfig(env: EnvRecord): SiteConfig {
  const problems: string[] = [];
  const attempt = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (error) {
      if (error instanceof SiteConfigError) {
        problems.push(...error.problems);
        return fallback;
      }
      throw error;
    }
  };

  const name = read(env, 'VITE_SITE_NAME') || DEFAULT_SITE_NAME;
  if (name.length > 60) problems.push('VITE_SITE_NAME must be 60 characters or fewer');

  const basePath = attempt(() => normalizeBasePath(read(env, 'VITE_BASE_PATH')), '/');

  const rawSiteUrl = read(env, 'VITE_SITE_URL');
  const siteUrl = rawSiteUrl ? attempt(() => parseSiteUrl(rawSiteUrl), null) : null;
  if (siteUrl && siteUrl.pathname !== basePath) {
    problems.push(
      `VITE_SITE_URL is served from "${siteUrl.pathname}" but VITE_BASE_PATH is "${basePath}"; ` +
        'set VITE_BASE_PATH to the same path so assets and return links resolve',
    );
  }

  const favicon = attempt(() => faviconFrom(read(env, 'VITE_SITE_FAVICON_URL')), faviconFrom(''));

  if (problems.length) throw new SiteConfigError(problems);

  return {
    name,
    wordmark: name.toUpperCase(),
    title: read(env, 'VITE_SITE_TITLE') || `${name} - Find your next watch`,
    description: read(env, 'VITE_SITE_DESCRIPTION') || `${name} - discover your next movie or show.`,
    basePath,
    siteUrl: siteUrl ? siteUrl.href : null,
    siteHost: siteUrl ? siteUrl.hostname : null,
    favicon,
  };
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/*
 * Fills the %SITE_*% placeholders in index.html. Runs before Vite's own HTML
 * processing, so the default "/favicon.png" still gets the base path added.
 */
export function renderSiteHtml(html: string, site: SiteConfig): string {
  const faviconType = site.favicon.type ? ` type="${escapeHtml(site.favicon.type)}"` : '';
  /* Replacer functions, so a "$&" in a brand name is taken literally. */
  return html
    .replace(/%SITE_TITLE%/g, () => escapeHtml(site.title))
    .replace(/%SITE_DESCRIPTION%/g, () => escapeHtml(site.description))
    .replace(/ %SITE_FAVICON_TYPE%/g, () => faviconType)
    .replace(/%SITE_FAVICON%/g, () => escapeHtml(site.favicon.href));
}
