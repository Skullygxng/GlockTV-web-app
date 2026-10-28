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

export default defineConfig(({ mode }) => {
  /* loadEnv applies Vite's own precedence: process env over .env files. */
  const site = resolveSiteConfig(loadEnv(mode, '.', 'VITE_'));
  return {
    base: site.basePath,
    plugins: [react(), siteHtml(site)],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './tests/setup.ts',
      css: true,
    },
  };
});

