/**
 * Text log formatter for route-graph warning reports.
 *
 * Produces a human-readable plain-text log matching the format
 * defined in debug/audit/seo/01-dashboard-route-graph-warning.md.
 */

import type { RouteGraphReport, RouteGraphIssue } from './route-graph.ts';

export interface FormatRouteGraphLogOptions {
  report: RouteGraphReport;
  timestamp: string;
  mode: string;
  buildResult: string;
  distPath: string;
  sitemapFiles: string[];
}

const SECTION_LABELS: Record<RouteGraphIssue['type'], string> = {
  unresolved_link: 'Unresolved Links',
  orphan_page: 'Orphan Pages',
  canonical_mismatch: 'Canonical Mismatches',
  sitemap_mismatch: 'Sitemap Mismatches',
  noindex_leak: 'Noindex Leaks',
  duplicate_canonical: 'Duplicate Canonicals',
};

const SUMMARY_KEYS: Array<{ key: keyof RouteGraphReport['summary']; label: string }> = [
  { key: 'unresolvedLinks', label: 'unresolved_links' },
  { key: 'orphanPages', label: 'orphan_pages' },
  { key: 'canonicalMismatches', label: 'canonical_mismatches' },
  { key: 'sitemapMismatches', label: 'sitemap_mismatches' },
  { key: 'noindexLeaks', label: 'noindex_leaks' },
  { key: 'duplicateCanonicals', label: 'duplicate_canonicals' },
];

/**
 * Formats a route-graph report into a plain-text log string.
 */
export function formatRouteGraphLog({
  report,
  timestamp,
  mode,
  buildResult,
  distPath,
  sitemapFiles,
}: FormatRouteGraphLogOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('EG-TSX Route Graph Warning Report');
  lines.push(`Timestamp: ${timestamp}`);
  lines.push(`Mode: ${mode}`);
  lines.push(`Build Result: ${buildResult}`);
  lines.push(`Audit Result: ${report.totalIssueCount > 0 ? 'warnings' : 'clean'}`);
  lines.push(`Total Issues: ${report.totalIssueCount}`);
  lines.push('');

  // Summary counts
  lines.push('Summary');
  for (const { key, label } of SUMMARY_KEYS) {
    lines.push(`- ${label}: ${report.summary[key]}`);
  }

  // Detail sections — only when issues exist
  if (report.totalIssueCount > 0) {
    // Group issues by type, maintaining order
    const grouped = new Map<RouteGraphIssue['type'], RouteGraphIssue[]>();
    for (const issue of report.issues) {
      const existing = grouped.get(issue.type);
      if (existing) {
        existing.push(issue);
      } else {
        grouped.set(issue.type, [issue]);
      }
    }

    for (const [type, issues] of grouped) {
      lines.push('');
      lines.push(SECTION_LABELS[type]);
      for (const issue of issues) {
        lines.push(`- ${issue.detail}`);
      }
    }
  }

  // Context footer
  lines.push('');
  lines.push('Context');
  lines.push(`Dist path: ${distPath}`);
  lines.push(`Sitemap files: ${sitemapFiles.length > 0 ? sitemapFiles.join(', ') : 'none'}`);
  lines.push(`Deploy mode: ${mode}`);

  return lines.join('\n');
}
