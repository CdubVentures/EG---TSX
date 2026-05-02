// WHY: Pre-computed from scripts/invalidation-core.mjs at bundle build time.
// invalidation-core.mjs uses node:fs + import.meta.url which crash in browser
// IIFE bundles. This file provides the same constant without Node.js dependencies.
// To regenerate: node -e "import {SITE_FULL_INVALIDATION_PATHS} from './scripts/invalidation-core.mjs'; console.log(JSON.stringify(SITE_FULL_INVALIDATION_PATHS));"
export const SITE_FULL_INVALIDATION_PATHS = ["/reviews/*","/guides/*","/news/*","/brands/*","/games/*","/hubs/*","/images/*","/api/*","/api/search*","/assets/*","/_astro/*","/fonts/*","/css/*","/js/*","/static/*","/scripts/*","/src/*","/tools/*","/*.css","/*.htm","/*.html","/*.js","/*.json","/*.map","/*.mjs","/*.txt","/manifest*.json","/robots.txt","/service-worker.js","/sitemap.xml","/"];
