#!/usr/bin/env node
// Regenerates every derived brand image from brand/logo-source.png.
//
//   npm run make-brand
//
// Rebranding: replace brand/logo-source.png with the new artwork (square, at
// least 512x512), run this, and the header logo, browser tab icon and
// home-screen icon are all updated together. Writes:
//
//   public/favicon.png             192x192  (web app manifest icon)
//   public/apple-touch-icon.png     180x180  (iOS home screen)
//   public/brand/logo-mark.png      512x512  (header logo)
//
// Needs a local image tool - macOS ships `sips`, elsewhere ImageMagick
// (`magick` or `convert`). With neither, this prints the exact manual
// exports instead of guessing at output.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SOURCE = 'brand/logo-source.png';
const targets = [
  ['public/favicon.png', 192],
  ['public/apple-touch-icon.png', 180],
  ['public/brand/logo-mark.png', 512],
];

if (!existsSync(SOURCE)) {
  console.error(`Missing ${SOURCE} - drop the new artwork there first (square, at least 512x512).`);
  process.exit(1);
}

function has(command) {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const manual = () => {
  console.log('No image tool found. Export from brand/logo-source.png by hand:');
  for (const [dest, size] of targets) console.log(`  ${dest}  ${size}x${size}, centre-cropped square`);
  console.log('  public/favicon.svg  replace it, or remove the SVG icon link from index.html');
};

/* sips (macOS): centre-crop a square once, then resize per target. */
function withSips(square) {
  for (const [dest, size] of targets) {
    execFileSync('sips', ['-z', String(size), String(size), square, '--out', dest], { stdio: 'ignore' });
  }
}

/* ImageMagick: resize shortest edge, then crop to a centred square. */
function withMagick(command) {
  for (const [dest, size] of targets) {
    execFileSync(command, [SOURCE, '-resize', `${size}x${size}^`, '-gravity', 'center', '-extent', `${size}x${size}`, dest], {
      stdio: 'ignore',
    });
  }
}

const work = mkdtempSync(path.join(tmpdir(), 'make-brand-'));
try {
  const square = path.join(work, 'square.png');
  if (has('sips')) {
    /* sips cannot resize-and-crop in one step, so cut a 512 square first. */
    execFileSync('sips', ['-c', '512', '512', SOURCE, '--out', square], { stdio: 'ignore' });
    withSips(square);
  } else if (has('magick')) {
    withMagick('magick');
  } else if (has('convert')) {
    withMagick('convert');
  } else {
    manual();
    process.exit(1);
  }
  for (const [dest] of targets) console.log(`wrote ${dest}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}