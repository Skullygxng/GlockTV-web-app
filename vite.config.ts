import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { renderSiteHtml, resolveSiteConfig, type SiteConfig } from './src/config/siteConfig.ts';

/*
 * Host-neutral by default: with no VITE_BASE_PATH the build is served from the
 * domain root. A host that serves the app under a sub-path (GitHub Pages
 * project sites, for one) sets VITE_BASE_PATH for that build - see
 * docs/INSTANCE-DEPLOYMENT.md.
 */
function siteHtml(site: SiteConfig): Plugin {
  return {
    name: 'instance-site-html',
    transformIndexHtml: { order: 'pre', handler: (html) => renderSiteHtml(html, site) },
  };
}

/*
 * The web app manifest, built from the same identity as index.html, so an
 * installed icon carries the instance's own name and colours rather than a
 * hard-coded brand. Written to the site root at build time; the dev server
 * serves the same body, so "Add to Home Screen" behaves the same either way.
 */
function siteManifest(site: SiteConfig): Plugin {
  const body = JSON.stringify({
    name: site.name,
    short_name: site.name,
    start_url: site.basePath,
    scope: site.basePath,
    display: 'standalone',
    background_color: '#050507',
    theme_color: '#050507',
    icons: [
      { src: `${site.basePath}favicon.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${site.basePath}brand/logo-mark.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${site.basePath}apple-touch-icon.png`, sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  });

  return {
    name: 'instance-site-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: body });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = String((request as { url?: string }).url ?? '').split('?')[0];
        if (path.endsWith('manifest.webmanifest')) {
          response.setHeader('Content-Type', 'application/manifest+json');
          response.end(body);
          return;
        }
        next();
      });
    },
  };
}

/*
 * The two files a crawler looks for at the site root. The sitemap is only
 * written when the build knows its public address: a sitemap of relative or
 * invented URLs is worse than none.
 */
function siteCrawlFiles(site: SiteConfig): Plugin {
  const robots = ['User-agent: *', 'Allow: /', site.siteUrl ? `Sitemap: ${site.siteUrl}sitemap.xml` : '']
    .filter(Boolean)
    .join('\n') + '\n';

  const sitemap = site.siteUrl
    ? [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        `  <url><loc>${site.siteUrl}</loc></url>`,
        '</urlset>',
        '',
      ].join('\n')
    : '';

  const files: Array<[string, string]> = [['robots.txt', robots]];
  if (sitemap) files.push(['sitemap.xml', sitemap]);

  return {
    name: 'instance-crawl-files',
    generateBundle() {
      for (const [fileName, source] of files) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = String((request as { url?: string }).url ?? '').split('?')[0];
        const match = files.find(([fileName]) => path.endsWith(fileName));
        if (!match) {
          next();
          return;
        }
        response.setHeader(
          'Content-Type',
          match[0].endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
        );
        response.end(match[1]);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  /* loadEnv applies Vite's own precedence: process env over .env files. */
  const site = resolveSiteConfig(loadEnv(mode, '.', 'VITE_'));
  return {
    base: site.basePath,
    plugins: [react(), siteHtml(site), siteManifest(site), siteCrawlFiles(site)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
      css: true,
    },
  };
});

