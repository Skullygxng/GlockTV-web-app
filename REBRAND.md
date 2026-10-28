# Rebrand checklist

This repository is the template. A rebrand is configuration plus four image
files — no code changes.

**Shortcut:** run `npm run setup` first — the wizard walks through identity,
backend keys, Bitcoin billing and the owner tie-in, and writes `.env.local`
for you. The checklist below is the manual equivalent plus the artwork and
colour steps it doesn't cover.

## 1. Identity (build-time env)

| What | Variable |
| --- | --- |
| Name (wordmark, tab title, manifest, installed app name) | `VITE_SITE_NAME` |
| Browser tab title | `VITE_SITE_TITLE` (defaults from the name) |
| Meta description | `VITE_SITE_DESCRIPTION` |
| Base path | `VITE_BASE_PATH` (`/` for a domain root, `/name/` for a Pages project site) |
| Canonical URL | `VITE_SITE_URL` (its path must equal the base path) |

Set them in `.env.local` for local builds, or as repository variables wired
through `.github/workflows/deploy-pages.yml`.

## 2. Artwork

1. Drop the new artwork (square, at least 512x512) at `brand/logo-source.png`.
2. Run `npm run make-brand` — it regenerates `public/favicon.png`,
   `public/apple-touch-icon.png` and `public/brand/logo-mark.png` from that
   one file. Needs macOS `sips` or ImageMagick; otherwise it prints the
   manual exports.
3. The header logo, browser tab icon and home-screen icon all derive from
   those files. `public/favicon.svg` is an SVG fallback — replace it too, or
   remove its link from `index.html`.

## 3. Colours

The palette lives in `src/styles.css`: the CSS custom properties on `:root`
(`--violet`, `--purple`) plus the violet/purple hex family used throughout
(`7b16ff`, `9f37ff`, `8b24ed`, …). Replace them consistently — they appear in
gradients, glows and buttons. If you change the panel colour, the ad frames
paint their own background from `adFrameDocument` in `src/lib/ads.ts`
(`#0b0b10`).

## 4. Playback embeds

Embed providers are env-only (`VITE_MOVIE_EMBED_URL_TEMPLATE` and friends —
see the deploy workflow), and every embed host must also be allowlisted in
`src/lib/ppvEmbedPolicy.ts`. A rebrand that changes providers touches both.

## 5. Verify

- `npm run build && npm run preview` — check the title, icon, wordmark and
  that assets resolve under the base path.
- `grep -ri glocktv src/ index.html public/` — the only remaining hits should
  be the default fallback in `src/config/siteConfig.ts`.