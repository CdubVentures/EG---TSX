// ─── TS gateway for structured-data ──────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types.

import { buildSiteIndexStructuredData as buildSiteIndexStructuredDataPure } from './structured-data.mjs';

export interface StructuredDataBreadcrumbItem {
  label: string;
  href?: string;
}

export type StructuredDataEntry = Record<string, unknown>;

export interface BuildSiteIndexStructuredDataOptions {
  siteUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  breadcrumbs: StructuredDataBreadcrumbItem[];
}

export const buildSiteIndexStructuredData: (opts: BuildSiteIndexStructuredDataOptions) => StructuredDataEntry[] = buildSiteIndexStructuredDataPure;
