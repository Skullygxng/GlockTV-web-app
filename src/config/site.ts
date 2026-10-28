import { resolveSiteConfig } from './siteConfig';

/*
 * This deployment's browser-safe identity, resolved once from the build's
 * VITE_* values. Components read the brand from here rather than from
 * import.meta.env, so the rules for defaults and validation live in one place
 * (siteConfig.ts) and vite.config.ts applies the same ones to index.html.
 */
export const site = resolveSiteConfig(import.meta.env as Record<string, string | boolean | undefined>);
