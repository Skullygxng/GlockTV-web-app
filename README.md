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
For the GitHub Pages deployment (`.github/workflows/deploy-pages.yml`), the
repository needs:

- secret `TMDB_API_KEY`
- variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (browser-safe values)

For local development, copy the same values into a `.env.local` file. Optional
overrides (branding, base path, embed providers, ads) mirror the main
repository's `.env.example`; sensible GlockTV defaults apply when they are
unset.