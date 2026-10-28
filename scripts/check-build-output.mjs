#!/usr/bin/env node
// Asserts that dist/ is wired for the base path it will be served from.
//
//   node scripts/check-build-output.mjs /          # domain-root build
//   node scripts/check-build-output.mjs /watch/    # sub-path build
//
// Every local src/href in dist/index.html must sit under the base, and every
// file it names must exist - the failure mode being a build that looks fine
// and then 404s its own JavaScript on the host. Dependency-free.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  console.error(`Base must start and end with "/" (got "${base}")`);
  process.exit(1);
}

const html = readFileSync('dist/index.html', 'utf8');
const problems = [];
if (/%SITE_[A-Z_]+%/.test(html)) problems.push('index.html still contains an unfilled %SITE_*% placeholder');

const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const local = refs.filter((ref) => !/^(?:[a-z]+:)?\/\//i.test(ref));
if (!local.some((ref) => /\/assets\/.+\.js$/.test(ref))) problems.push('no bundled script referenced');
for (const ref of local) {
  /* A document-relative URL ("manifest.webmanifest") resolves against the page,
     which is served from the base; only root-relative ones are already absolute. */
  const resolved = ref.startsWith('/') ? ref : `${base}${ref}`;
  if (!resolved.startsWith(base)) {
    problems.push(`${ref} is outside the base path ${base}`);
    continue;
  }
  const file = path.join('dist', resolved.slice(base.length));
  if (!existsSync(file)) problems.push(`${ref} is referenced but ${file} does not exist`);
}
if (base !== '/' && html.includes('"/assets/')) problems.push('root-relative /assets/ reference in a sub-path build');

if (problems.length) {
  console.error(`dist/ is not ready to serve from ${base}:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`dist/ ok for base ${base}: ${local.length} local references resolve`);
