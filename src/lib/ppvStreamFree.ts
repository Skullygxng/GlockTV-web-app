/*
 * StreamFree as a catalog provider.
 *
 * Streamed, the provider this slot was built for, shut down - its API now
 * serves a closure page - so the PPV tab lost the only source that ever
 * supplied playable embeds. StreamFree is one of the successors Streamed points
 * at, with a documented public API and no key.
 *
 * Its catalogue carries the embed URLs themselves, so an event arrives already
 * playable: no second lookup per event, and one list covers fight cards and the
 * live sport around them. Categories the panel has no filter for become
 * "other" rather than inventing one.
 */

import type { PpvCategory, PpvEvent } from './ppv';
import { emptyCatalogProviderDiagnostics } from './ppvDiagnostics';
import { mergePpvPlaybackSources } from './ppvProviders';
import type { PpvCatalogProvider, PpvCatalogProviderResult, PpvFetchLike } from './ppvProviders';

export const STREAMFREE_API = 'https://strmfree.st';

const STREAMS_URL = `${STREAMFREE_API}/api/v1/streams`;
const REQUEST_TIMEOUT_MS = 12_000;

const NAME_MAX = 140;
const KEY_MAX = 120;
const LABEL_MAX = 32;

/* The shape StreamFree documents. Every field is optional: it is a third party. */
interface StreamFreeStream {
  name?: unknown;
  category?: unknown;
  league?: unknown;
  stream_key?: unknown;
  match_timestamp?: unknown;
  is_external?: unknown;
  sources?: unknown;
  live_sources?: unknown;
}

function text(value: unknown, max = NAME_MAX): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function httpsUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.startsWith('https://'));
}

function categoryOf(upstream: string): PpvCategory {
  const value = upstream.toLowerCase();
  if (value === 'boxing') return 'boxing';
  if (value === 'wrestling') return 'wrestling';
  if (value === 'combat' || value === 'mma') return 'mma';
  return 'other';
}

function statusOf(startsAtMs: number, isLive: boolean, now: number): PpvEvent['status'] {
  if (isLive) return 'live';
  if (startsAtMs > now + 60_000) return 'upcoming';
  if (startsAtMs > now - 6 * 60 * 60 * 1000) return 'live';
  return 'ended';
}

function toEvent(row: StreamFreeStream, now: number): PpvEvent | null {
  const title = text(row.name);
  const key = text(row.stream_key, KEY_MAX);
  const startsAtMs =
    typeof row.match_timestamp === 'number' && Number.isFinite(row.match_timestamp)
      ? row.match_timestamp * 1000
      : null;
  if (!title || !key || startsAtMs === null) return null;

  const live = httpsUrls(row.live_sources);
  const all = httpsUrls(row.sources);
  const embeds = [...new Set([...live, ...all])];
  if (!embeds.length) return null;

  const upstream = text(row.category, LABEL_MAX).toLowerCase();

  return {
    provider: 'streamfree',
    providerEventId: `${upstream || 'stream'}:${key}`,
    catalogProvenance: {
      feeds: ['fight'],
      upstreamCategories: upstream ? [upstream] : [],
    },
    title,
    category: categoryOf(upstream),
    promotion: text(row.league, LABEL_MAX) || undefined,
    startsAt: new Date(startsAtMs).toISOString(),
    status: statusOf(startsAtMs, live.length > 0, now),
    sourceRefs: [],
    embeds: [],
    playbackSources: mergePpvPlaybackSources(
      embeds.map((url, index) => ({
        providerId: 'streamfree' as const,
        label: `StreamFree ${index + 1}`,
        kind: 'hosted_embed' as const,
        url,
      })),
    ),
  };
}

export const streamFreeCatalogProvider: PpvCatalogProvider = {
  id: 'streamfree',
  label: 'StreamFree',
  async load(request: PpvFetchLike, now = Date.now()): Promise<PpvCatalogProviderResult> {
    const diagnostics = emptyCatalogProviderDiagnostics('streamfree');
    diagnostics.requestCount = 1;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    try {
      const response = await request(STREAMS_URL, {
        headers: { accept: 'application/json' },
        signal: controller?.signal,
      });
      if (!response.ok) {
        diagnostics.status = 'http_error';
        diagnostics.coverage = 'none';
        diagnostics.httpStatuses = [response.status];
        return { events: [], diagnostics };
      }

      const payload: unknown = await response.json();
      const rows = Array.isArray((payload as { streams?: unknown } | null)?.streams)
        ? ((payload as { streams: unknown[] }).streams as StreamFreeStream[])
        : [];

      const events: PpvEvent[] = [];
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        if (row.is_external === true) continue;
        const event = toEvent(row, now);
        if (event) events.push(event);
      }

      diagnostics.completedRequests = 1;
      diagnostics.returnedRowCount = rows.length;
      diagnostics.admittedEvents = events.length;
      diagnostics.malformedRowCount = Math.max(0, rows.length - events.length);
      diagnostics.status = events.length ? 'success' : 'empty_success';
      diagnostics.coverage = 'complete';
      return { events, diagnostics };
    } catch {
      diagnostics.status = 'network_or_cors_error';
      diagnostics.coverage = 'none';
      return { events: [], diagnostics };
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
};
