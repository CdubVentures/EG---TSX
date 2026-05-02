#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExpectedSitemapUrls,
  diffSitemapUrls,
} from '../src/core/seo/sitemap-manifest.ts';
import {
  collectBuiltHtmlPages,
  readSitemapUrls,
} from './lib/seo-io.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

function formatList(label, values) {
  if (values.length === 0) return null;
  return `${label}: ${values.join(', ')}`;
}

export async function validateSeoSitemap({
  clientDir = path.join(ROOT_DIR, 'dist', 'client'),
  siteUrl = process.env.PUBLIC_SITE_URL ?? 'https://eggear.com',
} = {}) {
  const pages = await collectBuiltHtmlPages({ clientDir });
  const expected = buildExpectedSitemapUrls({ siteUrl, pages });
  const actual = await readSitemapUrls({ clientDir });
  const report = {
    expected,
    actual,
    ...diffSitemapUrls({ expected, actual }),
  };

  if (!report.ok) {
    const message = [
      'SEO sitemap validation failed.',
      formatList('Missing sitemap URLs', report.missing),
      formatList('Unexpected sitemap URLs', report.unexpected),
      formatList('Duplicate expected URLs', report.duplicateExpected),
      formatList('Duplicate actual URLs', report.duplicateActual),
    ].filter(Boolean).join('\n');

    throw new Error(message);
  }

  return report;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    await validateSeoSitemap();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
