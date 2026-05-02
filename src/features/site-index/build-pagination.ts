// ─── TS gateway for buildPagination ──────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and composes with Astro-specific concerns.

import { buildPagination as buildPaginationPure } from './build-pagination.mjs';

export interface PaginationPage {
  num: number | string;
  url: string;
  active?: boolean;
  ellipsis?: boolean;
}

export interface PaginationData {
  pages: PaginationPage[];
  prevUrl: string;
  nextUrl: string;
  total: number;
  current: number;
  baseUrl: string;
}

export interface BuildPaginationOptions {
  baseUrl: string;
  current: number;
  total: number;
}

export interface FilterCategory {
  key: string;
  label: string;
  url: string;
  count: number;
  active: boolean;
}

export const buildPagination: (opts: BuildPaginationOptions) => PaginationData = buildPaginationPure;
