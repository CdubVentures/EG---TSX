/**
 * Shared I/O functions for SEO validation scripts.
 *
 * Extracted from validate-seo-sitemap.mjs so both the sitemap validator
 * and route-graph analyzer can reuse them.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { extractLocUrls } from '../../src/core/seo/sitemap-manifest.ts';

/**
 * Derives a route path from a built HTML file path.
 *
 * @param {{ clientDir: string, filePath: string }} options
 * @returns {string} route path (e.g., `/`, `/reviews/foo/`)
 */
export function routePathFromHtmlFile({ clientDir, filePath }) {
  const relativePath = path.relative(clientDir, filePath).replace(/\\/g, '/');
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) {
    const routePath = relativePath.slice(0, -'index.html'.length);
    return `/${routePath}`;
  }
  const basename = relativePath.replace(/\.html$/i, '');
  return `/${basename}/`;
}

/**
 * Recursively collects all built HTML pages from a dist directory.
 *
 * @param {{ clientDir: string }} options
 * @returns {Promise<Array<{ routePath: string, html: string }>>}
 */
export async function collectBuiltHtmlPages({ clientDir }) {
  const pages = [];
  const pending = [clientDir];

  while (pending.length > 0) {
    const currentDir = pending.pop();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      if (entry.name.startsWith('sitemap')) continue;

      const html = await fs.readFile(fullPath, 'utf8');
      pages.push({
        routePath: routePathFromHtmlFile({ clientDir, filePath: fullPath }),
        html,
      });
    }
  }

  return pages;
}

function resolveSitemapFileName(loc) {
  try {
    const parsed = new URL(loc);
    return path.basename(parsed.pathname);
  } catch {
    return path.basename(loc);
  }
}

/**
 * Reads sitemap URLs from a sitemap index or single sitemap file.
 *
 * @param {{ clientDir: string, indexFileName?: string }} options
 * @returns {Promise<string[]>}
 */
export async function readSitemapUrls({ clientDir, indexFileName = 'sitemap-index.xml' }) {
  const sitemapIndexPath = path.join(clientDir, indexFileName);
  const sitemapIndexXml = await fs.readFile(sitemapIndexPath, 'utf8');

  if (!sitemapIndexXml.includes('<sitemapindex')) {
    return extractLocUrls(sitemapIndexXml);
  }

  const sitemapFileNames = extractLocUrls(sitemapIndexXml).map(resolveSitemapFileName);
  const nestedUrls = await Promise.all(
    sitemapFileNames.map(async (fileName) => {
      const sitemapXml = await fs.readFile(path.join(clientDir, fileName), 'utf8');
      return extractLocUrls(sitemapXml);
    }),
  );

  return nestedUrls.flat();
}
