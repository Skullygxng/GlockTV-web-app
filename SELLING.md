# Selling this template

## What a buyer gets

- The code from the **`template` branch** of this repository — identical to
  `main` except the deploy workflow carries **no credentials of yours**: no
  Supabase project URL, no publishable key, no TMDB key. Their builds read
  only their own secrets and variables.
- Their own Supabase project, their own TMDB key, their own NOWPayments
  account.
- The `npm run setup` wizard, which walks them through all of it — including
  tying their email as the admin of their instance.

## How to hand it over

1. `git switch template`
2. From the GitHub repo page → Code → **Download ZIP** (or point the buyer at
   the branch).
   **Never deliver a full git clone.** This repository's past commits contain
   the main instance's credentials, and history travels with a clone. The ZIP
   of a branch is the tip only — that's the point.
3. The buyer follows the README: `npm ci`, `npm run setup`, then the wizard's
   checklist covers everything remaining — their repo's secret
   (`TMDB_API_KEY`) and variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `SITE_URL`), the two Supabase workflows, Pages, and their owner email tied
   as admin.

## What stays yours

- The private main repository (backend, billing internals, operations,
  tests) never leaves your control.
- Your Supabase project, payment keys, ad zones and staff list are
  per-instance database state. A buyer's instance cannot see them and cannot
  affect them.

## Keeping the branch current

`template` was cut from `main` when this file was added. If you improve the
product, refresh the sale copy: switch to `template`, merge or re-copy from
`main`, re-blank the three credential defaults in the deploy workflow's
"Resolve build configuration" step (they're the only lines marked as instance
credentials), and push.
