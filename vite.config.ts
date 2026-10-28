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
      { src: `${site.basePath}favicon.png`, sizes: '192x192', type: 'image/png' },
      { src: `${site.basePath}apple-touch-icon.png`, sizes: '180x180', type: 'image/png' },
    ],
  });

  return {
    name: 'instance-site-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: body });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0]?.endsWith('manifest.webmanifest')) {
          response.setHeader('Content-Type', 'application/manifest+json');
          response.end(body);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  /* loadEnv applies Vite's own precedence: process env over .env files. */
  const site = resolveSiteConfig(loadEnv(mode, '.', 'VITE_'));
  return {
    base: site.basePath,
    plugins: [react(), siteHtml(site), siteManifest(site)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
      css: true,
    },
  };
});

