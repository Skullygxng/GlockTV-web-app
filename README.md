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