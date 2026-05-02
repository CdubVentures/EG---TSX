#!/usr/bin/env node

/**
 * Route-graph advisory analyzer.
 *
 * Reads built HTML pages from dist/client, analyzes internal link topology,
 * and produces a warning report. Never fails the deploy — advisory only.
 *
 * CLI: node scripts/validate-route-graph.mjs [--mode <mode>] [--client-dir <path>] [--site-url <url>]
 * Programmatic: import { validateRouteGraph } from './validate-route-graph.mjs';
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectBuiltHtmlPages, readSitemapUrls } from './lib/seo-io.mjs';
import { analyzeRouteGraph } from '../src/core/seo/route-graph.ts';
import { formatRouteGraphLog } from '../src/core/seo/route-graph-log.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function formatDisplayTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Run route-graph analysis on a built site.
 *
 * @param {{ clientDir?: string, siteUrl?: string, mode?: string, logDir?: string }} options
 * @returns {Promise<{ report, event, logFile }>}
 */
export async function validateRouteGraph({
  clientDir = path.join(ROOT_DIR, 'dist', 'client'),
  siteUrl = process.env.PUBLIC_SITE_URL ?? 'https://eggear.com',
  mode = 'unknown',
  logDir = path.join(ROOT_DIR, 'debug', 'deploy'),
} = {}) {
  const now = new Date();
  const pages = await collectBuiltHtmlPages({ clientDir });

  let sitemapUrls = [];
  let sitemapFiles = [];
  try {
    sitemapUrls = await readSitemapUrls({ clientDir });
    // Discover which sitemap files exist
    const entries = await fs.readdir(clientDir);
    sitemapFiles = entries.filter(f => f.startsWith('sitemap') && f.endsWith('.xml'));
  } catch {
    // Sitemap may not exist — proceed without it
  }

  const report = analyzeRouteGraph({
    pages,
    sitemapUrls,
    siteUrl,
  });

  // No issues — quiet mode
  if (report.totalIssueCount === 0) {
    return { report, event: null, logFile: null };
  }

  // Write log file
  const logContent = formatRouteGraphLog({
    report,
    timestamp: formatDisplayTimestamp(now),
    mode,
    buildResult: 'success',
    distPath: path.relative(ROOT_DIR, clientDir) || clientDir,
    sitemapFiles,
  });

  const logFileName = `${formatTimestamp(now)}_route-graph-warning.txt`;
  const logFilePath = path.join(logDir, logFileName);

  await fs.mkdir(logDir, { recursive: true });
  await fs.writeFile(logFilePath, logContent, 'utf8');

  // Build event payload
  const event = {
    egTsxEvent: true,
    kind: 'route_graph_warning',
    status: 'warning',
    mode,
    issueCount: report.totalIssueCount,
    logFile: path.relative(ROOT_DIR, logFilePath) || logFilePath,
    summary: report.summary,
    logText: logContent,
  };

  return { report, event, logFile: logFilePath };
}

// ---------------------------------------------------------------------------
// Direct CLI execution
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const args = process.argv.slice(2);
  const readArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  try {
    const result = await validateRouteGraph({
      mode: readArg('--mode') ?? 'cli',
      clientDir: readArg('--client-dir'),
      siteUrl: readArg('--site-url'),
    });

    if (result.event) {
      console.log(JSON.stringify(result.event));
    } else {
      console.log('Route graph analysis: clean (0 issues)');
    }
  } catch (error) {
    console.warn(`Route graph analysis failed: ${error.message}`);
    // Advisory — never fail the process
  }
}
