#!/usr/bin/env node
// GlockTV setup wizard — the owner's five minutes from zero to owned.
//
//   npm run setup
//
// Walks the owner of a fresh deployment through everything that can be asked
// in a terminal: identity, keys, Bitcoin billing and the owner account — then
// writes .env.local for the local build, ties the owner email as the
// instance's admin, and prints the short checklist of steps that need a
// browser (GitHub variables and the dashboards).
//
// Nothing typed here is sent anywhere except one deliberate exception: the
// owner tie-in call, which goes to the owner's own Supabase project using a
// service role key the wizard uses once and never stores. Every other value
// lands in .env.local (git-ignored) or is printed for the owner to paste into
// the right dashboard themselves.
import readline from 'node:readline/promises';
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = async (question, fallback = '') => {
  const suffix = fallback ? `  [${fallback}]` : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
};

const fail = (message) => {
  console.error(`\n✗ ${message}`);
  rl.close();
  process.exit(1);
};

console.log(`
════════════════════════════════════════════════════════════
  GlockTV setup — become the owner of your own instance
════════════════════════════════════════════════════════════`);

if (!process.stdin.isTTY) {
  console.error('This wizard asks questions interactively. Run it in a terminal: npm run setup');
  process.exit(1);
}

// ── 1. Identity ────────────────────────────────────────────────────────────
console.log('\n1. Identity — what your instance is called and where it lives.\n');

const name = await ask('Site name (shown in the header, tab and installed app)');
if (!name) fail('A name is required — it becomes every title in the product.');

const title = await ask('Browser tab title', `${name} - Find your next watch`);
const description = await ask('Meta description', `${name} - discover your next movie or show.`);

let siteUrl = await ask('Public URL of this instance (e.g. https://watch.example.com/)');
for (;;) {
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      console.error('   Must be https:// (http://localhost is allowed for local testing).');
    } else {
      break;
    }
  } catch {
    console.error('   That is not a valid URL — include the https:// part.');
  }
  siteUrl = await ask('Public URL of this instance');
}

/* Mirrors the build's own rule: "/" or "/name/" — the shape Vite's base and
   every link in the bundle expect. */
const urlPath = new URL(siteUrl).pathname;
const basePath = urlPath === '/' ? '/' : `/${urlPath.replace(/^\//, '').replace(/\/$/, '')}/`;

// ── 2. Backend ─────────────────────────────────────────────────────────────
console.log('\n2. Backend — where accounts, rooms, history and support live.\n');

const supabaseUrl = await ask('Supabase project URL (e.g. https://abcd.supabase.co)');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  console.error("   That doesn't look like a Supabase project URL — continuing anyway if you run a custom domain in front of it.");
}
const publishableKey = await ask('Supabase publishable (anon) key (Settings → API)');
if (!publishableKey) fail('Without the publishable key, accounts, rooms and support cannot work.');
const tmdbKey = await ask('TMDB API key v3 (themoviedb.org → Settings → API)');
if (!tmdbKey) fail('Without a TMDB key the catalog is empty.');

// ── 3. Bitcoin billing ─────────────────────────────────────────────────────
console.log('\n3. Bitcoin billing (NOWPayments) — the checkout your members pay through.\n');
console.log('   You can skip this now and add the keys later — see docs/CRYPTO-SETUP.md.\n');

const configureCrypto = (await ask('Configure NOWPayments keys now? (yes/skip)')).toLowerCase() === 'yes';

let nowPaymentsApiKey = '';
let nowPaymentsIpnSecret = '';
let cryptoPrice = '4.99';
let cryptoCurrency = 'btc';

if (configureCrypto) {
  nowPaymentsApiKey = await ask('NOWPayments API key');
  nowPaymentsIpnSecret = await ask('NOWPayments IPN secret');
  cryptoPrice = await ask('Premium price per month, USD', '4.99');
  cryptoCurrency = await ask('Pay currency', 'btc');
  if (!nowPaymentsApiKey || !nowPaymentsIpnSecret) {
    console.error('   Missing key(s) — skipping; you can add them later (docs/CRYPTO-SETUP.md).');
  }
}

// ── 4. The owner ───────────────────────────────────────────────────────────
console.log('\n4. You, the owner — the WordPress moment: tie an email to admin.\n');

const ownerEmail = await ask('Your email (the one you will sign in to the site with)');

