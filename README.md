# GlockTV web app

The public front end of GlockTV — discover movies and shows, watch trailers
and streams, run live TV, and host friends watch parties. This repository holds
only what the website itself needs to build and run; backend, billing and
operations code live in the private main repository.

Built with Vite, React and TypeScript. Supabase and TMDB credentials are
injected at build time — nothing is hard-coded.

## Run locally

```bash
npm ci
npm run dev
```

`npm run build` produces the deployable `dist/` folder.

## Configuration

Everything prefixed `VITE_` is compiled into the browser bundle and is public.
The GitHub Pages deployment (`.github/workflows/deploy-pages.yml`) needs no
repository configuration: the deploy workflow embeds browser-safe defaults for
the Supabase URL and publishable key and for the TMDB key (which is public in
practice — it ships in the site's JavaScript for every visitor).

Optional overrides, when you want them:

- secret `TMDB_API_KEY`
- variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`

These override the embedded defaults when set. Optional branding, base path,
embed-provider and ads overrides mirror the main repository's `.env.example`.

## Operations

- **Deploying.** Every push to `main` builds and publishes through
  `.github/workflows/deploy-pages.yml`. Pages must be set to "GitHub Actions" in
  the repository settings; the workflow normalises the base path it gets from
  `actions/configure-pages`, so a renamed repository or a custom domain needs no
  edit there.
- **Credentials.** The Supabase URL, publishable key and TMDB key are embedded as
  build defaults in that workflow. All three are public by design — they ship in
  the bundle — so rotating them means rotating at the provider and updating the
  workflow, not hiding the old value.
- **Installing.** `index.html` declares an `apple-touch-icon` and a web app
  manifest generated at build time from `src/config/siteConfig.ts`, so a
  home-screen install carries the deployment's own name and icon. The in-app
  install prompt (`src/components/AddToHomeScreen.tsx`) teaches the iOS share
  sheet and raises the Chromium prompt where one exists.
- **PPV.** Streams come from StreamFree (`src/lib/ppvStreamFree.ts`) and the
  fight-card schedule from TheSportsDB. Every embed host is allowlisted in
  `src/lib/ppvEmbedPolicy.ts`; adding a provider means adding its embed origin
  there deliberately.
- **Backend.** Accounts, watch parties, progress and support need the Supabase
  project this deployment points at. A free-tier project pauses after about a
  week idle, so the main repository's `keep-supabase-awake.yml` pings it weekly
  and fails loudly if it is asleep.