let ownerTied = false;
if (ownerEmail) {
  const tieNow = (await ask('Make it admin right now? (yes needs your service role key, used once and never stored) (yes/skip)')).toLowerCase() === 'yes';
  if (tieNow && supabaseUrl) {
    const serviceRoleKey = await ask('Service role key (Supabase → Settings → API → service_role — paste carefully)');
    if (serviceRoleKey) {
      try {
        const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/make_staff`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ member_email: ownerEmail, member_role: 'admin' }),
        });
        const text = await response.text();
        if (response.ok) {
          console.log(`\n   ✓ Tied: ${ownerEmail} is now an admin of this instance.`);
          ownerTied = true;
        } else {
          /* Most likely: that email has not signed in to the site yet (no
             user id exists to promote), or the key was not the service role. */
          console.error(`\n   ✗ The call was refused (${text || response.status}). The SQL fallback below still works once the email has signed in once.`);
        }
      } catch (reason) {
        console.error(`\n   ✗ Could not reach the project (${reason instanceof Error ? reason.message : reason}).`);
      }
    }
  }
}

// ── 5. Write the local build config ────────────────────────────────────────
console.log('\n5. Writing .env.local (used by every local build; git-ignored).\n');

const envFile = '.env.local';
if (existsSync(envFile)) {
  const backup = `.env.local.backup-${Date.now()}`;
  renameSync(envFile, backup);
  console.log(`   Existing .env.local moved to ${backup}`);
}

const lines = [
  `VITE_SITE_NAME=${name}`,
  `VITE_SITE_TITLE=${title}`,
  `VITE_SITE_DESCRIPTION=${description}`,
  `VITE_SITE_URL=${siteUrl}`,
  `VITE_BASE_PATH=${basePath}`,
  `VITE_TMDB_API_KEY=${tmdbKey}`,
  `VITE_SUPABASE_URL=${supabaseUrl}`,
  `VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
];
writeFileSync(envFile, `${lines.join('\n')}\n`);
console.log(`   wrote ${envFile} (${lines.length} values)`);

// ── 6. Brand assets ────────────────────────────────────────────────────────
if (existsSync('brand/logo-source.png')) {
  const regenerate = (await ask('\n6. Rebuild the logo, tab and home-screen icons from brand/logo-source.png now? (yes/no)')).toLowerCase() === 'yes';
  if (regenerate) {
    console.log('');
    spawnSync(process.execPath, ['scripts/make-brand.mjs'], { stdio: 'inherit' });
  }
} else {
  console.log('\n6. Brand artwork: drop a square PNG at brand/logo-source.png and run "npm run make-brand" to own the logo and icons.');
}

// ── 7. What needs a browser ────────────────────────────────────────────────
console.log('\n7. Finish in the browser (each is a few clicks on your own accounts):\n');

const checklist = [];
checklist.push([
  'GitHub, your template repository → Settings → Secrets and variables → Actions',
  `variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL (= ${siteUrl}) — and secret: TMDB_API_KEY`,
]);
if (!ownerTied && ownerEmail) {
  checklist.push([
    'Supabase → SQL editor',
    `select public.make_staff('${ownerEmail}', 'admin');  — works once that email has signed in to the site once`,
  ]);
}
if (configureCrypto && (!nowPaymentsApiKey || !nowPaymentsIpnSecret)) {
  checklist.push([
    'Supabase → Settings → Edge Functions → secrets',
    `NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, CRYPTO_PREMIUM_MONTHLY_USD (= ${cryptoPrice}) — see docs/CRYPTO-SETUP.md`,
  ]);
}
checklist.push([
  'GitHub → Actions',
  'run "Apply Supabase migrations" (dry run off), then "Deploy Supabase Edge Functions"',
]);
checklist.push([
  'GitHub → Settings → Pages',
  'Source = GitHub Actions — then push main and the Pages build publishes your branded site',
]);

for (const [where, what] of checklist) {
  console.log(`   • ${where}`);
  console.log(`     ${what}`);
}

if (!existsSync('node_modules')) {
  console.log('\n   One more thing: run "npm ci" before building or deploying.');
}

console.log(`\nSetup complete.${ownerTied ? ' You are the admin of this instance.' : ''} Try "npm run dev" to see it locally.\n`);
rl.close();