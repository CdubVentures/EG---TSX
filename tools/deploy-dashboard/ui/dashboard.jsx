import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { SITE_FULL_INVALIDATION_PATHS } from "./invalidation-paths.js";
import {
  bindInvalidationToActiveGroup,
  createEmptyCdnPathResolutionState,
  getCdnPathStateLabel,
  rememberCdnGroupPaths,
  resolveInvalidationPaths,
} from "./cdn-path-status.ts";
import {
  applySiteStageProgressEvent,
  createEmptySiteStageProgress,
} from "./site-stage-progress.ts";
import { buildInstantPublishCdnPlan } from "./publish-cdn-plan.ts";
import {
  createEmptyQueuedCdnState,
  hydrateQueuedCdnState,
  markQueuedCdnStateRunning,
} from "./queued-cdn-state.ts";

/* THEMES — inspired by creativebeacon.com/top-10-wordpress-themes-video-game-website */
const THEMES = {
  arcade: {
    id:"arcade", name:"Arcade", desc:"Vivid green gaming blog",
    bg:"#f3f6f3", panel:"#ffffff", ink:"0,0,0", textColor:"#1a2e1a",
    border:"rgba(46,204,64,0.18)", borderB:"rgba(0,0,0,0.07)",
    cyan:"#2ecc40", blue:"#3498db", purple:"#8e44ad",
    orange:"#e67e22", red:"#e74c3c", yellow:"#f1c40f", green:"#27ae60",
    dim:"rgba(0,0,0,0.38)", dimmer:"rgba(0,0,0,0.14)",
    headingFont:"'Montserrat',sans-serif", monoFont:"'Roboto Mono',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Roboto+Mono:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 60% 30% at 50% 0%, rgba(46,204,64,0.06) 0%, transparent 70%)",
    scrollThumb:"rgba(46,204,64,0.2)",
    titleGradient:"linear-gradient(135deg,#2ecc40,#27ae60)",
    topbarBg:"rgba(243,246,243,0.97)",
    preview:["#2ecc40","#3498db","#8e44ad","#e67e22"],
    insetBg:"rgba(0,0,0,0.04)", floatShadow:"rgba(0,0,0,0.1)",
  },
  funhaus: {
    id:"funhaus", name:"Funhaus", desc:"Colorful flat design on blue",
    bg:"#4a7fb5", panel:"#5889bf", ink:"255,255,255", textColor:"#fff",
    border:"rgba(255,255,255,0.14)", borderB:"rgba(255,255,255,0.07)",
    cyan:"#ff6b6b", blue:"#4ecdc4", purple:"#a66bbe",
    orange:"#f7b731", red:"#eb3b5a", yellow:"#fed330", green:"#26de81",
    dim:"rgba(255,255,255,0.34)", dimmer:"rgba(255,255,255,0.16)",
    headingFont:"'Nunito',sans-serif", monoFont:"'Source Code Pro',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Source+Code+Pro:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 60% 35% at 50% 0%, rgba(255,107,107,0.06) 0%, rgba(78,205,196,0.04) 50%, transparent 70%)",
    scrollThumb:"rgba(255,255,255,0.18)",
    titleGradient:"linear-gradient(135deg,#ff6b6b,#4ecdc4)",
    topbarBg:"rgba(58,100,148,0.97)",
    preview:["#ff6b6b","#4ecdc4","#a66bbe","#f7b731"],
    insetBg:"rgba(0,0,0,0.12)", floatShadow:"rgba(0,0,0,0.3)",
  },
  felt: {
    id:"felt", name:"Felt", desc:"Elegant billiard-table green",
    bg:"#f5f2eb", panel:"#ffffff", ink:"0,0,0", textColor:"#2d2a24",
    border:"rgba(34,139,84,0.16)", borderB:"rgba(0,0,0,0.06)",
    cyan:"#228b54", blue:"#4682b4", purple:"#6b5b73",
    orange:"#cd853f", red:"#c0392b", yellow:"#b8860b", green:"#228b54",
    dim:"rgba(0,0,0,0.36)", dimmer:"rgba(0,0,0,0.14)",
    headingFont:"'Playfair Display',serif", monoFont:"'DM Mono',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=DM+Mono:wght@400;500&display=swap",
    bgGradient:"radial-gradient(ellipse 55% 30% at 50% 0%, rgba(34,139,84,0.05) 0%, transparent 70%)",
    scrollThumb:"rgba(34,139,84,0.18)",
    titleGradient:"linear-gradient(135deg,#228b54,#b8860b)",
    topbarBg:"rgba(245,242,235,0.97)",
    preview:["#228b54","#4682b4","#cd853f","#c0392b"],
    insetBg:"rgba(0,0,0,0.035)", floatShadow:"rgba(0,0,0,0.1)",
  },
  nightclub: {
    id:"nightclub", name:"Nightclub", desc:"Dark lounge with teal & amber",
    bg:"#1a1a1f", panel:"#222228", ink:"255,255,255", textColor:"#fff",
    border:"rgba(0,188,188,0.14)", borderB:"rgba(255,255,255,0.06)",
    cyan:"#00bcbc", blue:"#5dade2", purple:"#a569bd",
    orange:"#d4a048", red:"#e74c3c", yellow:"#f0c040", green:"#1abc9c",
    dim:"rgba(255,255,255,0.30)", dimmer:"rgba(255,255,255,0.13)",
    headingFont:"'Cormorant Garamond',serif", monoFont:"'Fira Code',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Fira+Code:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 55% 35% at 50% 0%, rgba(0,188,188,0.04) 0%, rgba(212,160,72,0.025) 50%, transparent 70%)",
    scrollThumb:"rgba(0,188,188,0.16)",
    titleGradient:"linear-gradient(135deg,#00bcbc,#d4a048)",
    topbarBg:"rgba(26,26,31,0.97)",
    preview:["#00bcbc","#d4a048","#a569bd","#5dade2"],
    insetBg:"rgba(0,0,0,0.18)", floatShadow:"rgba(0,0,0,0.45)",
  },
  hightech: {
    id:"hightech", name:"Hightech", desc:"Industrial gray & orange sci-fi",
    bg:"#e2e4e8", panel:"#eff0f2", ink:"0,0,0", textColor:"#1a1a1a",
    border:"rgba(230,126,34,0.18)", borderB:"rgba(0,0,0,0.07)",
    cyan:"#e67e22", blue:"#3498db", purple:"#8e44ad",
    orange:"#e67e22", red:"#c0392b", yellow:"#f39c12", green:"#27ae60",
    dim:"rgba(0,0,0,0.38)", dimmer:"rgba(0,0,0,0.14)",
    headingFont:"'Exo 2',sans-serif", monoFont:"'Share Tech Mono',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800;900&family=Share+Tech+Mono&display=swap",
    bgGradient:"radial-gradient(ellipse 55% 30% at 50% 0%, rgba(230,126,34,0.06) 0%, transparent 70%)",
    scrollThumb:"rgba(230,126,34,0.18)",
    titleGradient:"linear-gradient(135deg,#e67e22,#f39c12)",
    topbarBg:"rgba(226,228,232,0.97)",
    preview:["#e67e22","#3498db","#8e44ad","#27ae60"],
    insetBg:"rgba(0,0,0,0.04)", floatShadow:"rgba(0,0,0,0.1)",
  },
  cosmos: {
    id:"cosmos", name:"Cosmos", desc:"Deep space midnight blue",
    bg:"#080c18", panel:"#0d1224", ink:"255,255,255", textColor:"#fff",
    border:"rgba(52,152,219,0.12)", borderB:"rgba(255,255,255,0.05)",
    cyan:"#3498db", blue:"#5dade2", purple:"#a78bfa",
    orange:"#f0932b", red:"#ee5a24", yellow:"#ffc312", green:"#1abc9c",
    dim:"rgba(255,255,255,0.28)", dimmer:"rgba(255,255,255,0.12)",
    headingFont:"'Orbitron',sans-serif", monoFont:"'JetBrains Mono',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 70% 40% at 50% 0%, rgba(52,152,219,0.04) 0%, rgba(167,139,250,0.025) 45%, transparent 70%)",
    scrollThumb:"rgba(52,152,219,0.14)",
    titleGradient:"linear-gradient(135deg,#3498db,#5dade2)",
    topbarBg:"rgba(8,12,24,0.97)",
    preview:["#3498db","#5dade2","#a78bfa","#1abc9c"],
    insetBg:"rgba(0,0,0,0.18)", floatShadow:"rgba(0,0,0,0.45)",
  },
  redline: {
    id:"redline", name:"Redline", desc:"Clean white with bold red",
    bg:"#f4f5f7", panel:"#ffffff", ink:"0,0,0", textColor:"#111827",
    border:"rgba(220,38,38,0.14)", borderB:"rgba(0,0,0,0.06)",
    cyan:"#dc2626", blue:"#3b82f6", purple:"#7c3aed",
    orange:"#f97316", red:"#dc2626", yellow:"#eab308", green:"#22c55e",
    dim:"rgba(0,0,0,0.38)", dimmer:"rgba(0,0,0,0.14)",
    headingFont:"'Inter',sans-serif", monoFont:"'IBM Plex Mono',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=IBM+Plex+Mono:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 55% 30% at 50% 0%, rgba(220,38,38,0.04) 0%, transparent 70%)",
    scrollThumb:"rgba(220,38,38,0.16)",
    titleGradient:"linear-gradient(135deg,#dc2626,#ef4444)",
    topbarBg:"rgba(255,255,255,0.97)",
    preview:["#dc2626","#3b82f6","#7c3aed","#22c55e"],
    insetBg:"rgba(0,0,0,0.04)", floatShadow:"rgba(0,0,0,0.1)",
  },
  shooters: {
    id:"shooters", name:"Shooters", desc:"Gritty dark burnt-orange FPS",
    bg:"#0e0e0e", panel:"#181818", ink:"255,255,255", textColor:"#fff",
    border:"rgba(204,120,50,0.14)", borderB:"rgba(255,255,255,0.06)",
    cyan:"#cc7832", blue:"#6897bb", purple:"#9876aa",
    orange:"#cc7832", red:"#bc3f3c", yellow:"#bbb529", green:"#6a8759",
    dim:"rgba(255,255,255,0.32)", dimmer:"rgba(255,255,255,0.14)",
    headingFont:"'Rajdhani',sans-serif", monoFont:"'Fira Code',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Fira+Code:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 50% 35% at 50% 0%, rgba(204,120,50,0.04) 0%, transparent 70%)",
    scrollThumb:"rgba(204,120,50,0.16)",
    titleGradient:"linear-gradient(135deg,#cc7832,#bbb529)",
    topbarBg:"rgba(14,14,14,0.97)",
    preview:["#cc7832","#6897bb","#9876aa","#6a8759"],
    insetBg:"rgba(0,0,0,0.2)", floatShadow:"rgba(0,0,0,0.5)",
  },
  metallic: {
    id:"metallic", name:"Metallic", desc:"Polished gray with amber accents",
    bg:"#e8e9ec", panel:"#f2f3f5", ink:"0,0,0", textColor:"#1a1a2e",
    border:"rgba(243,156,18,0.16)", borderB:"rgba(0,0,0,0.07)",
    cyan:"#f39c12", blue:"#2980b9", purple:"#8e44ad",
    orange:"#f39c12", red:"#e74c3c", yellow:"#f1c40f", green:"#27ae60",
    dim:"rgba(0,0,0,0.38)", dimmer:"rgba(0,0,0,0.14)",
    headingFont:"'Saira',sans-serif", monoFont:"'Source Code Pro',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Saira:wght@500;600;700;800&family=Source+Code+Pro:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 55% 30% at 50% 0%, rgba(243,156,18,0.05) 0%, transparent 70%)",
    scrollThumb:"rgba(243,156,18,0.18)",
    titleGradient:"linear-gradient(135deg,#f39c12,#f1c40f)",
    topbarBg:"rgba(232,233,236,0.97)",
    preview:["#f39c12","#2980b9","#8e44ad","#27ae60"],
    insetBg:"rgba(0,0,0,0.04)", floatShadow:"rgba(0,0,0,0.1)",
  },
  wasteland: {
    id:"wasteland", name:"Wasteland", desc:"Post-apocalyptic olive & lime",
    bg:"#0c0d08", panel:"#141510", ink:"255,255,255", textColor:"#fff",
    border:"rgba(164,198,57,0.14)", borderB:"rgba(255,255,255,0.06)",
    cyan:"#a4c639", blue:"#7cb342", purple:"#8d6e63",
    orange:"#ff8f00", red:"#d32f2f", yellow:"#c0ca33", green:"#a4c639",
    dim:"rgba(255,255,255,0.32)", dimmer:"rgba(255,255,255,0.14)",
    headingFont:"'Teko',sans-serif", monoFont:"'Fira Code',monospace",
    fontUrl:"https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Fira+Code:wght@400;600&display=swap",
    bgGradient:"radial-gradient(ellipse 50% 35% at 50% 0%, rgba(164,198,57,0.04) 0%, transparent 70%)",
    scrollThumb:"rgba(164,198,57,0.16)",
    titleGradient:"linear-gradient(135deg,#a4c639,#c0ca33)",
    topbarBg:"rgba(12,13,8,0.97)",
    preview:["#a4c639","#c0ca33","#ff8f00","#d32f2f"],
    insetBg:"rgba(0,0,0,0.2)", floatShadow:"rgba(0,0,0,0.45)",
  },
};
let T = THEMES.cosmos;
/* ink helper — returns rgba using the theme's ink channel (white for dark, black for light) */
function ink(a) { return `rgba(${T.ink},${a})`; }

/* API */
const API_BASE = window.location.origin;

/* PIPELINE STAGES */
/* Separated into three groups:
   - MONITORS: File Watch + Recommender (always-on, independent of builds)
   - BUILD PIPELINE: Astro Build -> S3 Sync -> CDN Invalidate -> Live (triggered by buttons)
   - STANDALONE: Lambda Deploy (its own workflow)
*/
const _MONITOR_STAGES = [
  { key:"watcher",     label:"File Watch",     sub:"Monitoring source files", icon:"FW",   colKey:"cyan"   },
  { key:"recommender", label:"Recommender",    sub:"Similarity pipeline",     icon:"REC",  colKey:"yellow" },
];
const _BUILD_STAGES = [
  { key:"building",    label:"Astro Build",    sub:"npm run build | SSG",        icon:"BUILD", colKey:"blue"   },
  { key:"syncing",     label:"S3 Sync",        sub:"quick sync | full mirror",   icon:"S3",    colKey:"purple" },
  { key:"cdn",         label:"CDN Invalidate", sub:"CloudFront | live manifest", icon:"CDN",   colKey:"green"  },
  { key:"done",        label:"Live",           sub:"All systems green",          icon:"LIVE",  colKey:"cyan"   },
];
const _LAMBDA_DEPLOY_STAGES = [
  { key:"lambda-package", label:"Packaging Lambda Artifact", sub:"Prepare runtime bundle",       icon:"PKG",  colKey:"orange" },
  { key:"lambda-upload",  label:"Uploading Lambda Artifact", sub:"Upload zip to artifact bucket", icon:"UP",   colKey:"yellow" },
  { key:"lambda-deploy",  label:"Deploy Stack",              sub:"Update CloudFormation stack",   icon:"CFN",  colKey:"blue"   },
  { key:"lambda-live",    label:"Refresh Stack Outputs",     sub:"Read live outputs",             icon:"LIVE", colKey:"cyan"   },
];
const SITE_STAGE_ORDER = _BUILD_STAGES.map(s=>s.key);
const SITE_STAGE_KEY_MAP = {
  building: "build",
  syncing: "sync",
  cdn: "cdn",
};
const LAMBDA_STAGE_ORDER = _LAMBDA_DEPLOY_STAGES.map(s=>s.key);
const STAGE_PROGRESS = {
  idle:0,
  recommender:15,
  building:35,
  syncing:65,
  cdn:85,
  "lambda-package":25,
  "lambda-upload":50,
  "lambda-deploy":75,
  "lambda-live":95,
  done:100,
};
const SITE_PROGRESS_SMOOTHING_INTERVAL_MS = 80;
const _S3_SYNC_SUBTABS = [
  { key:"data-upload", label:"DATA UPLOAD", scope:"data", op:"upload", colorKey:"blue" },
  { key:"images-upload", label:"IMAGES UPLOAD", scope:"images", op:"upload", colorKey:"purple" },
  { key:"data-delete", label:"DATA DELETE", scope:"data", op:"delete", colorKey:"orange" },
  { key:"images-delete", label:"IMAGES DELETE", scope:"images", op:"delete", colorKey:"red" },
];
const _CHANGED_FILE_SUBTABS = [
  { key:"files", label:"FILES", colorKey:"yellow" },
  { key:"images", label:"IMAGES", colorKey:"blue" },
];

const _CATEGORY_META = {
  assets: { color: ink(0.3), icon: "AST" },
  headsets: { colorKey: "orange", icon: "HEAD" },
  keyboards: { colorKey: "purple", icon: "KEY" },
  mice: { colorKey: "green", icon: "MICE" },
  monitors: { colorKey: "blue", icon: "MON" },
  news: { color: "#f472b6", icon: "NEWS" },
  root: { colorKey: "cyan", icon: "ROOT" },
};

const LAMBDA_WATCH_PATHS = [
  "src/pages/api/",
  "src/pages/auth/",
  "src/pages/login/",
  "src/pages/logout.ts",
  "src/features/auth/server/",
  "src/features/search/",
];

const DB_SYNC_WATCH_PATHS = [
  "data-products/**",
  "reviews/*/index.*",
  "guides/*/index.*",
  "news/*/index.*",
  "brands/*/index.*",
  "games/*/index.*",
];


/* HELPERS */
function classifyLineKind(line) {
  if (line.startsWith("upload:"))                              return "upload";
  if (line.startsWith("delete:"))                              return "delete";
  if (line.includes("error") || line.includes("FAILED"))       return "delete";
  if (line.includes("complete") || line.includes("Complete")
      || line.includes("Done"))                                return "done";
  if (line.includes("/index.html") || line.includes(".html"))  return "built";
  if (line.startsWith("[") || line.startsWith(">")
      || line.startsWith("Starting:"))                         return "info";
  return "ok";
}

function classifySyncFileScope(line) {
  return /(^|[\\/])images([\\/]|$)/i.test(line) ? "images" : "data";
}

function formatIssueTypeLabel(key) {
  const labels = {
    unresolvedLinks: "Unresolved Links",
    orphanPages: "Orphan Pages",
    canonicalMismatches: "Canonical Mismatches",
    sitemapMismatches: "Sitemap Mismatches",
    noindexLeaks: "Noindex Leaks",
    duplicateCanonicals: "Duplicate Canonicals",
  };
  return labels[key] || key;
}

function getMatrixCategoryFromRoutePath(routePath) {
  const parts = `${routePath}`.split("/").filter(Boolean);
  return parts[0] || "root";
}

function upsertMatrixRowForRoute(rows, routePath, status) {
  const nextElapsed = status === "failed" ? "failed" : "done";
  const nextRow = {
    id: routePath,
    path: routePath,
    cat: getMatrixCategoryFromRoutePath(routePath),
    status,
    pct: 100,
    elapsed: nextElapsed,
    changed: true,
  };
  const existingRow = rows.find(row => row.path === routePath);
  if (!existingRow) {
    return [...rows, nextRow];
  }
  return rows.map(row => {
    if (row.path !== routePath) return row;
    return {
      ...row,
      cat: row.cat || nextRow.cat,
      changed: true,
      status,
      pct: 100,
      elapsed: row.elapsed === "--" ? nextElapsed : row.elapsed,
    };
  });
}

function parseS3TransferSummaryLine(line) {
  const match = `${line}`.match(
    /^\[static\]\s+(.+?):\s+(\d+)\s+uploads,\s+(\d+)\s+deletes,\s+(\d+)\s+copies,\s+(\d+)\s+warnings$/i
  );
  if (!match) return null;
  return {
    label: match[1],
    uploads: Number.parseInt(match[2], 10),
    deletes: Number.parseInt(match[3], 10),
    copies: Number.parseInt(match[4], 10),
    warnings: Number.parseInt(match[5], 10),
  };
}

function buildCdnPathMetrics(paths) {
  const uniquePaths = [...new Set((paths || []).map(path => `${path}`.trim()).filter(Boolean))];
  const wildcardPathCount = uniquePaths.filter(path => path.includes("*")).length;
  return {
    paths: uniquePaths,
    pathCount: uniquePaths.length,
    wildcardPathCount,
    exactPathCount: uniquePaths.length - wildcardPathCount,
  };
}

function parseCdnSubmissionLine(line) {
  const match = `${line}`.match(/^\[cdn\]\s+submitting\s+(\d+)\s+path\(s\)\s+across\s+(\d+)\s+invalidation group\(s\)$/i);
  if (!match) return null;
  return {
    pathCount: Number.parseInt(match[1], 10),
    groupCount: Number.parseInt(match[2], 10),
  };
}

function parseCdnGroupLine(line) {
  const match = `${line}`.match(/^\[cdn\]\s+group\s+(\d+)\/(\d+)\s+invalidating\s+(.+)$/i);
  if (!match) return null;
  return {
    currentGroup: Number.parseInt(match[1], 10),
    groupCount: Number.parseInt(match[2], 10),
    ...buildCdnPathMetrics(match[3].split(",").map(path => path.trim())),
  };
}

function parseCdnInvalidationSummaryLine(line) {
  const match = `${line}`.match(/^\[cdn\]\s+invalidation\s+([A-Z0-9]+)\s+([A-Za-z]+)\s+for\s+(\d+)\s+paths$/i);
  if (!match) return null;
  return {
    invalidationId: match[1],
    status: match[2].toUpperCase(),
    pathCount: Number.parseInt(match[3], 10),
  };
}

function parseCdnStatusLine(line) {
  const match = `${line}`.match(/^\[cdn\]\s+invalidation\s+([A-Z0-9]+)\s+status\s+([A-Za-z]+)$/i);
  if (!match) return null;
  return {
    invalidationId: match[1],
    status: match[2].toUpperCase(),
  };
}

function parseCdnCommandLine(line) {
  if (!`${line}`.startsWith("> aws cloudfront ")) return null;
  const distributionMatch = `${line}`.match(/--distribution-id\s+(\S+)/);
  const invalidationMatch = `${line}`.match(/--id\s+(\S+)/);
  const action = `${line}`.includes("create-invalidation")
    ? "create-invalidation"
    : `${line}`.includes("get-invalidation")
      ? "get-invalidation"
      : "";
  return {
    action,
    distributionId: distributionMatch?.[1] || "",
    invalidationId: invalidationMatch?.[1] || "",
    command: `${line}`.replace(/^>\s*/, ""),
  };
}

function parseCdnErrorLine(line) {
  const match = `${line}`.match(/^An error occurred \(([^)]+)\) when calling the ([A-Za-z]+) operation:\s+(.+)$/i);
  if (!match) return null;
  return {
    code: match[1],
    operation: match[2],
    message: match[3],
  };
}

function createEmptyCdnMetrics() {
  return {
    mode: "",
    distributionId: "",
    plannedPaths: [],
    plannedPathCount: 0,
    wildcardPathCount: 0,
    exactPathCount: 0,
    groupCount: 0,
    currentGroup: 0,
    createdInvalidationIds: [],
    completedInvalidationIds: [],
    unverifiedInvalidationIds: [],
    lastInvalidationId: "",
    lastInvalidationStatus: "",
    currentAction: "",
    currentCommand: "",
    lastErrorCode: "",
    lastErrorMessage: "",
    lastPermissionAction: "",
    ...createEmptyCdnPathResolutionState(),
  };
}

function timeAgo(iso) {
  if (!iso) return "--";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "--";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SIDEBAR_PANEL_HEIGHTS = {
  changedFiles: 420,
  infraDependencies: 480,
  deployHistory: 170,
  serverHealth: 190,
};

const MAIN_BODY_PANEL_HEIGHT = 1200;

const SITE_BUILD_PANEL_TABS = [
  { key:"terminal", label:"Terminal Log" },
  { key:"matrix", label:"Page Build Matrix" },
  { key:"categories", label:"Category Rings" },
  { key:"s3sync", label:"S3 Sync" },
  { key:"cdntab", label:"CDN" },
];

const LAMBDA_PANEL_TAB = { key:"lambda", label:"Lambda Deploy" };

function statusColor(status) {
  if (status === "success" || status === "healthy") return T.green;
  if (status === "warning") return T.yellow;
  if (status === "failed" || status === "error") return T.red;
  return T.blue;
}

function formatMetricValue(metric) {
  if (typeof metric?.value !== "number") return "--";
  if (metric.unit === "%") return `${Math.round(metric.value)}${metric.unit}`;
  if (metric.unit === "GB" || metric.unit === "MB") return `${metric.value.toFixed(1)}${metric.unit}`;
  return `${metric.value}${metric.unit || ""}`;
}

function formatDeployHistoryDetail(entry) {
  if (entry.kind === "lambda") {
    return entry.lambdaVersion != null ? `v${entry.lambdaVersion}` : "config sync";
  }
  if (entry.kind === "db-sync") {
    return "products + articles → RDS";
  }
  if (entry.kind === "cdn") {
    return entry.cdnPaths > 0 ? `${entry.cdnPaths} path${entry.cdnPaths !== 1 ? "s" : ""} invalidated` : "full invalidation";
  }
  return `${entry.uploaded || 0} up | ${entry.deleted || 0} del | ${entry.cdnPaths || 0} cdn`;
}

function deployHistoryLabelColor(entry) {
  if (entry.label === "Full") return T.orange;
  if (entry.kind === "lambda") return T.yellow;
  if (entry.kind === "db-sync") return T.purple;
  if (entry.kind === "cdn") return T.green;
  return T.blue;
}

function deployHistoryLabelBg(entry) {
  if (entry.label === "Full") return T.orange+"1e";
  if (entry.kind === "lambda") return T.yellow+"1e";
  if (entry.kind === "db-sync") return T.purple+"1e";
  if (entry.kind === "cdn") return T.green+"1e";
  return T.blue+"1a";
}

/* SMALL COMPONENTS */
function Ring({ value, max, color, size=44, stroke=4 }) {
  const r = (size-stroke)/2, circ = 2*Math.PI*r, pct = max>0?Math.min(value/max,1):0;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ink(0.06)} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.25s ease",filter:`drop-shadow(0 0 4px ${color})`}}/>
    </svg>
  );
}

function ProgressBar({ pct, color, h=3 }) {
  return (
    <div style={{height:h,background:ink(0.06),borderRadius:h,overflow:"hidden",width:"100%"}}>
      <div style={{height:"100%",background:color,borderRadius:h,width:`${pct}%`,transition:"width 0.4s ease",boxShadow:`0 0 5px ${color}88`}}/>
    </div>
  );
}

function StatusBadge({ status, small }) {
  const STATUS_CFG = {
    success:  { color:T.green, bg:T.green+"1e", label:"SUCCESS"  },
    building: { color:T.blue, bg:T.blue+"1e", label:"BUILDING" },
    queued:   { color:T.yellow, bg:T.yellow+"1e", label:"QUEUED"   },
    failed:   { color:T.red, bg:T.red+"1e", label:"FAILED"   },
    idle:     { color:ink(0.25), bg:ink(0.05), label:"IDLE" },
    watching: { color:T.cyan, bg:T.cyan+"18", label:"WATCHING" },
    deploying:{ color:T.orange, bg:T.orange+"1e", label:"DEPLOYING"},
    healthy:  { color:T.green, bg:T.green+"1e", label:"HEALTHY"  },
    warning:  { color:T.yellow, bg:T.yellow+"1e", label:"WARNING"  },
    error:    { color:T.red, bg:T.red+"1e", label:"ERROR"    },
  };
  const cfg = STATUS_CFG[status] || STATUS_CFG.idle;
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      background:cfg.bg, color:cfg.color,
      border:`1px solid ${cfg.color}44`,
      borderRadius:4, padding: small?"1px 6px":"3px 8px",
      fontFamily:"monospace", fontSize: small?7:9,
      fontWeight:700, letterSpacing:0.8, whiteSpace:"nowrap",
    }}>
      {status==="building" && <span style={{width:5,height:5,borderRadius:"50%",border:`1.5px solid ${cfg.color}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>}
      {status==="watching" && <span style={{width:5,height:5,borderRadius:"50%",background:cfg.color,boxShadow:`0 0 5px ${cfg.color}`,display:"inline-block",animation:"pulse 1.5s ease-in-out infinite"}}/>}
      {cfg.label}
    </span>
  );
}

function TermLine({ text, kind }) {
  const c = {ok:T.green,built:T.blue,done:T.cyan,info:T.yellow,upload:T.purple,delete:T.red}[kind]||ink(0.4);
  return (
    <div style={{fontFamily:"monospace",fontSize:10,lineHeight:1.7,color:c,
      animation:"slideUp 0.12s ease forwards",opacity:0,
      whiteSpace:"pre-wrap",overflowWrap:"anywhere",wordBreak:"break-word",
      textShadow:["ok","upload","done","built"].includes(kind)?`0 0 8px ${c}44`:"none",
    }}>{text}</div>
  );
}

const PANEL_LOADING_META = {
  "Deployment Vitals": {
    kicker: "Telemetry",
    headline: "Preparing metrics feed",
    detail: "Collecting build identifiers, transfer counters, and live deployment vitals.",
    glyph: "vitals",
  },
  "S3 State & Sync": {
    kicker: "Storage",
    headline: "Checking sync surface",
    detail: "Reconciling object deltas, managed resources, and CDN-facing file state.",
    glyph: "sync",
  },
  "Lambda Command Center": {
    kicker: "Lambda",
    headline: "Resolving Lambda inventory",
    detail: "Reviewing watched paths and pending Lambda changes before rendering function cards.",
    glyph: "lambda",
  },
  "Operation Storyboard": {
    kicker: "Workflow",
    headline: "Mapping active stages",
    detail: "Loading operator milestones, stage transitions, and current progress markers.",
    glyph: "pipeline",
  },
  "Completion Summary": {
    kicker: "Summary",
    headline: "Calculating deployment totals",
    detail: "Summarizing pages, uploads, deletes, CDN paths, and Lambda version state.",
    glyph: "summary",
  },
  "Changed Files": {
    kicker: "Diff",
    headline: "Scanning changed files",
    detail: "Building the operator file list with categories, timestamps, and status badges.",
    glyph: "files",
  },
  "Infra Dependencies": {
    kicker: "Infra",
    headline: "Resolving live dependency status",
    detail: "Loading deploy resources, Lambda ownership paths, and operator-facing health checks.",
    glyph: "database",
  },
};

function PanelLoadingOverlay({ title, accent }) {
  const meta = PANEL_LOADING_META[title] || {
    kicker: "Loading",
    headline: `Preparing ${title}`,
    detail: "Collecting the latest operator data for this section.",
    glyph: "default",
  };
  const tone = accent || T.cyan;

  const glyph = (() => {
    if (meta.glyph === "vitals") {
      return (
        <>
          <rect x="14" y="34" width="8" height="14" rx="2" fill={tone} opacity="0.35"/>
          <rect x="28" y="24" width="8" height="24" rx="2" fill={tone} opacity="0.6"/>
          <rect x="42" y="18" width="8" height="30" rx="2" fill={tone} opacity="0.9"/>
          <path d="M12 44h40" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
        </>
      );
    }
    if (meta.glyph === "sync") {
      return (
        <>
          <path d="M18 20h28l4 8H14z" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M20 34h10m4 0h10" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
          <path d="M24 46c2 3 5 4 8 4 6 0 10-4 11-9" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
          <path d="M41 38l3 3-4 2" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M40 18c-2-3-5-4-8-4-6 0-10 4-11 9" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
          <path d="M23 26l-3-3 4-2" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      );
    }
    if (meta.glyph === "lambda") {
      return (
        <>
          <circle cx="18" cy="18" r="5" fill={tone} opacity="0.25"/>
          <circle cx="46" cy="18" r="5" fill={tone} opacity="0.45"/>
          <circle cx="18" cy="46" r="5" fill={tone} opacity="0.45"/>
          <circle cx="46" cy="46" r="5" fill={tone} opacity="0.25"/>
          <path d="M22 42l12-20 8 20" fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M26 34h12" fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M22 18h20M18 22v20M46 22v20" fill="none" stroke={tone} strokeWidth="1.4" opacity="0.55"/>
        </>
      );
    }
    if (meta.glyph === "pipeline") {
      return (
        <>
          {[14, 28, 42, 56].map((x, i) => <circle key={x} cx={x} cy="32" r="4" fill={tone} opacity={0.25 + (i * 0.18)}/>)}
          <path d="M18 32h6m8 0h6m8 0h6" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
          <rect x="10" y="24" width="8" height="16" rx="3" fill="none" stroke={tone} strokeWidth="1.6"/>
          <rect x="24" y="22" width="8" height="20" rx="3" fill="none" stroke={tone} strokeWidth="1.6"/>
          <rect x="38" y="20" width="8" height="24" rx="3" fill="none" stroke={tone} strokeWidth="1.6"/>
          <rect x="52" y="18" width="8" height="28" rx="3" fill="none" stroke={tone} strokeWidth="1.6"/>
        </>
      );
    }
    if (meta.glyph === "summary") {
      return (
        <>
          <rect x="16" y="16" width="32" height="32" rx="8" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M22 26h20M22 34h12M22 42h16" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
          <circle cx="44" cy="40" r="6" fill={tone} opacity="0.2"/>
          <path d="M41 40l2 2 4-5" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      );
    }
    if (meta.glyph === "files") {
      return (
        <>
          <path d="M20 16h18l6 6v24H20z" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M38 16v8h8" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M26 30h12M26 36h12M26 42h8" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
        </>
      );
    }
    if (meta.glyph === "database") {
      return (
        <>
          <ellipse cx="32" cy="18" rx="14" ry="6" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M18 18v18c0 3 6 6 14 6s14-3 14-6V18" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M18 28c0 3 6 6 14 6s14-3 14-6" fill="none" stroke={tone} strokeWidth="2"/>
        </>
      );
    }
    if (meta.glyph === "history") {
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="none" stroke={tone} strokeWidth="2"/>
          <path d="M32 22v11l7 4" fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M18 18l-4 4m0-4h4" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      );
    }
    if (meta.glyph === "health") {
      return (
        <>
          <path d="M14 36h8l4-10 6 16 4-8h14" fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 48h40" stroke={tone} strokeWidth="1.6" opacity="0.4"/>
        </>
      );
    }
    return (
      <>
        <circle cx="32" cy="32" r="16" fill="none" stroke={tone} strokeWidth="2"/>
        <path d="M24 32h16M32 24v16" stroke={tone} strokeWidth="2" strokeLinecap="round"/>
      </>
    );
  })();

  return (
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:`linear-gradient(180deg, ${T.bg}c2, ${T.bg}eb)`,backdropFilter:"blur(2px)",zIndex:2}}>
      <div style={{display:"grid",gridTemplateColumns:"72px minmax(0,1fr)",alignItems:"center",gap:14,minWidth:320,maxWidth:420,padding:"16px 18px",border:`1px solid ${tone}`,borderRadius:14,background:"linear-gradient(180deg, ${ink(0.04)}, ${ink(0.02)})",boxShadow:`0 18px 34px ${T.floatShadow}, inset 0 1px 0 ${ink(0.04)}`}}>
        <div style={{width:72,height:72,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",background:`radial-gradient(circle at 50% 40%, ${ink(0.08)}, ${ink(0.02)})`,border:`1px solid ${ink(0.08)}`}}>
          <svg viewBox="0 0 64 64" style={{width:54,height:54,display:"block",animation:"spin 3.8s linear infinite"}}>
            <circle cx="32" cy="32" r="24" fill="none" stroke={ink(0.08)} strokeWidth="1.6" strokeDasharray="2 5"/>
            {glyph}
          </svg>
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:"monospace",fontSize:7,color:tone,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>{meta.kicker}</div>
          <div style={{fontFamily:T.headingFont,fontSize:16,fontWeight:800,color:ink(0.88),lineHeight:1.15,marginBottom:6}}>{meta.headline}</div>
          <div style={{fontFamily:"monospace",fontSize:8.5,color:ink(0.46),lineHeight:1.55}}>{meta.detail}</div>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon, children, accent, style: sx, loading, headerRight }) {
  return (
    <div style={{background:T.panel,border:`1px solid ${accent||T.border}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column",...sx}}>
      <div style={{padding:"9px 14px",borderBottom:`1px solid ${accent||T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",background:T.insetBg}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:7,minWidth:0,flex:"1 1 auto"}}>
          {icon && <span style={{fontSize:13}}>{icon}</span>}
          <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:accent||T.cyan,letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap"}}>{title}</span>
          {loading && (
            <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:999,border:`1px solid ${accent||T.cyan}22`,background:ink(0.04),fontFamily:"monospace",fontSize:7,color:ink(0.35),letterSpacing:0.7,textTransform:"uppercase",whiteSpace:"nowrap"}}>
              <span style={{width:8,height:8,borderRadius:"50%",border:`1.5px solid ${accent||T.cyan}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>
              Loading
            </span>
          )}
        </div>
        {headerRight && (
          <div style={{display:"inline-flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {headerRight}
          </div>
        )}
      </div>
      <div style={{padding:"12px 14px",position:"relative",minHeight:0,display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
        {loading && (
          <PanelLoadingOverlay title={title} accent={accent||T.cyan} />
        )}
        <div style={{opacity:loading?0.18:1,transition:"opacity 0.15s ease",display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* MATRIX ROW */
function MatrixRow({ row, isRunning, categoryMeta }) {
  const live = isRunning && row.status === "building";
  const displayPct = isRunning && row.status === "building" ? Math.max(row.pct, 1) : row.pct;
  const catColor = (categoryMeta[row.cat] || {}).color || T.dim;
  const pctColor = row.status==="success"?T.green:row.status==="building"?T.blue:row.status==="failed"?T.red:T.yellow;

  return (
    <div style={{
      display:"grid",gridTemplateColumns:"90px 1fr 160px 80px 64px 90px",
      alignItems:"center",gap:10,
      padding:"6px 14px",
      borderBottom:`1px solid ${ink(0.04)}`,
      background: row.changed?T.cyan+"06":"transparent",
      transition:"background 0.2s",
    }}>
      <StatusBadge status={live?"building":row.status}/>

      <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
        <span style={{width:3,height:3,borderRadius:"50%",background:catColor,flexShrink:0,boxShadow:`0 0 4px ${catColor}`}}/>
        <span style={{fontFamily:"monospace",fontSize:9.5,color:ink(0.6),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.path}</span>
        {row.changed && <span style={{fontFamily:"monospace",fontSize:7,color:T.cyan,background:T.cyan+"1e",padding:"0 4px",borderRadius:2,flexShrink:0}}>CHANGED</span>}
      </div>

      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <ProgressBar pct={displayPct} color={pctColor} h={4}/>
        <span style={{fontFamily:"monospace",fontSize:9,color:pctColor,width:28,textAlign:"right",flexShrink:0}}>{displayPct}%</span>
      </div>

      <span style={{fontFamily:"monospace",fontSize:9,color:ink(0.35),textAlign:"center"}}>{row.elapsed}</span>

      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
        <button style={{background:ink(0.05),border:`1px solid ${ink(0.1)}`,borderRadius:3,padding:"2px 5px",cursor:"pointer",color:ink(0.3),fontFamily:"monospace",fontSize:8}}>LOG</button>
        <button style={{background:ink(0.05),border:`1px solid ${ink(0.1)}`,borderRadius:3,padding:"2px 5px",cursor:"pointer",color:T.red+"99",fontFamily:"monospace",fontSize:8}}>X</button>
      </div>

      <button style={{
        background: row.status==="failed"?T.red+"1a":ink(0.04),
        border:`1px solid ${row.status==="failed"?T.red+"4d":ink(0.09)}`,
        borderRadius:4,padding:"2px 8px",cursor:"pointer",
        color:row.status==="failed"?T.red:ink(0.28),
        fontFamily:"monospace",fontSize:8,letterSpacing:0.5,
      }}>{row.status==="failed"?"Retry Build":"Cancel Build"}</button>
    </div>
  );
}

function TooltipAnchor({ heading, body, children, align="left", style }) {
  return (
    <span className={`tooltip-anchor tooltip-${align}`} style={style} tabIndex={0}>
      {children}
      <span className="tooltip-bubble" role="tooltip">
        <span className="tooltip-heading">{heading}</span>
        <span className="tooltip-body">{body}</span>
      </span>
    </span>
  );
}

/* LAMBDA CARD */
function LambdaCard({ fn, isDeploying }) {
  const s = isDeploying && fn.changed ? "deploying" : fn.status;
  const lambdaFacts = [
    {
      value: fn.runtime,
      label: "runtime",
      heading: "Runtime",
      body: "Shown in AWS Lambda configuration as Runtime. This defines the managed execution environment AWS boots for the function, including language support, available base image updates, and patch cadence.",
    },
    {
      value: fn.mem,
      label: "memory",
      heading: "Memory",
      body: "Shown in AWS Lambda configuration as Memory. This controls RAM allocation and also scales the CPU share Lambda assigns to each invocation.",
    },
    {
      value: fn.timeout,
      label: "timeout",
      heading: "Timeout",
      body: "Shown in AWS Lambda configuration as Timeout. This is the maximum execution duration before AWS terminates the invocation and marks it as timed out.",
    },
  ];
  return (
    <div style={{
      background:s==="watching"?T.cyan+"0a":s==="deploying"?T.orange+"0d":ink(0.02),
      border:`1px solid ${s==="watching"?T.cyan+"33":s==="deploying"?T.orange+"33":T.borderB}`,
      borderRadius:9,padding:"11px 13px",flex:1,
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <TooltipAnchor
            heading="Service Type"
            body="Shown in AWS as a Lambda function under Lambda > Functions. This card summarizes one serverless compute function and its deployment-critical configuration."
          >
            <span style={{fontFamily:"monospace",fontSize:10,color:T.orange,fontWeight:700}}>LAMBDA</span>
          </TooltipAnchor>
          <TooltipAnchor
            heading="Function Name"
            body={`Shown in AWS Lambda console as Function name. Operators use this name to find the function in the Lambda console, logs, event triggers, and deployment automation. Purpose: ${fn.purpose}`}
          >
            <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:ink(0.8)}}>{fn.name}</span>
          </TooltipAnchor>
          {fn.changed && (
            <TooltipAnchor
              heading="Local Change Detected"
              body="This is a dashboard status, not an AWS Lambda console state. It means code mapped to this function changed locally since the last successful Lambda deploy."
            >
              <span style={{fontSize:7,fontFamily:"monospace",color:T.cyan,background:T.cyan+"1e",padding:"1px 5px",borderRadius:2}}>CHANGED</span>
            </TooltipAnchor>
          )}
        </div>
        <TooltipAnchor
          heading="Dashboard Status"
          body={`Displayed here as ${s.toUpperCase()}. This is a dashboard status, not an AWS Lambda console state. It shows whether this function is idle, being watched for mapped source changes, or actively deploying.`}
          align="right"
        >
          <span style={{display:"inline-flex"}}>
            <StatusBadge status={s} small/>
          </span>
        </TooltipAnchor>
      </div>
      <TooltipAnchor
        heading="Function Purpose"
        body={fn.purpose}
        style={{display:"block",marginBottom:8}}
      >
        <div style={{background:ink(0.03),border:`1px solid ${T.borderB}`,borderRadius:6,padding:"7px 8px"}}>
          <div style={{fontSize:7,fontFamily:"monospace",color:ink(0.26),letterSpacing:0.7,textTransform:"uppercase",marginBottom:4}}>Purpose</div>
          <div style={{fontSize:8,fontFamily:"monospace",color:ink(0.52),lineHeight:1.5}}>{fn.purpose}</div>
        </div>
      </TooltipAnchor>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
        {lambdaFacts.map((fact)=>(
          <TooltipAnchor key={fact.label} heading={fact.heading} body={fact.body} style={{display:"block"}}>
            <div style={{background:T.insetBg,borderRadius:5,padding:"5px 7px",textAlign:"center"}}>
              <div style={{fontSize:10,fontFamily:"monospace",color:ink(0.6),fontWeight:700}}>{fact.value}</div>
              <div style={{fontSize:7,fontFamily:"monospace",color:ink(0.25),marginTop:1}}>{fact.label}</div>
            </div>
          </TooltipAnchor>
        ))}
      </div>
      <TooltipAnchor
        heading="Function ARN"
        body="Shown in AWS details and IAM references as Function ARN. Full AWS resource identifier used in IAM policies, event source mappings, CloudWatch permissions, and deployment automation."
        align="right"
        style={{display:"block"}}
      >
        <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.2),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fn.arn}</div>
      </TooltipAnchor>
      {s==="deploying" && (
        <div style={{marginTop:8}}>
          <ProgressBar pct={75} color={T.orange} h={3}/>
          <div style={{fontFamily:"monospace",fontSize:8,color:T.orange,marginTop:4}}>Packaging and uploading...</div>
        </div>
      )}
    </div>
  );
}

/* MAIN APP */
export default function App() {
  // ── Theme ──
  const [activeTheme, setActiveTheme] = useState("cosmos");
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  // Load saved theme from server on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/settings`).then(r => r.json()).then(s => {
      if (s.theme && THEMES[s.theme]) setActiveTheme(s.theme);
    }).catch(() => {});
  }, []);
  // Persist theme to server on change
  const changeTheme = useCallback((id) => {
    setActiveTheme(id);
    fetch(`${API_BASE}/api/settings`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({theme:id}) }).catch(() => {});
  }, []);
  T = THEMES[activeTheme] || THEMES.cosmos;
  const MONITOR_STAGES = _MONITOR_STAGES.map(s => ({...s, col: T[s.colKey]}));
  const BUILD_STAGES = _BUILD_STAGES.map(s => ({...s, col: T[s.colKey]}));
  const LAMBDA_DEPLOY_STAGES = _LAMBDA_DEPLOY_STAGES.map(s => ({...s, col: T[s.colKey]}));
  const S3_SYNC_SUBTABS = _S3_SYNC_SUBTABS.map(s => ({...s, color: T[s.colorKey]}));
  const CHANGED_FILE_SUBTABS = _CHANGED_FILE_SUBTABS.map(s => ({...s, color: T[s.colorKey]}));
  const CATEGORY_META = Object.fromEntries(
    Object.entries(_CATEGORY_META).map(([k,v]) => [k, { ...v, color: v.colorKey ? T[v.colorKey] : v.color }])
  );

  const [runMode, setRunMode]   = useState("idle");
  const [phase, setPhase]     = useState("idle");
  const [termLines, setTerm]  = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [uploaded, setUploaded] = useState(0);
  const [deleted, setDeleted]   = useState(0);
  const [bytesMB, setBytes]   = useState(0);
  const [cdnCleared, setCdn]  = useState(0);
  const [lambdaVer, setLambdaVer] = useState(null);
  const [lambdaCards, setLambdaCards] = useState([]);
  const [lambdaCatalogError, setLambdaCatalogError] = useState(null);
  const [siteStagePct, setSiteStagePct] = useState({
    build: 0,
    sync: 0,
    cdn: 0,
  });
  const [displaySiteStagePct, setDisplaySiteStagePct] = useState(createEmptySiteStageProgress);
  const [siteStageLinePct, setSiteStageLinePct] = useState(createEmptySiteStageProgress);
  const [siteStageDetail, setSiteStageDetail] = useState({
    build: "",
    sync: "",
    cdn: "",
  });
  const [lambdaStagePct, setLambdaStagePct] = useState({
    "lambda-package": 0,
    "lambda-upload": 0,
    "lambda-deploy": 0,
    "lambda-live": 0,
  });
  const [lambdaPackagePct, setLambdaPackagePct] = useState(0);
  const [matrixRows, setMatrix]   = useState([]);
  const [activeTab, setActiveTab] = useState("terminal");
  const [siteOperationProfile, setSiteOperationProfile] = useState("default");
  const [activeS3SyncSubtab, setActiveS3SyncSubtab] = useState("data-upload");
  const [activeChangedFilesSubtab, setActiveChangedFilesSubtab] = useState("files");
  const [s3PreviewSummary, setS3PreviewSummary] = useState({
    uploads: 0,
    deletes: 0,
    copies: 0,
    warnings: 0,
    label: "",
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [pendingDataUploadCount, setPendingDataUploadCount] = useState(0);
  const [pendingImageUploadCount, setPendingImageUploadCount] = useState(0);
  const [statusLoading, setStatusLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [allPendingFiles, setAllPendingFiles] = useState([]);
  const [lastBuildAt, setLastBuildAt] = useState(null);
  const [lastDataSyncAt, setLastDataSyncAt] = useState(null);
  const [lastImageSyncAt, setLastImageSyncAt] = useState(null);
  const [deployHistory, setDeployHistory] = useState([]);
  const [deployTarget, setDeployTarget] = useState({ bucket: "", region: "" });
  const [fakeChangesBusy, setFakeChangesBusy] = useState(false);
  const [cachePurgeBusy, setCachePurgeBusy] = useState(false);
  const [hasProductChanges, setHasProductChanges] = useState(false);
  const [hasLambdaChanges, setHasLambdaChanges] = useState(false);
  const [lambdaBuildRequired, setLambdaBuildRequired] = useState(false);
  const [lambdaDeployReady, setLambdaDeployReady] = useState(false);
  const [lambdaFiles, setLambdaFiles] = useState([]);
  const [hasDbSyncChanges, setHasDbSyncChanges] = useState(false);
  const [dbSyncCount, setDbSyncCount] = useState(0);
  const [dbSyncFiles, setDbSyncFiles] = useState([]);
  const [lastDbSyncAt, setLastDbSyncAt] = useState(null);
  const [syncFiles, setSyncFiles] = useState([]);
  const [cdnPaths, setCdnPaths] = useState([]);
  const [cdnMetrics, setCdnMetrics] = useState({
    mode: "",
    distributionId: "",
    plannedPaths: [],
    plannedPathCount: 0,
    wildcardPathCount: 0,
    exactPathCount: 0,
    groupCount: 0,
    currentGroup: 0,
    createdInvalidationIds: [],
    completedInvalidationIds: [],
    unverifiedInvalidationIds: [],
    lastInvalidationId: "",
    lastInvalidationStatus: "",
    currentAction: "",
    currentCommand: "",
    lastErrorCode: "",
    lastErrorMessage: "",
    lastPermissionAction: "",
    ...createEmptyCdnPathResolutionState(),
  });
  const [queuedCdnState, setQueuedCdnState] = useState(createEmptyQueuedCdnState());
  const [queuedCdnDetailOpen, setQueuedCdnDetailOpen] = useState(false);
  const [routeGraphWarning, setRouteGraphWarning] = useState(null);
  const [routeGraphLogExpanded, setRouteGraphLogExpanded] = useState(false);
  const termRef  = useRef(null);
  const s3Ref    = useRef(null);
  const iRef     = useRef(null);
  const abortRef = useRef(null);
  const siteStagePctRef = useRef(createEmptySiteStageProgress());
  const activeSiteOperationProfileRef = useRef("default");
  const activeSplitPublishPlanRef = useRef({
    mode: "",
    paths: [],
    reason: "",
    sourceProfile: "",
  });
  const [lambdaCatalogLoading, setLambdaCatalogLoading] = useState(true);
  const [infraResources, setInfraResources] = useState([]);
  const [infraHealthChecks, setInfraHealthChecks] = useState([]);
  const [lambdaFolderLinks, setLambdaFolderLinks] = useState([]);
  const [infraLoading, setInfraLoading] = useState(true);
  const [infraError, setInfraError] = useState(null);
  const [serverHealthMetrics, setServerHealthMetrics] = useState([]);
  const [serverHealthCollectedAt, setServerHealthCollectedAt] = useState(null);
  const pageCategorySummaries = useMemo(() => {
    const grouped = matrixRows.reduce((acc, row) => {
      const key = row.cat || "root";
      const meta = CATEGORY_META[key] || { color: T.blue, icon: key.slice(0, 4).toUpperCase() || "PAGE" };
      const current = acc.get(key) || {
        cat: key,
        path: key === "root" ? "/" : `/${key}`,
        color: meta.color,
        icon: meta.icon,
        target: 0,
        current: 0,
        failed: 0,
        queued: 0,
        building: 0,
      };
      current.target += 1;
      if (row.status === "success") current.current += 1;
      if (row.status === "failed") current.failed += 1;
      if (row.status === "queued") current.queued += 1;
      if (row.status === "building") current.building += 1;
      acc.set(key, current);
      return acc;
    }, new Map());
    return Array.from(grouped.values()).sort((a, b) => a.path.localeCompare(b.path));
  }, [matrixRows]);
  const kill = () => {
    clearInterval(iRef.current);
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  };
  const reset = () => {
    kill(); setRunMode("idle"); setPhase("idle"); setTerm([]); setElapsed(0);
    setUploaded(0); setDeleted(0); setBytes(0);
    setCdn(0); setLambdaVer(null); setLambdaPackagePct(0); setMatrix([]); setActiveTab("terminal");
    setActiveS3SyncSubtab("data-upload");
    setS3PreviewSummary({ uploads: 0, deletes: 0, copies: 0, warnings: 0, label: "" });
    setCdnMetrics(createEmptyCdnMetrics());
    setSiteStagePct(createEmptySiteStageProgress());
    setDisplaySiteStagePct(createEmptySiteStageProgress());
    setSiteStageLinePct(createEmptySiteStageProgress());
    setSiteStageDetail({ build: "", sync: "", cdn: "" });
    setLambdaStagePct({ "lambda-package": 0, "lambda-upload": 0, "lambda-deploy": 0, "lambda-live": 0 });
    setSyncFiles([]); setCdnPaths([]);
    setSiteOperationProfile("default");
    activeSiteOperationProfileRef.current = "default";
    setRouteGraphWarning(null);
    setRouteGraphLogExpanded(false);
  };
  const nextBuildLineDisplayCap = (progress) => {
    if (progress < 8) return 7;
    if (progress < 20) return 19;
    if (progress < 42) return 41;
    if (progress < 60) return 59;
    if (progress < 72) return 71;
    return 99;
  };
  const siteStageDisplayTarget = {
    build: ["syncing", "cdn", "done"].includes(phase) ? 100 : Math.max(siteStagePct.build, siteStageLinePct.build),
    sync: ["cdn", "done"].includes(phase) ? 100 : siteStagePct.sync,
    cdn: phase === "done" ? 100 : siteStagePct.cdn,
  };

  const handleSSELine = useCallback(({ stage, source, line }) => {
    const kind = classifyLineKind(line);
    setTerm(prev => [...prev, { text: line, kind, id: Math.random() }]);
    const isBuildOnlySiteProfile = siteOperationProfile === "astro-publish" || siteOperationProfile === "astro-rebuild";
    const isBuildOnlyStackRefreshLine = isBuildOnlySiteProfile
      && stage === "sync"
      && (line.startsWith("Starting: Refreshing Stack Outputs")
        || line.startsWith("Completed: Refreshing Stack Outputs")
        || line.startsWith("[stack]")
        || line.startsWith("[auth]"));

    if (stage === "build") { setRunMode("site"); setPhase("building"); }
    if (stage === "sync" && !isBuildOnlyStackRefreshLine)  { setRunMode("site"); setPhase("syncing"); }
    if (stage === "cdn")   { setRunMode("site"); setPhase("cdn"); }
    if (stage === "lambda-package") { setRunMode("lambda"); setPhase("lambda-package"); }
    if (stage === "lambda-upload")  { setRunMode("lambda"); setPhase("lambda-upload"); }
    if (stage === "lambda-deploy")  { setRunMode("lambda"); setPhase("lambda-deploy"); }
    if (stage === "lambda-live")    { setRunMode("lambda"); setPhase("lambda-live"); }
    if (stage === "db-sync")        { setRunMode("lambda"); setPhase("db-sync"); }
    if (stage === "done")  { setPhase("done"); clearInterval(iRef.current); }

    if (stage === "sync" && !isBuildOnlyStackRefreshLine) {
      const parsedS3Summary = parseS3TransferSummaryLine(line);
      if (parsedS3Summary) {
        setS3PreviewSummary(parsedS3Summary);
      }
      if (line.startsWith("upload:")) {
        setUploaded(p => p + 1);
        setBytes(p => +(p + 0.057).toFixed(2));
        setSyncFiles(prev => [...prev, {
          path: line.slice(8).trim(),
          op: "upload",
          scope: classifySyncFileScope(line),
          at: new Date().toLocaleTimeString(),
          id: Math.random(),
        }]);
      }
      if (line.startsWith("delete:")) {
        setDeleted(p => p + 1);
        setSyncFiles(prev => [...prev, {
          path: line.slice(8).trim(),
          op: "delete",
          scope: classifySyncFileScope(line),
          at: new Date().toLocaleTimeString(),
          id: Math.random(),
        }]);
      }
    }

    const parsedCdnSubmission = parseCdnSubmissionLine(line);
    const parsedCdnGroup = parseCdnGroupLine(line);
    const parsedCdnInvalidation = parseCdnInvalidationSummaryLine(line);
    const parsedCdnStatus = parseCdnStatusLine(line);
    const parsedCdnCommand = parseCdnCommandLine(line);
    const parsedCdnError = parseCdnErrorLine(line);
    const cdnModeMatch = `${line}`.match(/^Starting:\s+Invalidating CloudFront \((Full|Smart)\)$/i);
    const parsedCdnPathList = line.startsWith("[cdn] paths: ")
      ? line.slice("[cdn] paths: ".length).split(",").map(part => part.trim()).filter(Boolean)
      : null;
    const isCdnNoiseLine = line.startsWith("[lambda] stage lambda-live ");
    const isCdnRelevantLine = !isCdnNoiseLine && (stage === "cdn"
      || parsedCdnSubmission
      || parsedCdnGroup
      || parsedCdnInvalidation
      || parsedCdnStatus
      || parsedCdnCommand
      || parsedCdnError
      || cdnModeMatch
      || parsedCdnPathList);

    if (isCdnRelevantLine) {
      setCdnPaths(prev => [...prev, { line, id: Math.random() }]);
    }

    if (cdnModeMatch) {
      setCdnMetrics(prev => ({
        ...prev,
        mode: cdnModeMatch[1].toUpperCase(),
        currentAction: "preparing invalidation",
      }));
    }

    if (parsedCdnPathList) {
      const normalizedPaths = parsedCdnPathList.length === 1 && parsedCdnPathList[0] === "none"
        ? []
        : parsedCdnPathList;
      const pathMetrics = buildCdnPathMetrics(normalizedPaths);
      setCdn(pathMetrics.pathCount);
      setCdnMetrics(prev => ({
        ...prev,
        plannedPaths: pathMetrics.paths,
        plannedPathCount: pathMetrics.pathCount,
        wildcardPathCount: pathMetrics.wildcardPathCount,
        exactPathCount: pathMetrics.exactPathCount,
      }));
    }

    if (parsedCdnSubmission) {
      setCdn(parsedCdnSubmission.pathCount);
      setCdnMetrics(prev => ({
        ...prev,
        plannedPathCount: Math.max(prev.plannedPathCount, parsedCdnSubmission.pathCount),
        groupCount: parsedCdnSubmission.groupCount,
        currentAction: `submitting ${parsedCdnSubmission.groupCount} invalidation group${parsedCdnSubmission.groupCount !== 1 ? "s" : ""}`,
      }));
    }

    if (parsedCdnGroup) {
      setCdnMetrics(prev => {
        const nextPathResolution = rememberCdnGroupPaths(prev, parsedCdnGroup.paths);
        const mergedPathMetrics = buildCdnPathMetrics([...prev.plannedPaths, ...parsedCdnGroup.paths]);
        return {
          ...nextPathResolution,
          plannedPaths: mergedPathMetrics.paths,
          plannedPathCount: Math.max(prev.plannedPathCount, parsedCdnGroup.pathCount, mergedPathMetrics.pathCount),
          wildcardPathCount: mergedPathMetrics.wildcardPathCount,
          exactPathCount: mergedPathMetrics.exactPathCount,
          groupCount: parsedCdnGroup.groupCount,
          currentGroup: parsedCdnGroup.currentGroup,
          currentAction: `invalidating group ${parsedCdnGroup.currentGroup}/${parsedCdnGroup.groupCount}`,
        };
      });
    }

    if (parsedCdnInvalidation) {
      setCdnMetrics(prev => {
        const nextPathResolution = bindInvalidationToActiveGroup(prev, parsedCdnInvalidation.invalidationId);
        return ({
        ...nextPathResolution,
        createdInvalidationIds: prev.createdInvalidationIds.includes(parsedCdnInvalidation.invalidationId)
          ? prev.createdInvalidationIds
          : [...prev.createdInvalidationIds, parsedCdnInvalidation.invalidationId],
        lastInvalidationId: parsedCdnInvalidation.invalidationId,
        lastInvalidationStatus: parsedCdnInvalidation.status,
        currentAction: `created invalidation ${parsedCdnInvalidation.invalidationId}`,
      })});
    }

    if (parsedCdnStatus) {
      setCdnMetrics(prev => {
        const nextPathResolution = resolveInvalidationPaths(prev, parsedCdnStatus.invalidationId, parsedCdnStatus.status);
        return ({
        ...nextPathResolution,
        completedInvalidationIds: parsedCdnStatus.status === "COMPLETED" && !prev.completedInvalidationIds.includes(parsedCdnStatus.invalidationId)
          ? [...prev.completedInvalidationIds, parsedCdnStatus.invalidationId]
          : prev.completedInvalidationIds,
        unverifiedInvalidationIds: parsedCdnStatus.status === "UNVERIFIED" && !prev.unverifiedInvalidationIds.includes(parsedCdnStatus.invalidationId)
          ? [...prev.unverifiedInvalidationIds, parsedCdnStatus.invalidationId]
          : prev.unverifiedInvalidationIds,
        lastInvalidationId: parsedCdnStatus.invalidationId,
        lastInvalidationStatus: parsedCdnStatus.status,
        currentAction: parsedCdnStatus.status === "COMPLETED"
          ? `completed invalidation ${parsedCdnStatus.invalidationId}`
          : parsedCdnStatus.status === "UNVERIFIED"
            ? `unverified invalidation ${parsedCdnStatus.invalidationId}`
            : `polling invalidation ${parsedCdnStatus.invalidationId}`,
      })});
    }

    if (parsedCdnCommand) {
      setCdnMetrics(prev => ({
        ...prev,
        distributionId: parsedCdnCommand.distributionId || prev.distributionId,
        currentAction: parsedCdnCommand.action || prev.currentAction,
        currentCommand: parsedCdnCommand.command,
        lastInvalidationId: parsedCdnCommand.invalidationId || prev.lastInvalidationId,
      }));
    }

    if (parsedCdnError) {
      setCdnMetrics(prev => ({
        ...prev,
        lastErrorCode: parsedCdnError.code,
        lastErrorMessage: parsedCdnError.message,
        lastPermissionAction: parsedCdnError.operation,
        currentAction: parsedCdnError.operation === "GetInvalidation" ? "polling blocked" : parsedCdnError.operation,
      }));
    }

    if (stage === "cdn" && line.startsWith("FAILED with exit code")) {
      setCdnMetrics(prev => prev.lastErrorCode ? prev : ({
        ...prev,
        lastErrorCode: "EXIT",
        lastErrorMessage: line,
        currentAction: "failed",
      }));
    }

    const lambdaStageProgressMatch = line.match(/^\[lambda\] stage ([a-z-]+) (\d+)%(?:\s+(.*))?$/);
    if (lambdaStageProgressMatch) {
      const [, stageKey, pct] = lambdaStageProgressMatch;
      const pctValue = Number.parseInt(pct, 10);
      if (!Number.isNaN(pctValue)) {
        setLambdaStagePct(prev => ({ ...prev, [stageKey]: pctValue }));
        if (stageKey === "lambda-package") {
          setLambdaPackagePct(pctValue);
        }
      }
    }

    if (line.startsWith("[lambda] package ")) {
      const packagePct = Number.parseInt(line.replace("[lambda] package ", "").replace("%", ""), 10);
      if (!Number.isNaN(packagePct)) {
        setLambdaPackagePct(packagePct);
      }
    }

    const lambdaMatch = line.match(/\bv(\d+)\b/);
    if (lambdaMatch) {
      setLambdaVer(Number(lambdaMatch[1]));
    }

    if (stage === "build") {
      setSiteStageLinePct(prev => {
        const current = Math.max(prev.build, siteStagePctRef.current.build);
        const cappedTarget = nextBuildLineDisplayCap(siteStagePctRef.current.build);
        if (current >= cappedTarget) {
          return prev;
        }
        return { ...prev, build: current + 1 };
      });
      const routeMatch = line.match(/\/[^\s]*?\.html\b/);
      if (routeMatch) {
        const routePath = routeMatch[0];
        setMatrix(prev => upsertMatrixRowForRoute(prev, routePath, kind === "delete" ? "failed" : "success"));
      }
    }
  }, [siteOperationProfile]);

  const refreshCdnQueue = useCallback(() => {
    fetch(`${API_BASE}/api/cdn/queue`)
      .then(r => r.json())
      .then(data => {
        setQueuedCdnState(hydrateQueuedCdnState(data.queue));
      })
      .catch(() => {
        setQueuedCdnState(createEmptyQueuedCdnState());
      });
  }, []);

  const refreshServerHealth = useCallback(() => {
    fetch(`${API_BASE}/api/system/health`)
      .then(r => r.json())
      .then(data => {
        setServerHealthCollectedAt(data.collectedAt || null);
        setServerHealthMetrics(data.metrics || []);
      })
      .catch(() => {
        setServerHealthCollectedAt(null);
        setServerHealthMetrics([]);
      });
  }, []);

  const refreshSidebarInsights = useCallback(() => {
    fetch(`${API_BASE}/api/deploy/history`)
      .then(r => r.json())
      .then(data => {
        setDeployHistory(data.runs || []);
      })
      .catch(() => {
        setDeployHistory([]);
      });

    refreshServerHealth();
  }, [refreshServerHealth]);

  const refreshStatus = useCallback((fullFileList = false) => {
    const qs = fullFileList ? "?summary=false" : "?summary=true";
    fetch(`${API_BASE}/api/status${qs}`)
      .then(r => r.json())
      .then(data => {
        setPendingCount(data.buildCount || 0);
        setPendingFiles(data.buildFiles || []);
        setAllPendingFiles(data.files || []);
        setPendingUploadCount(data.pendingUploadCount || 0);
        setPendingDataUploadCount(data.pendingDataUploadCount || 0);
        setPendingImageUploadCount(data.pendingImageUploadCount || 0);
        setLastBuildAt(data.lastBuildAt || null);
        setLastDataSyncAt(data.lastDataSyncAt || null);
        setLastImageSyncAt(data.lastImageSyncAt || null);
        setHasProductChanges(data.hasProductChanges || false);
        setHasLambdaChanges(data.hasLambdaChanges || false);
        setLambdaBuildRequired(data.lambdaBuildRequired || false);
        setLambdaFiles(data.lambdaFiles || (data.files || []).filter(f => ["api","auth","search"].includes(f.category)));
        setHasDbSyncChanges(data.hasDbSyncChanges || false);
        setDbSyncCount(data.dbSyncCount || 0);
        setDbSyncFiles(data.dbSyncFiles || []);
        setLastDbSyncAt(data.lastDbSyncAt || null);
        setStatusLoading(false);
      })
      .catch(() => {
        setStatusLoading(false);
      });
  }, []);

  const consumeSSEStream = useCallback((endpoint, failurePrefix, requestOptions = {}) => {
    let tick = 0;
    iRef.current = setInterval(() => { tick = +(tick + 0.1).toFixed(1); setElapsed(tick); }, 100);

    const controller = new AbortController();
    abortRef.current = controller;

    fetch(endpoint, { method: "POST", signal: controller.signal, ...requestOptions })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              setPhase(prev => prev === "done" ? prev : "idle");
              if (phase !== "done") {
                setRunMode(prev => prev === "lambda" || prev === "site" ? prev : "idle");
              }
              if (endpoint.endsWith("/api/lambda/deploy")) {
                setHasLambdaChanges(false);
                setLambdaDeployReady(false);
                setLambdaFiles([]);
              }
              if (endpoint.endsWith("/api/db/sync")) {
                setHasDbSyncChanges(false);
                setDbSyncCount(0);
                setDbSyncFiles([]);
              }
              activeSplitPublishPlanRef.current = {
                mode: "",
                paths: [],
                reason: "",
                sourceProfile: "",
              };
              clearInterval(iRef.current);
              abortRef.current = null;
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop();

            for (const chunk of chunks) {
              if (!chunk.startsWith("data: ")) continue;
              try {
                const payload = JSON.parse(chunk.slice(6));
                if (payload.kind === "page_inventory") {
                  setMatrix(payload.rows || []);
                  continue;
                }
                if (payload.kind === "site_stage_progress") {
                  setSiteStagePct(prev => applySiteStageProgressEvent(prev, {
                    progress: payload.progress || 0,
                    stage: payload.stage,
                  }));
                  setSiteStageLinePct(prev => ({ ...prev, [payload.stage]: Math.max(prev[payload.stage], payload.progress || 0) }));
                  setSiteStageDetail(prev => ({ ...prev, [payload.stage]: payload.detail || "" }));
                  setTerm(prev => [...prev, { text: `[${payload.stage}] ${payload.progress || 0}% ${payload.detail || ""}`.trim(), kind: "info", id: Math.random() }]);
                  if (payload.stage === "cdn") {
                    setCdnPaths(prev => [...prev, { line: `[cdn] ${payload.progress || 0}% ${payload.detail || ""}`.trim(), id: Math.random() }]);
                    setCdnMetrics(prev => ({
                      ...prev,
                      currentAction: payload.detail || prev.currentAction,
                    }));
                  }
                  continue;
                }
                if (payload.kind === "route_graph_warning") {
                  setRouteGraphWarning(payload);
                  continue;
                }
                handleSSELine(payload);
                if (payload.stage === "done") {
                  if (
                    activeSiteOperationProfileRef.current === "s3-data-publish"
                    || activeSiteOperationProfileRef.current === "s3-image-publish"
                    || activeSiteOperationProfileRef.current === "s3-data-rebuild"
                    || activeSiteOperationProfileRef.current === "s3-image-rebuild"
                  ) {
                    activeSplitPublishPlanRef.current = {
                      mode: "",
                      paths: [],
                      reason: "",
                      sourceProfile: "",
                    };
                    // WHY: Backend persists the CDN queue plan to disk before emitting
                    // the "done" event — refreshCdnQueue fetches the authoritative state.
                    refreshCdnQueue();
                  }
                  if (
                    activeSiteOperationProfileRef.current === "cdn-publish"
                    || activeSiteOperationProfileRef.current === "cdn-flush"
                  ) {
                    setQueuedCdnState(createEmptyQueuedCdnState());
                    setQueuedCdnDetailOpen(false);
                    refreshCdnQueue();
                  }
                  refreshStatus(true);
                  refreshSidebarInsights();
                }
              }
              catch (_) { /* skip malformed */ }
            }

            read();
          }).catch(() => {
            setRunMode("idle");
            setPhase("idle");
            activeSplitPublishPlanRef.current = {
              mode: "",
              paths: [],
              reason: "",
              sourceProfile: "",
            };
            refreshCdnQueue();
            clearInterval(iRef.current);
            abortRef.current = null;
          });
        }
        read();
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setTerm(prev => [...prev, { text: `${failurePrefix}: ${err.message}`, kind: "delete", id: Math.random() }]);
        }
        setRunMode("idle");
        setPhase("idle");
        activeSplitPublishPlanRef.current = {
          mode: "",
          paths: [],
          reason: "",
          sourceProfile: "",
        };
        refreshCdnQueue();
        clearInterval(iRef.current);
        abortRef.current = null;
      });
  }, [handleSSELine, phase, refreshCdnQueue, refreshSidebarInsights, refreshStatus]);

  const startSiteOperation = useCallback((endpoint, initialPhase, tab = "terminal", failurePrefix = "Connection error") => {
    const nextSiteOperationProfile = endpoint.endsWith("/api/build/quick")
      ? "quick-publish"
      : endpoint.endsWith("/api/build/full")
        ? "full-rebuild"
        : endpoint.endsWith("/api/build/astro-publish")
          ? "astro-publish"
          : endpoint.endsWith("/api/build/astro-rebuild")
            ? "astro-rebuild"
            : endpoint.endsWith("/api/build/s3-data-publish")
              ? "s3-data-publish"
              : endpoint.endsWith("/api/build/s3-image-publish")
                ? "s3-image-publish"
                : endpoint.endsWith("/api/build/s3-data-rebuild")
                  ? "s3-data-rebuild"
                  : endpoint.endsWith("/api/build/s3-image-rebuild")
                    ? "s3-image-rebuild"
                    : endpoint.endsWith("/api/cdn/invalidate/live")
                      ? "cdn-flush"
                      : endpoint.endsWith("/api/cdn/publish/live")
                        ? "cdn-publish"
                        : "default";
    const instantCdnPlan = buildInstantPublishCdnPlan({
      pendingFiles: allPendingFiles,
      profile: nextSiteOperationProfile,
    });
    const rememberedPublishPlan = endpoint.endsWith("/api/cdn/publish/live")
      ? queuedCdnState
      : instantCdnPlan;
    reset();
    activeSiteOperationProfileRef.current = nextSiteOperationProfile;
    activeSplitPublishPlanRef.current = nextSiteOperationProfile === "s3-data-publish"
      || nextSiteOperationProfile === "s3-image-publish"
      || nextSiteOperationProfile === "s3-data-rebuild"
      || nextSiteOperationProfile === "s3-image-rebuild"
      ? instantCdnPlan
      : {
          mode: "",
          paths: [],
          reason: "",
          sourceProfile: "",
        };
    setSiteOperationProfile(nextSiteOperationProfile);
    setRunMode("site");
    setPhase(initialPhase);
    if (nextSiteOperationProfile === "cdn-publish" || nextSiteOperationProfile === "cdn-flush") {
      setQueuedCdnState(prev => markQueuedCdnStateRunning(
        prev,
        nextSiteOperationProfile === "cdn-flush" ? "CDN Flush" : "CDN Publish",
      ));
      setQueuedCdnDetailOpen(false);
    }
    if (endpoint.endsWith("/api/cdn/invalidate/live")) {
      const pathMetrics = buildCdnPathMetrics(SITE_FULL_INVALIDATION_PATHS);
      setCdnMetrics({
        ...createEmptyCdnMetrics(),
        mode: "FULL",
        currentAction: "resolving stack outputs",
        plannedPaths: pathMetrics.paths,
        plannedPathCount: pathMetrics.pathCount,
        wildcardPathCount: pathMetrics.wildcardPathCount,
        exactPathCount: pathMetrics.exactPathCount,
      });
    }
    if (endpoint.endsWith("/api/cdn/publish/live") && rememberedPublishPlan.paths.length > 0) {
      const pathMetrics = buildCdnPathMetrics(rememberedPublishPlan.paths);
      setCdnMetrics({
        ...createEmptyCdnMetrics(),
        mode: rememberedPublishPlan.mode,
        currentAction: "resolving stack outputs",
        plannedPaths: pathMetrics.paths,
        plannedPathCount: pathMetrics.pathCount,
        wildcardPathCount: pathMetrics.wildcardPathCount,
        exactPathCount: pathMetrics.exactPathCount,
      });
    }
    setActiveTab(tab);
    consumeSSEStream(
      endpoint,
      failurePrefix,
      endpoint.endsWith("/api/cdn/publish/live")
        ? {
            body: JSON.stringify({ paths: rememberedPublishPlan.paths }),
            headers: { "Content-Type": "application/json" },
          }
        : {},
    );
  }, [allPendingFiles, consumeSSEStream, queuedCdnState]);

  const startLambdaDeploy = useCallback(() => {
    reset();
    setRunMode("lambda");
    setPhase("lambda-package");
    setActiveTab("lambda");
    consumeSSEStream(`${API_BASE}/api/lambda/deploy`, "Lambda deploy error");
  }, [consumeSSEStream]);

  const startDbSync = useCallback(() => {
    reset();
    setRunMode("lambda");
    setPhase("db-sync");
    setActiveTab("lambda");
    consumeSSEStream(`${API_BASE}/api/db/sync`, "DB sync error");
  }, [consumeSSEStream]);

  const startFakeChanges = useCallback(() => {
    if (fakeChangesBusy) {
      return;
    }

    if (!window.confirm([
      "Touch a random sample of real project files by updating modified times only.",
      "No file contents are changed.",
      "",
      "Are you sure you want to continue?",
    ].join("\n"))) {
      return;
    }

    setFakeChangesBusy(true);
    fetch(`${API_BASE}/api/simulate/fake-changes`, { method: "POST" })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.detail || "Fake change request failed");
        }
        return data;
      })
      .then(data => {
        setTerm(prev => [
          ...prev,
          {
            text: `[simulate] touched ${data.totalTouched} files`,
            kind: "info",
            id: Math.random(),
          },
        ]);
        refreshStatus();
      })
      .catch(err => {
        setTerm(prev => [
          ...prev,
          {
            text: `Fake random file changes failed: ${err.message}`,
            kind: "delete",
            id: Math.random(),
          },
        ]);
      })
      .finally(() => {
        setFakeChangesBusy(false);
      });
  }, [fakeChangesBusy, refreshStatus]);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.json())
      .then(data => {
        setDeployTarget({
          bucket: data.s3_bucket || "",
          region: data.aws_region || "",
        });
      })
      .catch(() => {
        setDeployTarget({ bucket: "", region: "" });
      });
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/lambda/functions`)
      .then(r => r.json())
      .then(data => {
        setLambdaCards(data.functions || []);
        setLambdaCatalogError(data.error || null);
        setLambdaCatalogLoading(false);
      })
      .catch(err => {
        setLambdaCards([]);
        setLambdaCatalogError(err.message);
        setLambdaCatalogLoading(false);
      });
  }, []);

  useEffect(() => {
    siteStagePctRef.current = siteStagePct;
  }, [siteStagePct]);

  useEffect(() => {
    const stageKeys = Object.keys(siteStageDisplayTarget);
    const interval = setInterval(() => {
      let isSettled = true;
      setDisplaySiteStagePct(prev => {
        const next = { ...prev };
        stageKeys.forEach((key) => {
          const target = siteStageDisplayTarget[key];
          const current = prev[key];
          if (current === target) {
            return;
          }
          if (current > target) {
            next[key] = target;
            return;
          }
          isSettled = false;
          const gap = target - current;
          const step = gap >= 18 ? 3 : gap >= 8 ? 2 : 1;
          next[key] = Math.min(target, current + step);
        });
        return next;
      });
      if (isSettled) {
        clearInterval(interval);
      }
    }, SITE_PROGRESS_SMOOTHING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase, siteStagePct.build, siteStagePct.sync, siteStagePct.cdn]);

  useEffect(() => {
    fetch(`${API_BASE}/api/infra/status`)
      .then(r => r.json())
      .then(data => {
        setInfraResources(data.resources || []);
        setInfraHealthChecks(data.healthChecks || []);
        setLambdaFolderLinks(data.lambdaFolders || []);
        setInfraError(data.error || null);
        setInfraLoading(false);
      })
      .catch(err => {
        setInfraResources([]);
        setInfraHealthChecks([]);
        setLambdaFolderLinks([]);
        setInfraError(err.message);
        setInfraLoading(false);
      });
  }, []);

  useEffect(() => {
    refreshSidebarInsights();
    refreshCdnQueue();
    const interval = setInterval(() => {
      refreshSidebarInsights();
      refreshCdnQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshCdnQueue, refreshSidebarInsights]);

  useEffect(() => {
    if (phase === "done" || phase === "idle") {
      refreshSidebarInsights();
      refreshCdnQueue();
    }
  }, [phase, refreshCdnQueue, refreshSidebarInsights]);

  useEffect(() => {
    refreshStatus();
    const activePhases = ["recommender","building","syncing","cdn","lambda-package","lambda-upload","lambda-deploy","lambda-live"];
    const pollMs = activePhases.includes(phase) ? 10_000 : 30_000;
    const interval = setInterval(refreshStatus, pollMs);
    return () => clearInterval(interval);
  }, [refreshStatus, phase]);

  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [termLines]);
  useEffect(() => { if (s3Ref.current) s3Ref.current.scrollTop = s3Ref.current.scrollHeight; }, [syncFiles]);
  useEffect(() => () => kill(), []);

  const isRunning = [
    "recommender",
    "building",
    "syncing",
    "cdn",
    "lambda-package",
    "lambda-upload",
    "lambda-deploy",
    "lambda-live",
  ].includes(phase);
  const isSiteMode = runMode === "site";
  const isLambdaMode = runMode === "lambda";
  const isPanelLoading = statusLoading || lambdaCatalogLoading;
  const isInfraPanelLoading = isPanelLoading || infraLoading;
  const totalPages = matrixRows.filter(r=>r.status==="success").length;
  const latestDeployRun = deployHistory[0] || null;
  const imageUploadCount = syncFiles.filter(file => file.scope === "images" && file.op === "upload").length;
  const publishControlsDisabled = isRunning || (pendingCount === 0 && pendingUploadCount === 0);
  const astroPublishDisabled = isRunning || pendingCount === 0;
  const dataPublishDisabled = isRunning || pendingDataUploadCount === 0;
  const imagePublishDisabled = isRunning || pendingImageUploadCount === 0;
  const cdnPublishDisabled = isRunning || queuedCdnState.paths.length === 0;
  const dataRebuildDisabled = isRunning;
  const imageRebuildDisabled = isRunning;
  const startCachePurge = useCallback(() => {
    if (isRunning || cachePurgeBusy) {
      return;
    }

    if (!window.confirm([
      "Purge the local Astro/Vite caches before the next publish?",
      "This clears .astro and node_modules/.vite.",
      "The next Astro publish will rebuild from a cold cache.",
      "It resets the site, data, and image pending markers so the next publish starts cold.",
      "",
      "Are you sure you want to purge the cache?",
    ].join("\n"))) {
      return;
    }

    setCachePurgeBusy(true);
    fetch(`${API_BASE}/api/cache/purge`, { method: "POST" })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.detail || "Cache purge failed");
        }
        return data;
      })
      .then(data => {
        const clearedCaches = data.cleared || [];
        const resetMarkers = data.resetMarkers || [];
        const resetSummary = [
          clearedCaches.length > 0 ? `caches ${clearedCaches.join(", ")}` : "",
          resetMarkers.length > 0 ? `markers ${resetMarkers.join(", ")}` : "",
        ].filter(Boolean).join(" | ");
        setTerm(prev => [...prev, {
          text: resetSummary ? `Cache reset: ${resetSummary}` : (data.message || "Cache already clean"),
          kind: "ok", id: Math.random(),
        }]);
        refreshStatus();
        refreshServerHealth();
      })
      .catch(err => {
        setTerm(prev => [...prev, {
          text: `Cache purge failed: ${err.message}`,
          kind: "delete", id: Math.random(),
        }]);
      })
      .finally(() => {
        setCachePurgeBusy(false);
      });
  }, [cachePurgeBusy, isRunning, refreshServerHealth, refreshStatus]);
  const deploymentErrorLineCount = termLines.filter(line => line.kind === "delete" && !line.text.startsWith("delete:")).length;
  const observedOperationCount = termLines.filter(line => ["upload", "delete", "built"].includes(line.kind)).length;
  const deploymentErrorRate = observedOperationCount > 0
    ? Math.round((deploymentErrorLineCount / observedOperationCount) * 100)
    : latestDeployRun?.status === "failed" ? 100 : 0;
  const isIncrementalPublishProfile = siteOperationProfile === "quick-publish"
    || siteOperationProfile === "astro-publish"
    || siteOperationProfile === "s3-data-publish"
    || siteOperationProfile === "s3-image-publish";
  const showMatrixPreRouteNotice = isSiteMode
    && phase === "building"
    && matrixRows.length > 0
    && matrixRows.every(row => row.status === "queued");
  const showIncrementalPublishMatrixNotice = isSiteMode
    && isIncrementalPublishProfile
    && matrixRows.length === 0;
  const liveLambdaCards = lambdaCards.map(fn => ({
    ...fn,
    changed: hasLambdaChanges || runMode === "lambda",
    status: hasLambdaChanges ? "watching" : "idle",
  }));
  const healthyInfraResourceCount = infraResources.filter(resource => resource.status === "healthy").length;
  const warningInfraResourceCount = infraResources.filter(resource => resource.status === "warning").length;
  const erroredInfraResourceCount = infraResources.filter(resource => resource.status === "error").length;
  const s3ResourceCards = infraResources.slice(0, 4);
  const hasS3PreviewSummary = s3PreviewSummary.uploads > 0 || s3PreviewSummary.deletes > 0 || s3PreviewSummary.copies > 0 || s3PreviewSummary.warnings > 0;
  const previewDeltaCount = s3PreviewSummary.uploads + s3PreviewSummary.deletes;
  const s3PanelStatCards = [
    { l:"DATA UP", n:syncFiles.filter(file => file.scope === "data" && file.op === "upload").length, c:T.blue },
    { l:"IMG UP", n:syncFiles.filter(file => file.scope === "images" && file.op === "upload").length, c:T.purple },
    { l:"DATA DEL", n:syncFiles.filter(file => file.scope === "data" && file.op === "delete").length, c:T.orange },
    { l:"IMG DEL", n:syncFiles.filter(file => file.scope === "images" && file.op === "delete").length, c:T.red },
  ];
  const visiblePendingFiles = activeChangedFilesSubtab === "images"
    ? allPendingFiles.filter(file => file.category === "image")
    : pendingFiles.filter(file => file.category !== "image");
  const cdnQueueIsRunning = queuedCdnState.status === "RUNNING";
  const hasQueuedCdnLog = queuedCdnState.logLines.length > 0;
  const queuedCdnDisplayPaths = queuedCdnState.logLines.map((line, index) => ({
    line,
    id: `queue:${index}:${line}`,
  }));
  const queuedCdnPathMetrics = buildCdnPathMetrics(queuedCdnState.paths);
  const hasLiveCdnRun = phase === "cdn"
    || cdnPaths.length > 0
    || cdnMetrics.createdInvalidationIds.length > 0
    || cdnMetrics.groupCount > 0
    || Boolean(cdnMetrics.lastInvalidationId)
    || Boolean(cdnMetrics.lastErrorCode)
    || Boolean(cdnMetrics.currentAction);
  const displayCdnMetrics = hasLiveCdnRun || queuedCdnState.paths.length === 0
    ? cdnMetrics
    : {
        ...createEmptyCdnMetrics(),
        mode: queuedCdnState.mode,
        plannedPaths: queuedCdnPathMetrics.paths,
        plannedPathCount: queuedCdnPathMetrics.pathCount,
        wildcardPathCount: queuedCdnPathMetrics.wildcardPathCount,
        exactPathCount: queuedCdnPathMetrics.exactPathCount,
      };
  const displayCdnPaths = hasLiveCdnRun ? cdnPaths : queuedCdnDisplayPaths;
  const publishQueueCdnLogLines = hasLiveCdnRun ? cdnPaths : queuedCdnDisplayPaths;
  const publishQueueCdnLogState = hasLiveCdnRun ? "LIVE" : queuedCdnState.status;
  const publishQueueCards = [
    {
      label: "BUILD",
      accent: T.blue,
      count: pendingCount,
      state: pendingCount > 0 ? "build required" : "clear",
      detail: pendingCount > 0
        ? `${pendingCount} source file${pendingCount !== 1 ? "s" : ""} waiting for Astro`
        : lastBuildAt
          ? `Built ${timeAgo(lastBuildAt)}`
          : "No source work queued",
    },
    {
      label: "DATA",
      accent: T.purple,
      count: pendingDataUploadCount,
      state: pendingDataUploadCount > 0 ? "upload ready" : "clear",
      detail: pendingDataUploadCount > 0
        ? `${pendingDataUploadCount} content/data file${pendingDataUploadCount !== 1 ? "s" : ""} upload ready`
        : lastDataSyncAt
          ? `Uploaded ${timeAgo(lastDataSyncAt)}`
          : "No data uploads queued",
    },
    {
      label: "IMAGES",
      accent: T.yellow,
      count: pendingImageUploadCount,
      state: pendingImageUploadCount > 0 ? "upload ready" : "clear",
      detail: pendingImageUploadCount > 0
        ? `${pendingImageUploadCount} image file${pendingImageUploadCount !== 1 ? "s" : ""} upload ready`
        : lastImageSyncAt
          ? `Uploaded ${timeAgo(lastImageSyncAt)}`
          : "No image uploads queued",
    },
    {
      label: "CDN",
      accent: T.green,
      count: queuedCdnState.paths.length,
      state: queuedCdnState.status === "RUNNING" ? "running" : queuedCdnState.paths.length > 0 ? "queued" : "clear",
      detail: cdnQueueIsRunning
        ? `${queuedCdnState.paths.length} queued path${queuedCdnState.paths.length !== 1 ? "s" : ""} invalidating now`
        : queuedCdnState.paths.length > 0
          ? `${queuedCdnState.paths.length} queued paths waiting for CDN Publish or Flush`
          : "No CDN invalidations queued",
    },
  ];
  const publishQueueSummary = pendingCount > 0
    ? "Run Astro Publish or Publish Updates first."
    : queuedCdnState.status !== "CLEAR"
      ? "Uploads are current. CDN invalidation is queued."
    : pendingUploadCount > 0
      ? "Build is current. Upload scopes are ready."
      : "No pending source changes or uploads";
  const activeS3SyncSubtabMeta = S3_SYNC_SUBTABS.find(tab => tab.key === activeS3SyncSubtab) || S3_SYNC_SUBTABS[0];
  const visibleSyncFiles = syncFiles.filter(file =>
    file.scope === activeS3SyncSubtabMeta.scope && file.op === activeS3SyncSubtabMeta.op
  );
  const cdnCreatedCount = displayCdnMetrics.createdInvalidationIds.length;
  const cdnCompletedCount = displayCdnMetrics.completedInvalidationIds.length;
  const cdnUnverifiedCount = displayCdnMetrics.unverifiedInvalidationIds.length;
  const cdnResolvedCount = cdnCompletedCount + cdnUnverifiedCount;
  const cdnPollingState = displayCdnMetrics.lastErrorCode
    ? displayCdnMetrics.lastPermissionAction === "GetInvalidation" ? "BLOCKED" : "FAILED"
    : !hasLiveCdnRun && queuedCdnState.paths.length > 0
      ? cdnQueueIsRunning ? "RUNNING" : "QUEUED"
    : displayCdnMetrics.groupCount > 0 && cdnResolvedCount >= displayCdnMetrics.groupCount
      ? cdnUnverifiedCount > 0 ? "UNVERIFIED" : "DONE"
      : cdnCreatedCount > 0 || phase === "cdn" || (displayCdnMetrics.mode && displayCdnMetrics.currentAction)
        ? "RUNNING"
        : "IDLE";
  const cdnPollingColor = cdnPollingState === "BLOCKED" || cdnPollingState === "FAILED"
    ? T.red
    : cdnPollingState === "UNVERIFIED"
      ? T.orange
    : cdnPollingState === "QUEUED"
      ? T.yellow
    : cdnPollingState === "DONE"
      ? T.green
      : cdnPollingState === "RUNNING"
        ? T.yellow
        : T.dimmer;
  const completionSummaryTone = phase==="done" ? "complete" : latestDeployRun ? "history" : "idle";
  const completionSummaryTitle = phase==="done"
    ? `Full Deployment Complete | ${elapsed.toFixed(1)}s total`
    : latestDeployRun ? `${latestDeployRun.label} Deployment | ${(latestDeployRun.durationSeconds || 0).toFixed(1)}s total`
      : "Awaiting Deployment Run";
  const completionSummaryMetrics = phase==="done" ? [
    { l:"Pages Built", v:totalPages, c:T.blue },
    { l:"S3 Uploaded", v:uploaded, c:T.purple },
    { l:"S3 Deleted", v:deleted, c:T.red },
    { l:"Data Sent", v:`${bytesMB.toFixed(1)}MB`, c:T.green },
    { l:"CDN Paths", v:cdnCleared, c:T.cyan },
    { l:"Lambda Ver", v:lambdaVer ? `v${lambdaVer}` : "--", c:T.orange },
  ] : [
    { l:"Pages Built", v:latestDeployRun ? latestDeployRun.pagesBuilt : 0, c:completionSummaryTone==="idle" ? ink(0.22) : T.blue },
    { l:"S3 Uploaded", v:latestDeployRun ? latestDeployRun.uploaded : 0, c:completionSummaryTone==="idle" ? ink(0.22) : T.purple },
    { l:"S3 Deleted", v:latestDeployRun ? latestDeployRun.deleted : 0, c:completionSummaryTone==="idle" ? ink(0.22) : T.red },
    { l:"Data Sent", v:"--", c:completionSummaryTone==="idle" ? ink(0.22) : T.green },
    { l:"CDN Paths", v:latestDeployRun ? latestDeployRun.cdnPaths : 0, c:completionSummaryTone==="idle" ? ink(0.22) : T.cyan },
    { l:"Lambda Ver", v:latestDeployRun?.lambdaVersion != null ? `v${latestDeployRun.lambdaVersion}` : "--", c:completionSummaryTone==="idle" ? ink(0.22) : T.orange },
  ];

  const laneStageState = (lane, key)=>{
    if(runMode==="idle") return "idle";
    if(runMode!==lane) return "idle";
    const order = lane === "site" ? SITE_STAGE_ORDER : LAMBDA_STAGE_ORDER;
    if(phase==="done") return "done";
    const currentPhase = phase;
    const pi = order.indexOf(currentPhase);
    const ki = order.indexOf(key);
    if (ki === -1) return "idle";
    if(ki<pi) return "done";
    if(ki===pi) return "active";
    return "idle";
  };
  const stageTilePct = (lane, key) => {
    const state = laneStageState(lane, key);
    const siteProgressKey = lane === "site" ? SITE_STAGE_KEY_MAP[key] || key : key;
    if (lane === "site" && state === "done" && displaySiteStagePct[siteProgressKey] < 100) {
      return displaySiteStagePct[siteProgressKey];
    }
    if (state === "done") return 100;
    if (state === "active") {
      if (lane === "site" && displaySiteStagePct[siteProgressKey] > 0) {
        return displaySiteStagePct[siteProgressKey];
      }
      if (lane === "site") {
        return 0;
      }
      if (lane === "lambda" && lambdaStagePct[key] > 0) {
        return lambdaStagePct[key];
      }
      return STAGE_PROGRESS[phase] || 0;
    }
    return 0;
  };
  const lambdaTileDoneValue = (key) => {
    if (key === "lambda-live") {
      return lambdaVer ? `v${lambdaVer}` : "Ready";
    }
    return "Done";
  };
  const renderStageStatus = (state, pct, color, doneLabel = "Complete") => {
    if (state === "done") {
      return (
        <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.38),marginTop:4}}>
          {doneLabel}
        </div>
      );
    }
    if (state === "active") {
      return (
        <div style={{fontFamily:"monospace",fontSize:7,color,marginTop:4,display:"inline-flex",alignItems:"center",gap:4}}>
          <span style={{width:7,height:7,borderRadius:"50%",border:`1.5px solid ${color}`,borderTopColor:"transparent",display:"inline-block",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
          <span>{pct}% complete</span>
        </div>
      );
    }
    return (
      <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.16),marginTop:4}}>
        Pending
      </div>
    );
  };

  const pCol = {
    idle:ink(0.2),
    recommender:T.yellow,
    building:T.blue,
    syncing:T.purple,
    cdn:T.green,
    "lambda-package":T.orange,
    "lambda-upload":T.yellow,
    "lambda-deploy":T.blue,
    "lambda-live":T.cyan,
    done:T.cyan,
  }[phase];
  const pLabel = {
    idle:"STANDBY",
    recommender:"RECOMMENDER",
    building:"ASTRO BUILD",
    syncing:"S3 SYNC",
    cdn:"CDN INVALIDATE",
    "lambda-package":"LAMBDA PACKAGE",
    "lambda-upload":"LAMBDA UPLOAD",
    "lambda-deploy":"STACK DEPLOY",
    "lambda-live":"LIVE OUTPUTS",
    done:"COMPLETE",
  }[phase];
  const activeProgressPct = isLambdaMode && lambdaStagePct[phase] > 0
    ? lambdaStagePct[phase]
    : isSiteMode && displaySiteStagePct[{ building:"build", syncing:"sync", cdn:"cdn" }[phase]] > 0
      ? displaySiteStagePct[{ building:"build", syncing:"sync", cdn:"cdn" }[phase]]
    : isSiteMode && ["building", "syncing", "cdn"].includes(phase)
      ? 0
    : phase === "lambda-package" && lambdaPackagePct > 0
      ? lambdaPackagePct
      : (STAGE_PROGRESS[phase] || 0);
  const pPct = `${activeProgressPct}%`;
  const getTabLiveMeta = (key) => {
    if (key === "terminal") return isRunning ? { color:pCol, label:"LIVE" } : null;
    if (key === "matrix" || key === "categories") return isSiteMode && phase === "building" ? { color:T.blue, label:"LIVE" } : null;
    if (key === "s3sync") return isSiteMode && phase === "syncing" ? { color:T.purple, label:"LIVE" } : null;
    if (key === "cdntab") return isSiteMode && phase === "cdn" ? { color:T.green, label:"LIVE" } : null;
    if (key === "lambda") return isLambdaMode && ["lambda-package","lambda-upload","lambda-deploy","lambda-live"].includes(phase) ? { color:pCol, label:"LIVE" } : null;
    return null;
  };
  const renderPanelTab = ({ key, label }) => {
    const tabLiveMeta = getTabLiveMeta(key);
    return (
      <button
        key={key}
        className={`tab${activeTab===key?" active":""}`}
        onClick={()=>setActiveTab(key)}
        style={{position:"relative",overflow:"hidden"}}
      >
        {tabLiveMeta && (
          <span style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${tabLiveMeta.color}12,transparent)`,animation:"sweep 1.8s linear infinite",pointerEvents:"none"}}/>
        )}
        <span style={{display:"inline-flex",alignItems:"center",gap:8,position:"relative",zIndex:1}}>
          <span>{label}</span>
          {tabLiveMeta && (
            <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 6px",borderRadius:999,border:`1px solid ${tabLiveMeta.color}44`,background:`${tabLiveMeta.color}18`,boxShadow:`0 0 12px ${tabLiveMeta.color}22`,color:tabLiveMeta.color,animation:"pulse 1.2s ease-in-out infinite"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:tabLiveMeta.color,boxShadow:`0 0 8px ${tabLiveMeta.color}`,animation:"pulse 1.2s ease-in-out infinite",flexShrink:0}}/>
              {tabLiveMeta.label}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <>
      <style>{`
        ${Object.values(THEMES).map(t => `@import url('${t.fontUrl}');`).join('\n        ')}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg};transition:background 0.3s ease}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:2px}
        @keyframes slideUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sweep{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
        @keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scanPulse{0%,100%{box-shadow:0 0 0 ${T.orange}00}50%{box-shadow:0 0 24px ${T.orange}33}}
        button:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px)}
        button:active:not(:disabled){transform:translateY(0)}
        button{transition:all 0.15s ease;cursor:pointer}
        .tab{background:transparent;border:none;padding:7px 14px;font-family:${T.monoFont};font-size:9px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all 0.15s ease}
        .tab.active{color:${T.cyan};border-bottom:2px solid ${T.cyan}}
        .tab:not(.active){color:${ink(0.28)};border-bottom:2px solid transparent}
        .tab:hover:not(.active){color:${ink(0.5)}}
        .tooltip-anchor{position:relative;display:inline-flex;align-items:center;cursor:help}
        .tooltip-anchor:focus-visible{outline:1px solid ${T.cyan}55;outline-offset:2px;border-radius:4px}
        .tooltip-bubble{position:absolute;left:0;bottom:calc(100% + 10px);width:280px;max-width:min(280px,calc(100vw - 40px));padding:11px 12px;border-radius:10px;border:1px solid ${T.cyan}33;background:linear-gradient(180deg, ${T.bg}fa, ${T.panel}fa);box-shadow:0 18px 36px ${T.floatShadow}, inset 0 1px 0 ${ink(0.03)};opacity:0;transform:translateY(6px);pointer-events:none;transition:opacity 0.16s ease, transform 0.16s ease;z-index:100}
        .tooltip-bubble::after{content:"";position:absolute;top:100%;left:18px;border-width:7px 7px 0 7px;border-style:solid;border-color:${T.panel}fa transparent transparent transparent}
        .tooltip-right .tooltip-bubble{left:auto;right:0}
        .tooltip-right .tooltip-bubble::after{left:auto;right:18px}
        .tooltip-anchor:hover .tooltip-bubble,.tooltip-anchor:focus-visible .tooltip-bubble{opacity:1;transform:translateY(0)}
        .tooltip-heading{display:block;font-family:${T.headingFont};font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${T.cyan};margin-bottom:4px}
        .tooltip-body{display:block;font-family:${T.monoFont};font-size:9px;line-height:1.55;color:${ink(0.76)}}
      `}</style>

      <div style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column",background:T.bg,color:T.textColor,fontFamily:T.headingFont,
        backgroundImage:T.bgGradient}}>

        {/* TOPBAR */}
        <div style={{padding:"0 20px",height:50,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,
          background:T.topbarBg,position:"sticky",top:0,zIndex:200}}>
          <div style={{fontFamily:T.monoFont,fontSize:17,letterSpacing:4,fontWeight:700,color:T.cyan}}>
            DEPLOYCTL
          </div>
          <div style={{width:1,height:16,background:T.border}}/>
          <div style={{fontSize:9,fontFamily:"monospace",color:ink(0.28),letterSpacing:1}}>
            techreviews-prod | us-east-1 | Astro 4.8.3 | Node 20.x
          </div>
          {pendingCount > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:5,background:T.yellow+"1a",border:`1px solid ${T.yellow}4d`,
              borderRadius:20,padding:"3px 10px",animation:"pulse 2.5s ease-in-out infinite"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.yellow,boxShadow:`0 0 7px ${T.yellow}`}}/>
              <span style={{fontSize:10,fontWeight:700,color:T.yellow,fontFamily:"monospace"}}>{pendingCount} Pending File{pendingCount !== 1 ? "s" : ""}</span>
            </div>
          )}
          <div style={{flex:1}}/>
          {(isRunning||phase==="done")&&<div style={{fontFamily:"monospace",fontSize:11,color:pCol,padding:"3px 8px",background:pCol+"18",borderRadius:4,border:`1px solid ${pCol}33`}}>{elapsed.toFixed(1)}s</div>}
          <div style={{fontFamily:"monospace",fontSize:8,letterSpacing:2,textTransform:"uppercase",color:pCol,
            border:`1px solid ${pCol}44`,background:pCol+"11",padding:"4px 10px",borderRadius:4,display:"flex",alignItems:"center",gap:5}}>
            {isRunning&&<div style={{width:7,height:7,borderRadius:"50%",border:`2px solid ${pCol}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>}
            {pLabel}
          </div>
          {phase!=="idle"&&<button onClick={reset} style={{fontSize:8,fontFamily:"monospace",color:ink(0.3),background:ink(0.04),border:`1px solid ${ink(0.09)}`,borderRadius:4,padding:"4px 9px"}}>RESET</button>}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowThemeMenu(p=>!p)} style={{fontSize:8,fontFamily:"monospace",color:ink(0.4),background:ink(0.04),border:`1px solid ${ink(0.09)}`,borderRadius:4,padding:"4px 9px",display:"flex",alignItems:"center",gap:4}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              <span style={{letterSpacing:0.5}}>THEME</span>
            </button>
            {showThemeMenu && <>
              <div onClick={()=>setShowThemeMenu(false)} style={{position:"fixed",inset:0,zIndex:299}}/>
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,width:260,background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:8,zIndex:300,boxShadow:`0 12px 36px ${T.floatShadow}`}}>
                <div style={{fontSize:7,fontFamily:"monospace",color:ink(0.3),letterSpacing:1.5,textTransform:"uppercase",padding:"4px 8px",marginBottom:4}}>SELECT THEME</div>
                {Object.values(THEMES).map(theme=>(
                  <button key={theme.id} onClick={()=>{changeTheme(theme.id);setShowThemeMenu(false)}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:7,background:activeTheme===theme.id?`${theme.cyan}12`:"transparent",border:activeTheme===theme.id?`1px solid ${theme.cyan}44`:"1px solid transparent",textAlign:"left",marginBottom:2}}>
                    <div style={{display:"flex",gap:2}}>{theme.preview.map((c,i)=>(<div key={i} style={{width:8,height:20,borderRadius:2,background:c}}/>))}</div>
                    <div>
                      <div style={{fontFamily:"monospace",fontSize:10,fontWeight:700,color:activeTheme===theme.id?theme.cyan:ink(0.7),letterSpacing:0.5}}>{theme.name}</div>
                      <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.35),marginTop:1}}>{theme.desc}</div>
                    </div>
                    {activeTheme===theme.id&&<div style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:theme.cyan,boxShadow:`0 0 6px ${theme.cyan}`}}/>}
                  </button>
                ))}
              </div>
            </>}
          </div>
        </div>

        <div style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",padding:"14px 20px 0",display:"flex",flexDirection:"column",gap:12}}>

          {/* SECTION 1: PANELS + CONTROLS (no gap between rows) */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,alignItems:"stretch",height:450}}>

            {/* Deployment Vitals */}
            <Panel loading={isPanelLoading} title="Deployment Vitals" icon="OPS" accent={T.cyan+"44"}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexShrink:0}}>
                <div style={{background:T.cyan+"14",border:`1px solid ${T.cyan}33`,borderRadius:10,padding:"10px 14px",textAlign:"center",flex:1}}>
                  <div style={{fontSize:8,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:4}}>BUILD TIME</div>
                  <div style={{fontFamily:T.monoFont,fontSize:26,color:T.cyan,textShadow:`0 0 20px ${T.cyan}`,lineHeight:1}}>
                    {isRunning?`${Math.floor(elapsed/60)}m ${(elapsed%60).toFixed(0).padStart(2,"0")}s`:phase==="done"?`${Math.floor(elapsed/60)}m ${(elapsed%60).toFixed(0).padStart(2,"0")}s`:"--:--"}
                  </div>
                </div>
                <div style={{background:T.red+"0f",border:`1px solid ${T.red}33`,borderRadius:10,padding:"10px 14px",textAlign:"center",flex:1}}>
                  <div style={{fontSize:8,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:4}}>ERROR RATE</div>
                  <div style={{fontFamily:T.monoFont,fontSize:26,color:deploymentErrorRate > 0 ? T.red : T.green,textShadow:`0 0 20px ${deploymentErrorRate > 0 ? T.red : T.green}`,lineHeight:1}}>{deploymentErrorRate}%</div>
                </div>
              </div>
              {[
                {l:"Build ID",       v:latestDeployRun ? `#${latestDeployRun.id}` : "--", c:latestDeployRun ? (latestDeployRun.status === "failed" ? T.red : T.cyan) : T.dimmer},
                {l:"Pending Files",  v:pendingCount > 0 ? `${pendingCount.toLocaleString()} files` : "0 files", c:pendingCount > 0 ? T.yellow : T.dimmer},
                {l:"Deploy Target",  v:deployTarget.bucket ? `s3://${deployTarget.bucket}` : "--", c:deployTarget.bucket ? T.green : T.dimmer},
                {l:"Image Uploads",  v:`${imageUploadCount} uploaded`, c:imageUploadCount > 0 ? T.blue : T.dimmer},
                {l:"CDN Paths",      v:`${cdnCleared} cleared`, c:cdnCleared > 0 ? T.green : T.dimmer},
                /* SERVER HEALTH */
                ...(serverHealthMetrics.length > 0 ? serverHealthMetrics.map(metric => ({
                  l:metric.label, v:`${metric.value} ${metric.unit}`, c:statusColor(metric.status),
                })) : []),
              ].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${ink(0.04)}`}}>
                  <span style={{fontFamily:"monospace",fontSize:9,color:ink(0.28)}}>{r.l}</span>
                  <span style={{fontFamily:"monospace",fontSize:9,color:r.c}}>{r.v}</span>
                </div>
              ))}

              {/* Deploy History sub-section — hidden until data exists */}
              {deployHistory.length > 0 && (
              <div style={{borderTop:`1px solid ${ink(0.06)}`,marginTop:8,paddingTop:8,flex:1,minHeight:0,display:"flex",flexDirection:"column"}}>
                <div style={{fontSize:7.5,fontFamily:"monospace",color:ink(0.22),letterSpacing:0.5,marginBottom:6}}>DEPLOY HISTORY</div>
                <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                  {deployHistory.map(entry => (
                    <div key={entry.id} style={{display:"flex",flexDirection:"column",gap:4,padding:"5px 0",borderBottom:`1px solid ${ink(0.04)}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:statusColor(entry.status),boxShadow:`0 0 4px ${statusColor(entry.status)}`,flexShrink:0}}/>
                        <span style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.22),flexShrink:0}}>#{entry.id}</span>
                        <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.45),flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{timeAgo(entry.completedAt || entry.startedAt)}</span>
                        <span style={{fontSize:7,fontFamily:"monospace",color:deployHistoryLabelColor(entry),background:deployHistoryLabelBg(entry),padding:"1px 5px",borderRadius:3,flexShrink:0}}>{entry.label}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,fontFamily:"monospace",fontSize:7.5,color:ink(0.28),paddingLeft:10}}>
                        {entry.kind !== "cdn" && <span>{entry.pagesBuilt || 0}p</span>}
                        <span>{(entry.durationSeconds || 0).toFixed(1)}s</span>
                        <span style={{color:ink(0.38)}}>{formatDeployHistoryDetail(entry)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </Panel>

            {/* S3 State */}
            <Panel loading={isInfraPanelLoading} title="S3 State & Sync" icon="S3" accent={T.purple+"44"}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10,flexShrink:0}}>
                {[
                  {
                    l:"Preview Delta",
                    v:hasS3PreviewSummary ? String(previewDeltaCount) : "--",
                    sub:hasS3PreviewSummary
                      ? `${s3PreviewSummary.uploads} uploads, ${s3PreviewSummary.deletes} deletes`
                      : "Waiting for S3 diff preview",
                    c:hasS3PreviewSummary ? T.yellow : ink(0.3),
                  },
                  {
                    l:"Observed Ops",
                    v:String(syncFiles.length),
                    sub:syncFiles.length > 0 ? `${syncFiles.length} live S3 event${syncFiles.length!==1?"s":""}` : "No live S3 operations yet",
                    c:syncFiles.length > 0 ? T.blue : ink(0.3),
                  },
                  {
                    l:"Sync Stage",
                    v:phase === "syncing" ? "RUNNING" : syncFiles.length > 0 ? (phase === "done" ? "DONE" : "READY") : "IDLE",
                    sub:hasS3PreviewSummary ? s3PreviewSummary.label : "No S3 summary available yet",
                    c:phase === "syncing" ? T.purple : syncFiles.length > 0 ? T.cyan : ink(0.3),
                  },
                  {
                    l:"Infra Health",
                    v:infraResources.length > 0 ? `${healthyInfraResourceCount}/${infraResources.length}` : "--",
                    sub:infraResources.length > 0
                      ? erroredInfraResourceCount > 0
                        ? `${erroredInfraResourceCount} error${erroredInfraResourceCount!==1?"s":""}`
                        : warningInfraResourceCount > 0
                          ? `${warningInfraResourceCount} warning${warningInfraResourceCount!==1?"s":""}`
                          : "All managed resources healthy"
                      : "Waiting for dependency telemetry",
                    c:erroredInfraResourceCount > 0 ? T.red : warningInfraResourceCount > 0 ? T.yellow : T.green,
                  },
                ].map(m=>(
                  <div key={m.l} style={{background:ink(0.02),border:T.borderB,borderRadius:7,padding:"8px",textAlign:"center"}}>
                    <div style={{fontSize:8,fontFamily:"monospace",color:ink(0.25),marginBottom:3}}>{m.l}</div>
                    <div style={{fontFamily:T.monoFont,fontSize:18,color:m.c,lineHeight:1.1,whiteSpace:"pre"}}>{m.v}</div>
                    {m.sub&&<div style={{fontSize:7,fontFamily:"monospace",color:ink(0.4),marginTop:4,lineHeight:1.45}}>{m.sub}</div>}
                  </div>
                ))}
              </div>
              <div style={{background:ink(0.02),border:`1px solid ${T.border}`,borderRadius:7,padding:"8px 10px",marginBottom:8,flex:1,minHeight:0,display:"flex",flexDirection:"column"}}>
                <div style={{fontSize:8,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:6,flexShrink:0}}>MANAGED RESOURCES</div>
                <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                {s3ResourceCards.length === 0 ? (
                  <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),padding:"4px 0"}}>No live dependency data</div>
                ) : s3ResourceCards.map(resource => (
                  <div key={resource.key} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0",borderBottom:`1px solid ${ink(0.04)}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontFamily:"monospace",fontSize:9,color:ink(0.5),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{resource.label}</span>
                        <span style={{fontFamily:"monospace",fontSize:7,color:T.dim,background:ink(0.05),padding:"1px 4px",borderRadius:3,flexShrink:0}}>{resource.kind.toUpperCase()}</span>
                      </div>
                      <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{resource.detail}</div>
                    </div>
                    <StatusBadge status={resource.status} small />
                  </div>
                ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,flexShrink:0}}>
                {s3PanelStatCards.map(card => (
                  <div key={card.l} style={{background:ink(0.02),borderRadius:6,padding:"6px 8px"}}>
                    <div style={{fontSize:7,fontFamily:"monospace",color:T.dim,marginBottom:3}}>{card.l}</div>
                    <div style={{fontFamily:T.monoFont,fontSize:18,color:card.c,textShadow:`0 0 12px ${card.c}`}}>{card.n}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8,flexShrink:0}}>
                {[
                  {l:"Last Build", v:lastBuildAt ? timeAgo(lastBuildAt) : "Never", c:lastBuildAt ? T.cyan : T.dimmer},
                  {l:"Last Data Sync", v:lastDataSyncAt ? timeAgo(lastDataSyncAt) : "Never", c:lastDataSyncAt ? T.purple : T.dimmer},
                  {l:"Last Image Sync", v:lastImageSyncAt ? timeAgo(lastImageSyncAt) : "Never", c:lastImageSyncAt ? T.yellow : T.dimmer},
                ].map(t=>(
                  <div key={t.l} style={{background:ink(0.02),borderRadius:6,padding:"6px 8px"}}>
                    <div style={{fontSize:7,fontFamily:"monospace",color:T.dim,marginBottom:3}}>{t.l}</div>
                    <div style={{fontFamily:"monospace",fontSize:9,color:t.c}}>{t.v}</div>
                  </div>
                ))}
              </div>
              {deployTarget.bucket && (
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"6px 8px",background:ink(0.02),borderRadius:6}}>
                <div style={{fontSize:7,fontFamily:"monospace",color:T.dim,flexShrink:0}}>TARGET</div>
                <div style={{fontFamily:"monospace",fontSize:8,color:T.green,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>s3://{deployTarget.bucket}</div>
                <div style={{fontFamily:"monospace",fontSize:7,color:T.dim,background:ink(0.05),padding:"1px 5px",borderRadius:3,flexShrink:0}}>{deployTarget.region}</div>
              </div>
              )}
            </Panel>

            {/* Lambda Command Center */}
            {(() => {
              const buildLit = lambdaBuildRequired;
              const syncLit = hasDbSyncChanges;
              const deployLit = (hasLambdaChanges && !lambdaBuildRequired) || lambdaDeployReady;
              const anyActive = syncLit || hasLambdaChanges || lambdaDeployReady;
              const panelColor = hasLambdaChanges || lambdaDeployReady ? T.orange : syncLit ? T.purple : T.orange;
              return (
            <Panel loading={isPanelLoading}
              title="Lambda Command Center"
              icon="LAM"
              accent={anyActive?panelColor+"88":T.orange+"44"}
              style={anyActive?{boxShadow:`0 0 0 1px ${panelColor}44, 0 0 24px ${panelColor}22`,animation:"scanPulse 2s ease-in-out infinite"}:undefined}
            >
              {/* Banners — show most urgent first */}
              {(hasLambdaChanges || lambdaDeployReady) && (
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"6px 9px",flexShrink:0,
                  background:T.orange+"1a",border:`1px solid ${T.orange}44`,borderRadius:6,
                  animation:"scanPulse 2s ease-in-out infinite"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:T.orange,boxShadow:`0 0 8px ${T.orange}`,animation:"pulse 1.5s ease-in-out infinite",flexShrink:0}}/>
                  <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:T.orange}}>{lambdaDeployReady && !lambdaBuildRequired ? "Build complete — deploy lambda now" : lambdaBuildRequired ? "Lambda source changed — build first" : "Lambda infra changed — deploy now"}</span>
                  {lambdaFiles.length > 0 && <span style={{fontFamily:"monospace",fontSize:7,color:T.orange,background:T.orange+"33",padding:"1px 5px",borderRadius:3,marginLeft:"auto",flexShrink:0}}>{lambdaFiles.length} file{lambdaFiles.length!==1?"s":""}</span>}
                </div>
              )}
              {syncLit && !hasLambdaChanges && !lambdaDeployReady && (
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"6px 9px",flexShrink:0,
                  background:T.purple+"1a",border:`1px solid ${T.purple}44`,borderRadius:6,
                  animation:"scanPulse 2s ease-in-out infinite"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:T.purple,boxShadow:`0 0 8px ${T.purple}`,animation:"pulse 1.5s ease-in-out infinite",flexShrink:0}}/>
                  <span style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:T.purple}}>Content changed — sync search DB</span>
                  <span style={{fontFamily:"monospace",fontSize:7,color:T.purple,background:T.purple+"33",padding:"1px 5px",borderRadius:3,marginLeft:"auto",flexShrink:0}}>{dbSyncCount} file{dbSyncCount!==1?"s":""}</span>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(0,0.95fr)",gap:10,alignItems:"stretch",flex:1,minHeight:0,overflow:"hidden"}}>
                  <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{fontSize:7.5,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:6,flexShrink:0}}>FUNCTIONS</div>
                    <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                      {liveLambdaCards.length > 0 ? liveLambdaCards.map(fn => (
                        <LambdaCard key={fn.name} fn={fn} isDeploying={phase==="lambda"}/>
                      )) : (
                        <div style={{background:ink(0.02),border:`1px solid ${T.borderB}`,borderRadius:9,padding:"12px 13px"}}>
                          <div style={{fontFamily:"monospace",fontSize:9,color:ink(0.48),marginBottom:6}}>No live Lambda metadata available.</div>
                          <div style={{fontFamily:"monospace",fontSize:8,color:lambdaCatalogError?T.orange:ink(0.24),lineHeight:1.5}}>
                            {lambdaCatalogError || "The dashboard could not resolve Lambda functions from the deployed CloudFormation stack."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
                    <div style={{fontSize:7.5,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:6,flexShrink:0}}>WATCHER</div>
                <div style={{
                  background:ink(0.02),
                  border:`1px solid ${T.borderB}`,
                  borderRadius:9,
                  padding:"10px 11px",
                  flex:1,
                  minHeight:0,
                  display:"flex",
                  flexDirection:"column",
                  overflow:"hidden",
                }}>
                  {/* Lambda watcher — orange */}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexShrink:0}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:hasLambdaChanges?T.orange:ink(0.15),boxShadow:hasLambdaChanges?`0 0 8px ${T.orange}`:"none",animation:hasLambdaChanges?"pulse 1.2s ease-in-out infinite":"none",flexShrink:0}}/>
                    <span style={{fontFamily:"monospace",fontSize:7.5,fontWeight:700,color:hasLambdaChanges?T.orange:ink(0.45),letterSpacing:0.5}}>Lambda</span>
                    <span style={{marginLeft:"auto",fontFamily:"monospace",fontSize:6,color:hasLambdaChanges?T.orange:ink(0.3),background:(hasLambdaChanges?T.orange:ink(0.3))+"18",padding:"1px 4px",borderRadius:3,flexShrink:0}}>
                      {hasLambdaChanges?`${lambdaFiles.length} CHANGED`:`WATCHING ${LAMBDA_WATCH_PATHS.length}`}
                    </span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6,flexShrink:0}}>
                    {LAMBDA_WATCH_PATHS.map(path => (
                      <span key={path} style={{
                        fontFamily:"monospace",fontSize:5.5,color:hasLambdaChanges?T.orange:ink(0.32),
                        background:hasLambdaChanges?T.orange+"1a":ink(0.04),
                        border:`1px solid ${hasLambdaChanges?T.orange+"33":ink(0.08)}`,
                        borderRadius:3,padding:"1px 4px",
                      }}>{path}</span>
                    ))}
                  </div>
                  {/* Schema sync watcher — purple */}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexShrink:0}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:syncLit?T.purple:ink(0.15),boxShadow:syncLit?`0 0 8px ${T.purple}`:"none",animation:syncLit?"pulse 1.2s ease-in-out infinite":"none",flexShrink:0}}/>
                    <span style={{fontFamily:"monospace",fontSize:7.5,fontWeight:700,color:syncLit?T.purple:ink(0.45),letterSpacing:0.5}}>Schema</span>
                    <span style={{marginLeft:"auto",fontFamily:"monospace",fontSize:6,color:syncLit?T.purple:ink(0.3),background:(syncLit?T.purple:ink(0.3))+"18",padding:"1px 4px",borderRadius:3,flexShrink:0}}>
                      {syncLit?`${dbSyncCount} CHANGED`:`WATCHING ${DB_SYNC_WATCH_PATHS.length}`}
                    </span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6,flexShrink:0}}>
                    {DB_SYNC_WATCH_PATHS.map(path => (
                      <span key={path} style={{
                        fontFamily:"monospace",fontSize:5.5,color:syncLit?T.purple:ink(0.32),
                        background:syncLit?T.purple+"1a":ink(0.04),
                        border:`1px solid ${syncLit?T.purple+"33":ink(0.08)}`,
                        borderRadius:3,padding:"1px 4px",
                      }}>{path}</span>
                    ))}
                  </div>
                  {/* Changed files — all three colors */}
                  <div style={{fontSize:6.5,fontFamily:"monospace",color:T.dim,letterSpacing:1,marginBottom:4,flexShrink:0}}>CHANGED FILES</div>
                  <div style={{display:"flex",flexDirection:"column",gap:2,flex:1,minHeight:0,overflowY:"auto"}}>
                    {lambdaFiles.length > 0 && lambdaFiles.map((f,i) => (
                      <div key={"l"+i} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 5px",
                        background:T.orange+"0a",border:`1px solid ${T.orange}22`,borderRadius:3}}>
                        <div style={{width:3,height:3,borderRadius:"50%",background:T.orange,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0,fontFamily:"monospace",fontSize:7,color:ink(0.5),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.path.split("/").pop()}</div>
                        <span style={{fontSize:5.5,fontFamily:"monospace",color:T.orange,background:T.orange+"18",padding:"1px 3px",borderRadius:2,flexShrink:0}}>{f.category.toUpperCase()}</span>
                      </div>
                    ))}
                    {dbSyncFiles.length > 0 && dbSyncFiles.slice(0,5).map((f,i) => (
                      <div key={"d"+i} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 5px",
                        background:T.purple+"0a",border:`1px solid ${T.purple}22`,borderRadius:3}}>
                        <div style={{width:3,height:3,borderRadius:"50%",background:T.purple,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0,fontFamily:"monospace",fontSize:7,color:ink(0.5),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{f.path.split("/").pop()}</div>
                        <span style={{fontSize:5.5,fontFamily:"monospace",color:T.purple,background:T.purple+"18",padding:"1px 3px",borderRadius:2,flexShrink:0}}>{f.category.toUpperCase()}</span>
                      </div>
                    ))}
                    {dbSyncFiles.length > 5 && (
                      <div style={{fontFamily:"monospace",fontSize:6.5,color:T.purple,padding:"1px 5px",textAlign:"center"}}>+{dbSyncFiles.length - 5} more</div>
                    )}
                    {lambdaFiles.length === 0 && dbSyncFiles.length === 0 && (
                      <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.18),padding:"10px 0",textAlign:"center"}}>
                        No watched files changed
                      </div>
                    )}
                  </div>
                </div>
                  </div>
              </div>
              {phase==="done"&&runMode==="lambda"&&(
                <div style={{marginTop:8,flexShrink:0,background:T.green+"12",border:`1px solid ${T.green}33`,borderRadius:6,padding:"7px 10px"}}>
                  <div style={{fontSize:8,fontFamily:"monospace",color:T.green}}>
                    {lambdaVer ? `search-api-auth deployed | v${lambdaVer}` : "Operation complete"}
                  </div>
                </div>
              )}
              {/* Three buttons — always visible, one row */}
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.borderB}`,flexShrink:0,display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <button onClick={() => { if (!isRunning) { if (hasLambdaChanges) setLambdaDeployReady(true); startSiteOperation(`${API_BASE}/api/build/astro-rebuild`, "building"); } }} disabled={isRunning} style={{
                    padding:"10px 8px",borderRadius:9,
                    border:`1.5px solid ${buildLit && !isRunning ? T.blue+"88" : T.blue+"33"}`,
                    background:buildLit && !isRunning ? T.blue+"1e" : T.blue+"0a",
                    color:T.blue,fontFamily:"monospace",fontSize:9,fontWeight:700,letterSpacing:0.5,
                    opacity:isRunning ? 0.25 : buildLit ? 1 : 0.4,
                    boxShadow:buildLit && !isRunning ? `0 0 16px ${T.blue}33` : "none",
                    animation:buildLit && !isRunning ? "scanPulse 2s ease-in-out infinite" : "none",
                    transition:"all 0.3s ease",
                  }}>
                    Astro Build
                  </button>
                  <button onClick={() => !isRunning && startDbSync()} disabled={isRunning} style={{
                    padding:"10px 8px",borderRadius:9,
                    border:`1.5px solid ${syncLit && !isRunning ? T.purple+"88" : T.purple+"33"}`,
                    background:syncLit && !isRunning ? T.purple+"1e" : T.purple+"0a",
                    color:T.purple,fontFamily:"monospace",fontSize:9,fontWeight:700,letterSpacing:0.5,
                    opacity:isRunning ? 0.25 : syncLit ? 1 : 0.4,
                    boxShadow:syncLit && !isRunning ? `0 0 16px ${T.purple}33` : "none",
                    animation:syncLit && !isRunning ? "scanPulse 2s ease-in-out infinite" : "none",
                    transition:"all 0.3s ease",
                  }}>
                    Schema Sync
                  </button>
                  <button onClick={() => !isRunning && startLambdaDeploy()} disabled={isRunning} style={{
                    padding:"10px 8px",borderRadius:9,
                    border:`1.5px solid ${deployLit && !isRunning ? T.orange+"88" : T.orange+"33"}`,
                    background:deployLit && !isRunning ? T.orange+"1e" : T.orange+"0a",
                    color:T.orange,fontFamily:"monospace",fontSize:9,fontWeight:700,letterSpacing:0.5,
                    opacity:isRunning ? 0.25 : lambdaBuildRequired && !lambdaDeployReady ? 0.35 : deployLit ? 1 : 0.4,
                    boxShadow:deployLit && !isRunning ? `0 0 16px ${T.orange}33` : "none",
                    animation:deployLit && !isRunning ? "scanPulse 2s ease-in-out infinite" : "none",
                    transition:"all 0.3s ease",
                  }}>
                    Deploy Lambda
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <div style={{fontFamily:"monospace",fontSize:6.5,color:ink(0.18),lineHeight:1.3,padding:"0 2px"}}>
                    {buildLit ? "Build before deploy" : "No build needed"}
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:6.5,color:ink(0.18),lineHeight:1.3,padding:"0 2px"}}>
                    {syncLit ? `${dbSyncCount} content file${dbSyncCount!==1?"s":""} changed` : lastDbSyncAt ? timeAgo(lastDbSyncAt) : "Sync products + articles"}
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:6.5,color:ink(0.18),lineHeight:1.3,padding:"0 2px"}}>
                    {lambdaDeployReady ? "Build done — deploy now" : hasLambdaChanges ? (lambdaBuildRequired ? "Build first" : "Deploy now") : "Package + deploy"}
                  </div>
                </div>
              </div>
            </Panel>
              );
            })()}
          </div>

          {/* SECTION 2: CONTROLS */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,alignItems:"stretch"}}>

            {/* Publish Updates controls */}
            <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={() => !publishControlsDisabled && startSiteOperation(`${API_BASE}/api/build/quick`, "building")} disabled={publishControlsDisabled}
                style={{
                padding:"12px 16px",borderRadius:9,border:`1.5px solid ${T.blue}55`,
                background:publishControlsDisabled?T.blue+"08":`linear-gradient(135deg,${T.blue},${T.cyan})`,
                color:publishControlsDisabled?T.blue:"#fff",fontFamily:T.headingFont,fontWeight:800,fontSize:14,letterSpacing:1,
                boxShadow:publishControlsDisabled?"none":`0 0 28px ${T.cyan}59,0 4px 14px ${T.floatShadow}`,
                opacity:publishControlsDisabled?0.35:1,display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
              }}>
                <span>Publish Updates</span>
                <span style={{fontSize:7,fontFamily:"monospace",opacity:0.7,letterSpacing:1}}>INCREMENTAL</span>
              </button>
              <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.22),lineHeight:1.5,padding:"0 2px"}}>
                {pendingCount > 0
                  ? "Cached Astro build to S3 mirror (upload and delete) to targeted CDN invalidation"
                  : pendingUploadCount > 0
                    ? "Upload ready to S3 mirror to targeted CDN invalidation"
                    : "No pending source changes or uploads"}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
                <button onClick={() => !astroPublishDisabled && startSiteOperation(`${API_BASE}/api/build/astro-publish`, "building")} disabled={astroPublishDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.blue}33`,
                  background:T.blue+"0f",color:T.blue,fontFamily:"monospace",fontSize:8.5,opacity:astroPublishDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>Astro Publish</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>{pendingCount > 0 ? "Cached Astro build only" : "No pending changes"}</span>
                </button>
                <button onClick={() => !dataPublishDisabled && startSiteOperation(`${API_BASE}/api/build/s3-data-publish`, "syncing", "s3sync")} disabled={dataPublishDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.purple}33`,
                  background:T.purple+"0f",color:T.purple,fontFamily:"monospace",fontSize:8.5,opacity:dataPublishDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>S3 Data Publish</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Content/data upload only</span>
                </button>
                <button onClick={() => !imagePublishDisabled && startSiteOperation(`${API_BASE}/api/build/s3-image-publish`, "syncing", "s3sync")} disabled={imagePublishDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.yellow}33`,
                  background:T.yellow+"0d",color:T.yellow,fontFamily:"monospace",fontSize:8.5,opacity:imagePublishDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>S3 Image Publish</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Images upload only</span>
                </button>
                <button onClick={() => !cdnPublishDisabled && startSiteOperation(`${API_BASE}/api/cdn/publish/live`, "cdn", "cdntab", "CDN publish error")} disabled={cdnPublishDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.green}33`,
                  background:T.green+"0f",color:T.green,fontFamily:"monospace",fontSize:8.5,opacity:cdnPublishDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>CDN Publish</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>
                    {queuedCdnState.paths.length > 0 ? `${queuedCdnState.paths.length} queued paths` : "No queued paths"}
                  </span>
                </button>
              </div>
            </div>

            {/* Force Full Rebuild controls */}
            <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={() => !isRunning && startSiteOperation(`${API_BASE}/api/build/full`, "building")} disabled={isRunning}
                style={{
                padding:"12px 16px",borderRadius:9,border:`1.5px solid ${T.orange}55`,
                background:isRunning?T.orange+"08":T.orange+"14",
                color:T.orange,fontFamily:T.headingFont,fontWeight:800,fontSize:14,letterSpacing:1,
                boxShadow:isRunning?"none":`0 0 18px ${T.orange}2e`,
                opacity:isRunning?0.3:1,display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
              }}>
                <span>Force Full Rebuild</span>
                <span style={{fontSize:7,fontFamily:"monospace",opacity:0.6,letterSpacing:1}}>CLEAN AND SYNC</span>
              </button>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
                <button onClick={() => !isRunning && startSiteOperation(`${API_BASE}/api/build/astro-rebuild`, "building")} disabled={isRunning}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.blue}33`,
                  background:T.blue+"0f",color:T.blue,fontFamily:"monospace",fontSize:8.5,opacity:isRunning?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>Astro Rebuild</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Full page rebuild</span>
                </button>
                <button onClick={() => !dataRebuildDisabled && startSiteOperation(`${API_BASE}/api/build/s3-data-rebuild`, "syncing", "s3sync")} disabled={dataRebuildDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.purple}33`,
                  background:T.purple+"0f",color:T.purple,fontFamily:"monospace",fontSize:8.5,opacity:dataRebuildDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>S3 Data Rebuild</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Content/data only</span>
                </button>
                <button onClick={() => !imageRebuildDisabled && startSiteOperation(`${API_BASE}/api/build/s3-image-rebuild`, "syncing", "s3sync")} disabled={imageRebuildDisabled}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.yellow}33`,
                  background:T.yellow+"0d",color:T.yellow,fontFamily:"monospace",fontSize:8.5,opacity:imageRebuildDisabled?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>S3 Image Rebuild</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Images only</span>
                </button>
                <button onClick={() => {
                  if (isRunning) return;
                  if (!confirm("Run the full CDN invalidation manifest now?")) return;
                  startSiteOperation(`${API_BASE}/api/cdn/invalidate/live`, "cdn", "cdntab", "CDN invalidation error");
                }} disabled={isRunning}
                  style={{padding:"9px 10px",borderRadius:7,border:`1px solid ${T.cyan}33`,
                  background:T.cyan+"0a",color:T.cyan,fontFamily:"monospace",fontSize:8.5,opacity:isRunning?0.25:1,letterSpacing:0.5,
                  display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
                  <span>CDN Flush</span>
                  <span style={{fontSize:6.5,color:ink(0.42),letterSpacing:0.5,textTransform:"uppercase"}}>Full-site invalidation</span>
                </button>
              </div>
              <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.22),lineHeight:1.5,padding:"0 2px"}}>
                Split the full rebuild into individual site stages with live matrix, S3 sync, and CDN panel updates
              </div>
            </div>

            {/* Publish Queue (compact) */}
            <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{
                padding:"12px 16px",borderRadius:9,border:`1.5px solid ${T.green}55`,
                background:T.green+"0f",
                display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",
              }}>
                <span style={{fontFamily:T.headingFont,fontWeight:800,fontSize:14,letterSpacing:1,color:T.green}}>Publish Queue</span>
                <span style={{fontFamily:"monospace",fontSize:7,color:pendingUploadCount > 0 ? T.purple : pendingCount > 0 ? T.blue : ink(0.35),background:pendingUploadCount > 0 ? `${T.purple}16` : pendingCount > 0 ? `${T.blue}16` : ink(0.04),border:`1px solid ${pendingUploadCount > 0 ? `${T.purple}33` : pendingCount > 0 ? `${T.blue}33` : ink(0.08)}`,borderRadius:999,padding:"3px 8px",letterSpacing:0.8,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                  {publishQueueSummary}
                </span>
              </div>
              <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.22),lineHeight:1.5,padding:"0 2px"}}>
                Standalone publishes queue smart CDN paths until CDN Publish or CDN Flush.
              </div>
              {/* BUILD DATA IMAGES CDN */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
                {publishQueueCards.map(card => (
                  <div key={card.label} style={{background:ink(0.025),border:`1px solid ${card.count > 0 ? `${card.accent}33` : ink(0.08)}`,borderRadius:7,padding:"9px 10px",display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:card.count > 0 ? card.accent : ink(0.18),boxShadow:card.count > 0 ? `0 0 6px ${card.accent}` : "none",flexShrink:0}}/>
                        <span style={{fontFamily:"monospace",fontSize:8.5,color:card.count > 0 ? card.accent : ink(0.34),letterSpacing:0.5}}>{card.label}</span>
                      </div>
                      <span style={{minWidth:18,padding:"1px 5px",borderRadius:999,background:card.count > 0 ? `${card.accent}22` : ink(0.05),color:card.count > 0 ? card.accent : ink(0.4),fontFamily:"monospace",fontSize:7,fontWeight:700,textAlign:"center"}}>{card.count}</span>
                    </div>
                    <span style={{fontFamily:"monospace",fontSize:6.5,color:ink(0.28),letterSpacing:0.5,textTransform:"uppercase"}}>{card.state}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setQueuedCdnDetailOpen(true)}
                style={{
                  background:ink(0.025),
                  border:`1px solid ${publishQueueCdnLogState === "LIVE" || publishQueueCdnLogState === "RUNNING"
                    ? `${T.green}33`
                    : publishQueueCdnLogState === "QUEUED"
                      ? `${T.yellow}33`
                      : ink(0.08)}`,
                  borderRadius:7,
                  padding:"8px 10px",
                  display:"flex",
                  flexDirection:"column",
                  gap:4,
                  textAlign:"left",
                  cursor:"pointer",
                }}
              >
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                  <span style={{fontFamily:"monospace",fontSize:8,color:T.green,letterSpacing:0.8,textTransform:"uppercase"}}>CDN Queue Log</span>
                  <span style={{padding:"1px 5px",borderRadius:999,background:publishQueueCdnLogState === "LIVE" || publishQueueCdnLogState === "RUNNING" ? `${T.green}22` : publishQueueCdnLogState === "QUEUED" ? `${T.yellow}22` : ink(0.05),color:publishQueueCdnLogState === "LIVE" || publishQueueCdnLogState === "RUNNING" ? T.green : publishQueueCdnLogState === "QUEUED" ? T.yellow : ink(0.4),fontFamily:"monospace",fontSize:6.5,fontWeight:700,textAlign:"center",letterSpacing:0.8}}>
                    {publishQueueCdnLogState}
                  </span>
                </div>
                <div style={{fontFamily:"monospace",fontSize:6.5,color:ink(0.24),letterSpacing:0.5,textTransform:"uppercase"}}>
                  Click for details
                </div>
                <div style={{maxHeight:52,overflowY:"auto"}}>
                  {publishQueueCdnLogLines.length === 0 ? (
                    <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.2)}}>No CDN queue activity</div>
                  ) : publishQueueCdnLogLines.slice(0, 4).map(entry => (
                    <div key={entry.id} style={{fontFamily:"monospace",fontSize:7,lineHeight:1.5,color:entry.line.includes("AccessDenied") || entry.line.includes("FAILED") ? T.red : entry.line.includes("Completed") ? T.green : entry.line.includes("[queue]") ? T.yellow : ink(0.45),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {entry.line}
                    </div>
                  ))}
                </div>
              </button>
            </div>
          </div>
          </div>

          {/* SECTION 3: OPERATION STORYBOARD */}
          <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:T.cyan,letterSpacing:2,textTransform:"uppercase"}}>Operation Storyboard</div>
                <div style={{fontFamily:"monospace",fontSize:8,color:T.dim,marginTop:2}}>Monitors | Site Pipeline | Lambda Pipeline</div>
              </div>
              {phase==="done"&&<span style={{fontFamily:"monospace",fontSize:9,color:T.green,background:T.green+"1a",border:`1px solid ${T.green}33`,padding:"3px 10px",borderRadius:4}}>All stages complete | {elapsed.toFixed(1)}s</span>}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"minmax(220px,0.78fr) minmax(0,1.11fr) minmax(0,1.11fr)",gap:10,marginBottom:10,alignItems:"stretch"}}>
              <div style={{background:ink(0.02),border:`1px solid ${T.borderB}`,borderRadius:10,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8}}>
                <div>
                  <div style={{fontFamily:"monospace",fontSize:8,color:T.cyan,letterSpacing:1.2,textTransform:"uppercase"}}>Monitors</div>
                  <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.2),marginTop:2}}>Always-on signals that stay visible during every workflow.</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,flex:1}}>
                  {MONITOR_STAGES.map((s)=>{
                    const isWatcher = s.key === "watcher";
                    const isRecommender = s.key === "recommender";
                    const watcherActive = isWatcher && pendingCount > 0;
                    const recommenderWarn = isRecommender && hasProductChanges;
                    const st = watcherActive ? "watching" : recommenderWarn ? "warning" : "idle";
                    const bc = st==="watching"?T.cyan:st==="warning"?T.yellow:ink(0.08);
                    const tc = st==="watching"?T.cyan:st==="warning"?T.yellow:ink(0.25);
                    const dynamicSub = isWatcher
                      ? (pendingCount > 0 ? `${pendingCount} file${pendingCount!==1?"s":""} changed` : "No pending changes")
                      : (recommenderWarn ? "Product data changed - review recommender inputs" : "No product changes");
                    return (
                      <div key={s.key} style={{
                        background:st==="watching"?T.cyan+"0f":st==="warning"?T.yellow+"0f":ink(0.02),
                        border:`1.5px solid ${bc}`,borderRadius:9,padding:"9px 11px",
                        boxShadow:st!=="idle"?`0 0 12px ${bc}22`:"none",
                        transition:"all 0.4s ease",position:"relative",overflow:"hidden",
                      }}>
                        {st==="watching"&&<div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${T.cyan}06,transparent)`,animation:"sweep 2.5s ease-in-out infinite"}}/>}
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700}}>{s.icon}</span>
                          <div style={{width:6,height:6,borderRadius:"50%",background:bc,boxShadow:st!=="idle"?`0 0 7px ${bc}`:"none"}}/>
                        </div>
                        <div style={{fontFamily:"monospace",fontSize:9,fontWeight:700,color:tc,letterSpacing:0.3}}>{s.label}</div>
                        <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.2),marginTop:2}}>{dynamicSub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{background:ink(0.02),border:`1px solid ${isSiteMode ? T.blue+"55" : T.borderB}`,borderRadius:10,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8,opacity:isLambdaMode?0.68:1}}>
                <div>
                  <div style={{fontFamily:"monospace",fontSize:8,color:isSiteMode?T.blue:ink(0.35),letterSpacing:1.2,textTransform:"uppercase"}}>Site Pipeline</div>
                  <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.2),marginTop:2}}>
                    {isSiteMode ? "Active site deployment lane." : "Visible and idle until a site deploy starts."}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,flex:1}}>
                  {BUILD_STAGES.map((s)=>{
                    const st = laneStageState("site", s.key);
                    const bc = st==="done"?ink(0.28):st==="active"?s.col:ink(0.08);
                    const tc = st==="done"?ink(0.38):st==="active"?s.col:ink(0.25);
                    const pct = stageTilePct("site", s.key);
                    const siteStageDetailKey = SITE_STAGE_KEY_MAP[s.key];
                    const liveStageDetail = siteStageDetailKey ? siteStageDetail[siteStageDetailKey] : "";
                    const dynamicSub = st==="active" && liveStageDetail ? liveStageDetail : s.sub;
                    return (
                      <div key={s.key} style={{
                        background:st==="done"?ink(0.03):st==="active"?s.col+"12":ink(0.02),
                        border:`1.5px solid ${bc}`,borderRadius:9,padding:"9px 11px",
                        boxShadow:st==="active"?`0 0 18px ${s.col}22`:"none",
                        transition:"all 0.4s ease",position:"relative",overflow:"hidden",
                      }}>
                        {st==="active"&&<div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${s.col}08,transparent)`,animation:"sweep 1.8s ease-in-out infinite"}}/>}
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700}}>{s.icon}</span>
                          <div style={{width:6,height:6,borderRadius:"50%",background:bc,boxShadow:st!=="idle"?`0 0 7px ${bc}`:"none"}}/>
                        </div>
                        <div style={{fontFamily:"monospace",fontSize:8.5,fontWeight:700,color:tc,letterSpacing:0.3}}>{s.label}</div>
                        <div style={{fontFamily:"monospace",fontSize:7,color:st==="active" && liveStageDetail ? s.col : ink(0.2),marginTop:2,minHeight:18}}>{dynamicSub}</div>
                        <div style={{marginTop:7}}>
                          <ProgressBar pct={pct} color={st==="done"?ink(0.3):s.col} h={3}/>
                          {renderStageStatus(st, pct, s.col, "Complete")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{background:ink(0.02),border:`1px solid ${isLambdaMode ? T.orange+"55" : T.borderB}`,borderRadius:10,padding:"10px 11px",display:"flex",flexDirection:"column",gap:8,opacity:isSiteMode?0.68:1}}>
                <div>
                  <div style={{fontFamily:"monospace",fontSize:8,color:isLambdaMode?T.orange:ink(0.35),letterSpacing:1.2,textTransform:"uppercase"}}>Lambda Pipeline</div>
                  <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.2),marginTop:2}}>
                    {isLambdaMode ? "Active lambda deployment lane." : "Visible and idle until lambda deploy starts."}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8,flex:1}}>
                  {LAMBDA_DEPLOY_STAGES.map((s)=>{
                    const st = laneStageState("lambda", s.key);
                    const bc = st==="done"?ink(0.28):st==="active"?s.col:ink(0.08);
                    const tc = st==="done"?ink(0.38):st==="active"?s.col:ink(0.25);
                    const pct = stageTilePct("lambda", s.key);
                    return (
                      <div key={s.key} style={{
                        background:st==="done"?ink(0.03):st==="active"?s.col+"12":ink(0.02),
                        border:`1.5px solid ${bc}`,borderRadius:9,padding:"9px 11px",
                        boxShadow:st==="active"?`0 0 18px ${s.col}22`:"none",
                        transition:"all 0.4s ease",position:"relative",overflow:"hidden",
                      }}>
                        {st==="active"&&<div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${s.col}08,transparent)`,animation:"sweep 1.8s ease-in-out infinite"}}/>}
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:10,fontFamily:"monospace",fontWeight:700}}>{s.icon}</span>
                          <div style={{width:6,height:6,borderRadius:"50%",background:bc,boxShadow:st!=="idle"?`0 0 7px ${bc}`:"none"}}/>
                        </div>
                        <div style={{fontFamily:"monospace",fontSize:8.5,fontWeight:700,color:tc,letterSpacing:0.3}}>{s.label}</div>
                        <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.2),marginTop:2,minHeight:18}}>{s.sub}</div>
                        <div style={{marginTop:7}}>
                          <ProgressBar pct={pct} color={st==="done"?ink(0.3):s.col} h={3}/>
                          {renderStageStatus(st, pct, s.col, lambdaTileDoneValue(s.key))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{height:3,background:ink(0.05),borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${pCol},${pCol}88)`,
                width:pPct,transition:"width 1s ease",boxShadow:`0 0 8px ${pCol}`}}/>
            </div>
          </div>

          {/* SECTION 4: MAIN BODY */}
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 300px",gap:12,alignItems:"stretch",height:MAIN_BODY_PANEL_HEIGHT,minHeight:MAIN_BODY_PANEL_HEIGHT}}>

            {/* LEFT: tabs with terminal + matrix */}
            <div style={{display:"flex",flexDirection:"column",gap:12,minHeight:0,minWidth:0}}>

              {/* Completion summary */}
              {!isLambdaMode && (
                <div style={{
                  background:completionSummaryTone==="complete"
                    ? `linear-gradient(135deg,${T.cyan}0f,${T.blue}0a)`
                    : completionSummaryTone==="history"
                      ? `linear-gradient(135deg,${ink(0.05)},${ink(0.02)})`
                      : `linear-gradient(135deg,${ink(0.02)},${ink(0.015)})`,
                  border:`1px solid ${completionSummaryTone==="complete" ? T.cyan+"33" : completionSummaryTone==="history" ? T.borderB : ink(0.06)}`,
                  borderRadius:12,
                  padding:"14px 18px",
                  animation:completionSummaryTone==="complete" ? "rise 0.5s ease" : "none",
                  opacity:completionSummaryTone==="idle" ? 0.78 : 1,
                }}>
                  <div style={{fontSize:9,fontFamily:"monospace",color:completionSummaryTone==="idle" ? ink(0.22) : T.cyan,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>{completionSummaryTitle}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
                    {completionSummaryMetrics.map(m=>(
                      <div key={m.l} style={{
                        textAlign:"center",
                        background:completionSummaryTone==="complete" ? ink(0.03) : ink(0.02),
                        borderRadius:8,
                        padding:"10px 6px",
                        border:completionSummaryTone==="idle" ? `1px solid ${ink(0.05)}` : "1px solid transparent",
                      }}>
                        <div style={{fontSize:7,fontFamily:"monospace",color:completionSummaryTone==="idle" ? ink(0.22) : ink(0.28),letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{m.l}</div>
                        <div style={{fontSize:22,fontWeight:900,fontFamily:"monospace",color:m.c,textShadow:completionSummaryTone==="idle" ? "none" : `0 0 14px ${m.c}`,lineHeight:1}}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabbed terminal/matrix */}
              <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column",flex:1,minHeight:0,minWidth:0,height:"100%"}}>
                <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border}`,padding:"0 14px",background:T.insetBg}}>
                  {SITE_BUILD_PANEL_TABS.map(renderPanelTab)}
                  <div style={{width:1,height:16,background:T.borderB,margin:"0 8px 0 4px",flexShrink:0}}/>
                  {renderPanelTab(LAMBDA_PANEL_TAB)}
                  <div style={{flex:1}}/>
                  <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.15),paddingRight:8}}>{termLines.length} log lines</span>
                </div>

                {/* TERMINAL TAB */}
                {activeTab==="terminal"&&(
                  <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:ink(0.02),borderBottom:`1px solid ${T.borderB}`}}>
                      {["#f87171","#fbbf24","#34d399"].map((c,i)=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:c,opacity:0.7}}/>)}
                      <span style={{fontFamily:"monospace",fontSize:9,color:ink(0.18),marginLeft:4,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {phase==="idle"?"~ awaiting command":phase==="recommender"?"~ python recommender.py":phase==="building"?"~ npm run build":phase==="syncing"?"~ aws s3 sync":phase==="cdn"?"~ aws cloudfront create-invalidation":["lambda-package","lambda-upload","lambda-deploy","lambda-live"].includes(phase)?"~ node scripts/deploy-aws.mjs --skip-build --skip-static --skip-invalidate":"~ deployment complete"}
                      </span>
                    </div>
                    <div ref={termRef} style={{flex:1,minHeight:0,overflowY:"auto",overflowX:"hidden",padding:"10px 14px",display:"flex",flexDirection:"column",position:"relative"}}>
                      {phase==="idle"&&!termLines.length&&(
                        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                          <div style={{fontFamily:"monospace",fontSize:11,color:ink(0.1),letterSpacing:3}}>AWAITING COMMAND<span style={{animation:"blink 1s step-end infinite"}}>|</span></div>
                        </div>
                      )}
                      {termLines.map(l=><TermLine key={l.id} text={l.text} kind={l.kind}/>)}
                      {isRunning&&<div style={{fontFamily:"monospace",fontSize:10,color:pCol,animation:"blink 0.8s step-end infinite"}}>|</div>}
                    </div>
                    <div style={{height:3,background:ink(0.04)}}>
                      <div style={{height:"100%",background:`linear-gradient(90deg,${pCol},${pCol}88)`,width:pPct,transition:"width 1s ease",boxShadow:`0 0 6px ${pCol}`}}/>
                    </div>
                  </div>
                )}

                {/* LAMBDA TAB */}
                {activeTab==="lambda"&&(
                  <div style={{padding:"14px",display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:12}}>
                      {LAMBDA_DEPLOY_STAGES.map(s=>{
                        const st = runMode === "lambda" ? laneStageState("lambda", s.key) : "idle";
                        const pct = runMode === "lambda" ? stageTilePct("lambda", s.key) : 0;
                        const color = st==="active"?s.col:st==="done"?ink(0.28):ink(0.18);
                        return (
                          <div key={s.key} style={{background:ink(0.02),border:`1px solid ${color}55`,borderRadius:10,padding:"10px"}}>
                            <div style={{fontFamily:"monospace",fontSize:8,fontWeight:700,color,letterSpacing:0.8}}>{s.label}</div>
                            <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.22),marginTop:4,minHeight:18}}>{s.sub}</div>
                            <div style={{marginTop:8}}><ProgressBar pct={pct} color={color} h={3}/></div>
                            {renderStageStatus(st, pct, color, lambdaTileDoneValue(s.key))}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{background:T.orange+"0f",border:`1px solid ${T.orange}33`,borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:8}}>
                        <div>
                          <div style={{fontFamily:"monospace",fontSize:8,color:T.orange,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Packaging Progress</div>
                          <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.28)}}>
                            {runMode !== "lambda"
                              ? "Visible during Lambda artifact packaging."
                              : phase === "lambda-package"
                                ? "Streaming live archive progress from archiver."
                                : lambdaPackagePct >= 100
                                  ? "Packaging complete."
                                  : "Waiting for packaging stage."}
                          </div>
                        </div>
                        <div style={{fontFamily:T.monoFont,fontSize:28,color:T.orange,textShadow:`0 0 14px ${T.orange}`,lineHeight:1}}>
                          {lambdaPackagePct}%
                        </div>
                      </div>
                      <ProgressBar pct={lambdaPackagePct} color={T.orange} h={4}/>
                    </div>
                    <div style={{background:ink(0.02),border:`1px solid ${ink(0.08)}`,borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                      <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>REAL COMMAND</div>
                      <div style={{fontFamily:"monospace",fontSize:9,color:ink(0.48)}}>node scripts/deploy-aws.mjs --skip-build --skip-static --skip-invalidate</div>
                    </div>
                    <div style={{background:T.insetBg,border:`1px solid ${ink(0.06)}`,borderRadius:10,padding:"10px 12px",flex:1,minHeight:0,overflowY:"auto"}}>
                      {runMode!=="lambda" ? (
                        <div style={{textAlign:"center",padding:"48px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                          Start a lambda deploy to see lambda-only logs.
                        </div>
                      ) : termLines.length === 0 ? (
                        <div style={{textAlign:"center",padding:"48px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                          Waiting for lambda events...
                        </div>
                      ) : (
                        termLines.map(l=><TermLine key={l.id} text={l.text} kind={l.kind}/>)
                      )}
                    </div>
                  </div>
                )}

                {/* MATRIX TAB */}
                {activeTab==="matrix"&&(
                  <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    {isLambdaMode ? (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:0,textAlign:"center",padding:"56px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                        Lambda deployment does not update page build rows.
                      </div>
                    ) : showIncrementalPublishMatrixNotice ? (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:0,textAlign:"center",padding:"56px 0 48px",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                        <div>
                          <div style={{fontSize:10,color:ink(0.32),marginBottom:8}}>Cached publish does not expose per-page route rows.</div>
                          <div style={{fontSize:8.5,color:ink(0.22),lineHeight:1.6}}>Use Force Full Rebuild or Astro Rebuild for live page inventory.</div>
                        </div>
                      </div>
                    ) : matrixRows.length === 0 ? (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:0,textAlign:"center",padding:"56px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                        Waiting for live page inventory.
                      </div>
                    ) : (
                      <>
                        {showMatrixPreRouteNotice && (
                          <div style={{padding:"10px 14px",borderBottom:`1px solid ${ink(0.06)}`,background:T.blue+"0f"}}>
                            <div style={{fontFamily:"monospace",fontSize:9,color:T.blue,letterSpacing:0.8,marginBottom:4}}>
                              Astro is preparing static entrypoints.
                            </div>
                            <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.4),lineHeight:1.5}}>
                              Page rows will begin once route generation starts.
                            </div>
                            {siteStageDetail.build && (
                              <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.28),marginTop:6}}>
                                Current build signal: {siteStageDetail.build}
                              </div>
                            )}
                          </div>
                        )}
                        <div style={{display:"grid",gridTemplateColumns:"90px 1fr 160px 80px 64px 90px",gap:10,padding:"6px 14px",
                          borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                          {["STATUS","PATH / FILE","PROGRESS","ELAPSED","ACTIONS",""].map((h,i)=>(
                            <div key={i} style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),letterSpacing:1,textTransform:"uppercase"}}>{h}</div>
                          ))}
                        </div>
                        <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                          {matrixRows.map(r=><MatrixRow key={r.id} row={r} isRunning={isSiteMode && isRunning} categoryMeta={CATEGORY_META}/>)}
                        </div>
                        <div style={{padding:"6px 14px",borderTop:`1px solid ${ink(0.05)}`,display:"flex",gap:12}}>
                          {[
                            {l:"Success",c:T.green,  n:matrixRows.filter(r=>r.status==="success").length},
                            {l:"Building",c:T.blue,  n:matrixRows.filter(r=>r.status==="building").length},
                            {l:"Queued",  c:T.yellow, n:matrixRows.filter(r=>r.status==="queued").length},
                            {l:"Failed",  c:T.red,    n:matrixRows.filter(r=>r.status==="failed").length},
                          ].map(s=>(
                            <div key={s.l} style={{display:"flex",alignItems:"center",gap:4}}>
                              <div style={{width:5,height:5,borderRadius:"50%",background:s.c,boxShadow:`0 0 4px ${s.c}`}}/>
                              <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.3)}}>{s.l}: <strong style={{color:s.c}}>{s.n}</strong></span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* CATEGORIES TAB */}
                {activeTab==="categories"&&(
                  <div style={{padding:"14px",display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    {isLambdaMode ? (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:0,textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                        Lambda deployment does not update category progress.
                      </div>
                    ) : pageCategorySummaries.length > 0 ? (
                      <div style={{flex:1,minHeight:0,overflowY:"auto"}}>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                          {pageCategorySummaries.map(c=>(
                            <div key={c.path} style={{background:ink(0.025),border:`1px solid ${ink(0.07)}`,borderRadius:10,padding:"12px",display:"flex",flexDirection:"column",gap:7,position:"relative",overflow:"hidden"}}>
                              <div style={{position:"absolute",bottom:0,left:0,right:0,height:2}}>
                                <div style={{height:"100%",background:c.color,width:`${c.target>0?Math.round((c.current/c.target)*100):0}%`,transition:"width 0.3s ease",boxShadow:`0 0 5px ${c.color}`}}/>
                              </div>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:13}}>{c.icon}</span>
                                  <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.35)}}>{c.path}</span>
                                </div>
                                <span style={{fontFamily:"monospace",fontSize:7,color:c.color,background:c.color+"20",padding:"1px 4px",borderRadius:2}}>{c.target>0?Math.round((c.current/c.target)*100):0}%</span>
                              </div>
                              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:4}}>
                                <div>
                                  <div style={{fontSize:24,fontWeight:900,fontFamily:"monospace",color:c.color,textShadow:`0 0 12px ${c.color}`,lineHeight:1}}>
                                    {c.current}<span style={{fontSize:10,color:ink(0.2),fontWeight:400}}>/{c.target}</span>
                                  </div>
                                  <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.25),marginTop:2}}>pages built</div>
                                </div>
                                <Ring value={c.current} max={c.target} color={c.color} size={40} stroke={4}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,minHeight:0,textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:2}}>
                        WAITING FOR LIVE CATEGORY INVENTORY
                      </div>
                    )}
                  </div>
                )}

                {/* S3 SYNC TAB */}
                {activeTab==="s3sync"&&(
                  <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"10px 14px",borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                      {S3_SYNC_SUBTABS.map(tab=>{
                        const count = syncFiles.filter(file => file.scope === tab.scope && file.op === tab.op).length;
                        const isActive = activeS3SyncSubtab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={()=>setActiveS3SyncSubtab(tab.key)}
                            style={{
                              background:isActive ? `${tab.color}1a` : ink(0.03),
                              border:`1px solid ${isActive ? `${tab.color}66` : ink(0.08)}`,
                              borderRadius:7,
                              padding:"7px 10px",
                              display:"inline-flex",
                              alignItems:"center",
                              gap:8,
                              fontFamily:"monospace",
                              fontSize:8,
                              letterSpacing:0.8,
                              textTransform:"uppercase",
                              color:isActive ? tab.color : ink(0.38),
                              boxShadow:isActive ? `0 0 10px ${tab.color}22` : "none",
                            }}
                          >
                            <span>{tab.label}</span>
                            <span style={{
                              minWidth:18,
                              padding:"1px 6px",
                              borderRadius:999,
                              background:isActive ? `${tab.color}22` : ink(0.06),
                              color:isActive ? tab.color : ink(0.46),
                              fontWeight:700,
                              textAlign:"center",
                            }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"70px 1fr 100px",gap:10,padding:"6px 14px",
                      borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                      {["OPERATION","S3 KEY / PATH","TIME"].map((h,i)=>(
                        <div key={i} style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),letterSpacing:1,textTransform:"uppercase"}}>{h}</div>
                      ))}
                    </div>
                    <div ref={s3Ref} style={{flex:1,minHeight:0,overflowY:"auto"}}>
                      {isLambdaMode ? (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                          Lambda deployment does not run S3 site sync.
                        </div>
                      ) : syncFiles.length === 0 ? (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:2}}>
                          {isRunning ? "WAITING FOR S3 SYNC STAGE..." : "START A BUILD TO SEE S3 SYNC DATA"}
                        </div>
                      ) : visibleSyncFiles.length === 0 ? (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1.4}}>
                          {isRunning ? `WAITING FOR ${activeS3SyncSubtabMeta.label}...` : `NO ${activeS3SyncSubtabMeta.label} EVENTS IN THIS RUN`}
                        </div>
                      ) : visibleSyncFiles.map(f => (
                        <div key={f.id} style={{
                          display:"grid",gridTemplateColumns:"70px 1fr 100px",gap:10,
                          padding:"5px 14px",borderBottom:`1px solid ${ink(0.04)}`,
                          background:f.op==="delete"?T.red+"08":"transparent",
                          alignItems:"start",
                        }}>
                          <span style={{
                            fontFamily:"monospace",fontSize:8,fontWeight:700,letterSpacing:0.8,
                            color:f.op==="upload"?T.purple:T.red,
                            background:f.op==="upload"?T.purple+"1e":T.red+"1e",
                            padding:"2px 6px",borderRadius:3,textAlign:"center",alignSelf:"start",
                          }}>{f.op==="upload"?"UPLOAD":"DELETE"}</span>
                          <span style={{fontFamily:"monospace",fontSize:9,color:ink(0.55),whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word",lineHeight:1.5,alignSelf:"start"}}>{f.path}</span>
                          <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.2),alignSelf:"start",textAlign:"right",paddingTop:2}}>{f.at}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{padding:"6px 14px",borderTop:`1px solid ${ink(0.05)}`,display:"flex",gap:12}}>
                      {S3_SYNC_SUBTABS.map(tab=>(
                        <div key={tab.key} style={{display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:tab.color,boxShadow:`0 0 4px ${tab.color}`}}/>
                          <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.3)}}>{tab.label}: <strong style={{color:tab.color}}>{syncFiles.filter(file => file.scope === tab.scope && file.op === tab.op).length}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CDN TAB */}
                {activeTab==="cdntab"&&(
                  <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,padding:"10px 14px",
                      borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                      {[
                        {
                          l:"Mode",
                          v:displayCdnMetrics.mode || "--",
                          sub:displayCdnMetrics.mode ? `${displayCdnMetrics.mode === "SMART" ? "Quick" : "Full"} invalidation plan` : "No invalidation plan yet",
                          c:displayCdnMetrics.mode === "FULL" ? T.orange : displayCdnMetrics.mode === "SMART" ? T.cyan : T.dimmer,
                        },
                        {
                          l:"Planned Paths",
                          v:String(displayCdnMetrics.plannedPathCount || cdnCleared || 0),
                          sub:displayCdnMetrics.plannedPathCount > 0
                            ? `${displayCdnMetrics.wildcardPathCount} wildcard, ${displayCdnMetrics.exactPathCount} exact`
                            : "No CDN-facing paths planned",
                          c:(displayCdnMetrics.plannedPathCount || cdnCleared) > 0 ? T.cyan : T.dimmer,
                        },
                        {
                          l:"Groups",
                          v:displayCdnMetrics.groupCount > 0 ? `${cdnResolvedCount}/${displayCdnMetrics.groupCount}` : "--",
                          sub:displayCdnMetrics.groupCount > 0
                            ? `Current group ${displayCdnMetrics.currentGroup || Math.min(cdnResolvedCount + 1, displayCdnMetrics.groupCount)}/${displayCdnMetrics.groupCount}`
                            : "No invalidation groups yet",
                          c:displayCdnMetrics.groupCount > 0 ? T.purple : T.dimmer,
                        },
                        {
                          l:"Invalidations",
                          v:String(cdnCreatedCount),
                          sub:displayCdnMetrics.lastInvalidationId ? `Last ID ${displayCdnMetrics.lastInvalidationId}` : "No invalidation IDs yet",
                          c:cdnCreatedCount > 0 ? T.green : T.dimmer,
                        },
                        {
                          l:"Polling",
                          v:cdnPollingState,
                          sub:displayCdnMetrics.lastPermissionAction
                            ? `${displayCdnMetrics.lastPermissionAction} permission required`
                            : cdnPollingState === "UNVERIFIED"
                              ? "Invalidation request created, but completion could not be verified"
                            : cdnPollingState === "QUEUED"
                              ? `${queuedCdnState.paths.length} queued paths waiting for CDN Publish or Flush`
                            : siteStageDetail.cdn || displayCdnMetrics.currentAction || "Waiting for CDN stage",
                          c:cdnPollingColor,
                        },
                        {
                          l:"Last Error",
                          v:displayCdnMetrics.lastErrorCode || "--",
                          sub:displayCdnMetrics.lastErrorMessage || "No CDN errors recorded",
                          c:displayCdnMetrics.lastErrorCode ? T.red : T.dimmer,
                        },
                      ].map(card => (
                        <div key={card.l} style={{background:ink(0.02),border:`1px solid ${T.borderB}`,borderRadius:7,padding:"8px 10px"}}>
                          <div style={{fontSize:7.5,fontFamily:"monospace",color:ink(0.25),letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{card.l}</div>
                          <div style={{fontFamily:T.monoFont,fontSize:16,color:card.c,lineHeight:1.1}}>{card.v}</div>
                          <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.36),marginTop:4,lineHeight:1.45,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word"}}>{card.sub}</div>
                        </div>
                      ))}
                    </div>
                    {displayCdnMetrics.lastErrorCode && (
                      <div style={{padding:"8px 14px",borderBottom:`1px solid ${ink(0.06)}`,background:T.red+"14",color:T.red,fontFamily:"monospace",fontSize:8.5,lineHeight:1.6}}>
                        {displayCdnMetrics.lastErrorCode}: {displayCdnMetrics.lastErrorMessage}
                      </div>
                    )}
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,padding:"8px 14px",
                      borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                      <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),letterSpacing:1,textTransform:"uppercase"}}>PLANNED INVALIDATION PATHS</div>
                      {displayCdnMetrics.plannedPaths.length === 0 ? (
                        <div style={{fontFamily:"monospace",fontSize:8.5,color:ink(0.24),lineHeight:1.6}}>
                          Awaiting invalidation manifest.
                        </div>
                      ) : (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}}>
                          {displayCdnMetrics.plannedPaths.map(pathValue => {
                            const cdnPathState = getCdnPathStateLabel(displayCdnMetrics, pathValue);
                            const cdnPathStateMeta = cdnPathState === "cleared"
                              ? { color: T.green, label: "CLEARED" }
                              : cdnPathState === "unverified"
                                ? { color: T.orange, label: "UNVERIFIED" }
                                : cdnPathState === "in-flight"
                                  ? { color: T.yellow, label: "IN FLIGHT" }
                                  : { color: ink(0.28), label: "PLANNED" };
                            return (
                              <div key={pathValue} style={{
                                background:cdnPathState === "cleared"
                                  ? T.green+"14"
                                  : cdnPathState === "unverified"
                                    ? T.orange+"14"
                                    : cdnPathState === "in-flight"
                                      ? T.yellow+"14"
                                      : ink(0.03),
                                border:`1px solid ${cdnPathStateMeta.color}33`,
                                borderRadius:5,
                                padding:"6px 7px",
                                display:"flex",
                                flexDirection:"column",
                                gap:5,
                              }}>
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                                  <span style={{
                                    width:6,
                                    height:6,
                                    borderRadius:"50%",
                                    background:cdnPathStateMeta.color,
                                    boxShadow:`0 0 6px ${cdnPathStateMeta.color}`,
                                    flexShrink:0,
                                  }}/>
                                  <span style={{
                                    fontFamily:"monospace",
                                    fontSize:7,
                                    fontWeight:700,
                                    letterSpacing:0.8,
                                    color:cdnPathStateMeta.color,
                                    textTransform:"uppercase",
                                  }}>{cdnPathStateMeta.label}</span>
                                </div>
                                <div style={{
                                  fontFamily:"monospace",
                                  fontSize:8,
                                  color:ink(0.62),
                                  whiteSpace:"normal",
                                  overflowWrap:"anywhere",
                                  wordBreak:"break-word",
                                  lineHeight:1.5,
                                }}>{pathValue}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,padding:"6px 14px",
                      borderBottom:`1px solid ${ink(0.06)}`,background:T.insetBg}}>
                      <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),letterSpacing:1,textTransform:"uppercase"}}>CDN INVALIDATION OUTPUT</div>
                    </div>
                    <div style={{flex:1,minHeight:0,overflowY:"auto",padding:"10px 14px"}}>
                      {isLambdaMode ? (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:1}}>
                          Lambda deployment does not invalidate the site CDN.
                        </div>
                      ) : displayCdnPaths.length === 0 ? (
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100%",textAlign:"center",padding:"40px 0",fontFamily:"monospace",fontSize:10,color:ink(0.15),letterSpacing:2}}>
                          {phase==="cdn" ? "RUNNING CDN INVALIDATION..." : "CDN INVALIDATION DATA WILL APPEAR DURING DEPLOY"}
                        </div>
                      ) : displayCdnPaths.map(p => (
                        <div key={p.id} style={{
                          fontFamily:"monospace",fontSize:9.5,lineHeight:1.7,
                          color:p.line.includes("AccessDenied") || p.line.includes("FAILED") ? T.red : p.line.includes("Completed") ? T.green : ink(0.5),
                          whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word",
                          animation:"slideUp 0.12s ease forwards",opacity:0,
                        }}>{p.line}</div>
                      ))}
                    </div>
                    <div style={{padding:"6px 14px",borderTop:`1px solid ${ink(0.05)}`,display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:T.green,boxShadow:`0 0 4px ${T.green}`}}/>
                        <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.3)}}>Distribution <strong style={{color:T.green}}>{displayCdnMetrics.distributionId || "--"}</strong></span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:T.cyan,boxShadow:`0 0 4px ${T.cyan}`}}/>
                        <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.3)}}>Action <strong style={{color:T.cyan}}>{displayCdnMetrics.currentAction || "--"}</strong></span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:T.purple,boxShadow:`0 0 4px ${T.purple}`}}/>
                        <span style={{fontFamily:"monospace",fontSize:8,color:ink(0.3)}}>Last ID <strong style={{color:T.purple}}>{displayCdnMetrics.lastInvalidationId || "--"}</strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{display:"flex",flexDirection:"column",gap:11,minHeight:0,overflowY:"auto"}}>

              {/* Changed files */}
              <Panel
                loading={isPanelLoading}
                title={`Changed Files (${pendingCount})`}
                icon="FILES"
                accent={T.yellow+"33"}
                style={{height:SIDEBAR_PANEL_HEIGHTS.changedFiles}}
                headerRight={(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",alignItems:"stretch",gap:6,width:"min(390px,100%)"}}>
                    <button
                      onClick={() => !isRunning && startFakeChanges()}
                      disabled={isRunning || fakeChangesBusy}
                      style={{
                        padding:"6px 10px",
                        borderRadius:999,
                        border:`1px solid ${T.yellow}33`,
                        background:fakeChangesBusy ? T.yellow+"0f" : T.yellow+"1e",
                        color:fakeChangesBusy ? ink(0.35) : T.yellow,
                        fontFamily:"monospace",
                        fontSize:7.5,
                        letterSpacing:0.8,
                        textTransform:"uppercase",
                        whiteSpace:"nowrap",
                        display:"inline-flex",
                        alignItems:"center",
                        justifyContent:"center",
                        width:"100%",
                        minWidth:0,
                      }}
                    >
                      SIMULATE CHANGES
                    </button>
                    <button
                      onClick={startCachePurge}
                      disabled={isRunning || cachePurgeBusy}
                      style={{
                        padding:"6px 10px",
                        borderRadius:999,
                        border:`1px solid ${ink(0.09)}`,
                        background:cachePurgeBusy ? ink(0.02) : ink(0.03),
                        color:(isRunning || cachePurgeBusy) ? ink(0.28) : ink(0.42),
                        fontFamily:"monospace",
                        fontSize:7.5,
                        letterSpacing:0.8,
                        textTransform:"uppercase",
                        whiteSpace:"nowrap",
                        display:"inline-flex",
                        alignItems:"center",
                        justifyContent:"center",
                        width:"100%",
                        minWidth:0,
                      }}
                    >
                      PURGE CACHE
                    </button>
                  </div>
                )}
              >
                <div style={{display:"flex",flexDirection:"column",gap:4,flex:1,minHeight:0,overflowY:"auto"}}>
                  <div style={{display:"flex",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                    {CHANGED_FILE_SUBTABS.map(tab => {
                      const count = tab.key === "images"
                        ? allPendingFiles.filter(file => file.category === "image").length
                        : pendingFiles.filter(file => file.category !== "image").length;
                      const isActive = activeChangedFilesSubtab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveChangedFilesSubtab(tab.key)}
                          style={{
                            background:isActive ? `${tab.color}1a` : ink(0.03),
                            border:`1px solid ${isActive ? `${tab.color}66` : ink(0.08)}`,
                            borderRadius:6,
                            padding:"5px 8px",
                            display:"inline-flex",
                            alignItems:"center",
                            gap:6,
                            fontFamily:"monospace",
                            fontSize:7.5,
                            letterSpacing:0.8,
                            textTransform:"uppercase",
                            color:isActive ? tab.color : ink(0.38),
                          }}
                        >
                          <span>{tab.label}</span>
                          <span style={{
                            minWidth:16,
                            padding:"1px 5px",
                            borderRadius:999,
                            background:isActive ? `${tab.color}22` : ink(0.06),
                            color:isActive ? tab.color : ink(0.46),
                            fontWeight:700,
                            textAlign:"center",
                          }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {visiblePendingFiles.length === 0 ? (
                    <div style={{fontFamily:"monospace",fontSize:9,color:ink(0.2),textAlign:"center",padding:"12px 0"}}>No pending changes</div>
                  ) : visiblePendingFiles.map((f, i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",
                      background:ink(0.02),borderRadius:5}}>
                      <div style={{width:4,height:4,borderRadius:"50%",background:f.category === "image" ? T.blue : T.yellow,boxShadow:`0 0 4px ${f.category === "image" ? T.blue : T.yellow}`,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"monospace",fontSize:9,color:ink(0.6),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(() => { const segs = f.path.split("/").filter(Boolean); const name = segs[segs.length - 1] || ""; return /^index\.\w+$/.test(name) && segs.length >= 2 ? segs[segs.length - 2] + "/" + name : name; })()}</div>
                        <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.22),marginTop:1}}>{f.category} | {timeAgo(f.mtime)}</div>
                      </div>
                      <span style={{fontSize:7,fontFamily:"monospace",color:f.file_type === "NEW" ? T.green : f.category === "image" ? T.blue : T.yellow,background:f.file_type === "NEW" ? T.green+"18" : f.category === "image" ? T.blue+"18" : T.yellow+"18",padding:"1px 4px",borderRadius:2,flexShrink:0}}>{(f.file_type || "MODIFIED").toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Infra dependencies */}
              <Panel title="Infra Dependencies" loading={isInfraPanelLoading} icon="DB" accent={T.green+"33"} style={{flex:1,minHeight:0}}>
                <div style={{display:"flex",flexDirection:"column",gap:10,flex:1,minHeight:0,overflowY:"auto"}}>
                  <div>
                    <div style={{fontSize:7.5,fontFamily:"monospace",color:ink(0.22),marginBottom:6}}>DEPENDENCY RESOURCES</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {infraResources.length === 0 ? (
                        <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),padding:"6px 0"}}>No live dependency data</div>
                      ) : infraResources.map(resource => (
                        <div key={resource.key} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",background:ink(0.03),borderRadius:5}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <div style={{fontFamily:"monospace",fontSize:8.5,color:ink(0.54),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{resource.label}</div>
                              <span style={{fontFamily:"monospace",fontSize:7,color:T.dim,background:ink(0.05),padding:"1px 4px",borderRadius:3,flexShrink:0}}>{resource.kind.toUpperCase()}</span>
                            </div>
                            <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.22),marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{resource.detail}</div>
                          </div>
                          <StatusBadge status={resource.status} small />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{fontSize:7.5,fontFamily:"monospace",color:ink(0.22),marginBottom:6}}>WATCHED LAMBDA PATHS</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {lambdaFolderLinks.length === 0 ? (
                        <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),padding:"2px 0"}}>No Lambda ownership paths resolved</div>
                      ) : lambdaFolderLinks.map(link => (
                        <div key={link.path} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",background:ink(0.03),borderRadius:5}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.45),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{link.path}</div>
                            <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.22),marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{link.functionName}</div>
                          </div>
                          <StatusBadge status={link.status} small />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{fontSize:7.5,fontFamily:"monospace",color:ink(0.22),marginBottom:6}}>OPERATOR HEALTH</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {infraHealthChecks.length === 0 ? (
                        <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.25),padding:"2px 0"}}>No health checks available</div>
                      ) : infraHealthChecks.map(check => (
                        <div key={check.key} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 6px",background:ink(0.03),borderRadius:5}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.5),whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{check.label}</div>
                            <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.22),marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{check.detail}</div>
                          </div>
                          <StatusBadge status={check.status} small />
                        </div>
                      ))}
                    </div>
                  </div>

                  {infraError && (
                    <div style={{fontFamily:"monospace",fontSize:7,color:T.red,background:T.red+"14",border:`1px solid ${T.red}33`,borderRadius:5,padding:"6px 8px"}}>
                      Stack lookup degraded: {infraError}
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
          <div style={{padding:"8px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between"}}>
          <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.12),letterSpacing:1}}>Node 20.11 | Astro 4.8.3 | Tailwind 3.4 | AWS CLI 2.15 | CloudFront 2024</div>
          <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.12),letterSpacing:1}}>DEPLOYCTL v3.0.0 | Office Server | us-east-1</div>
        </div>
      </div>
      {queuedCdnDetailOpen && (
        <div
          onClick={() => setQueuedCdnDetailOpen(false)}
          style={{
            position:"fixed",
            inset:0,
            background:`${T.bg}d0`,
            backdropFilter:"blur(6px)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            padding:24,
            zIndex:40,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width:"min(980px, 100%)",
              maxHeight:"min(82vh, 900px)",
              overflow:"hidden",
              display:"flex",
              flexDirection:"column",
              background:T.panel,
              border:`1px solid ${T.green}33`,
              borderRadius:14,
              boxShadow:`0 20px 60px ${T.floatShadow}`,
            }}
          >
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.borderB}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:T.headingFont,fontWeight:800,fontSize:18,letterSpacing:0.8,color:T.green}}>CDN Queue Details</div>
                <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.28),marginTop:3}}>
                  Persisted smart invalidations stay here until CDN Publish or CDN Flush clears them.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQueuedCdnDetailOpen(false)}
                style={{
                  padding:"7px 10px",
                  borderRadius:8,
                  border:`1px solid ${T.green}33`,
                  background:T.green+"14",
                  color:T.green,
                  fontFamily:"monospace",
                  fontSize:8,
                  letterSpacing:0.8,
                  textTransform:"uppercase",
                }}
              >
                Close
              </button>
            </div>
            <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,borderBottom:`1px solid ${T.borderB}`,background:ink(0.02)}}>
              <div style={{background:ink(0.03),border:`1px solid ${T.borderB}`,borderRadius:8,padding:"10px 11px"}}>
                <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),letterSpacing:0.8,textTransform:"uppercase"}}>Queue State</div>
                <div style={{fontFamily:T.monoFont,fontSize:16,color:queuedCdnState.status === "RUNNING" ? T.green : queuedCdnState.status === "QUEUED" ? T.yellow : ink(0.38),marginTop:5}}>{queuedCdnState.status}</div>
              </div>
              <div style={{background:ink(0.03),border:`1px solid ${T.borderB}`,borderRadius:8,padding:"10px 11px"}}>
                <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),letterSpacing:0.8,textTransform:"uppercase"}}>Entries</div>
                <div style={{fontFamily:T.monoFont,fontSize:16,color:T.cyan,marginTop:5}}>{queuedCdnState.entries.length}</div>
              </div>
              <div style={{background:ink(0.03),border:`1px solid ${T.borderB}`,borderRadius:8,padding:"10px 11px"}}>
                <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),letterSpacing:0.8,textTransform:"uppercase"}}>Queued Paths</div>
                <div style={{fontFamily:T.monoFont,fontSize:16,color:T.green,marginTop:5}}>{queuedCdnState.paths.length}</div>
              </div>
            </div>
            <div style={{padding:"14px 16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
              {queuedCdnState.entries.length === 0 ? (
                <div style={{fontFamily:"monospace",fontSize:9,color:ink(0.24),padding:"14px 2px"}}>
                  No persisted CDN queue entries.
                </div>
              ) : queuedCdnState.entries.map((entry) => (
                <div key={entry.id} style={{border:`1px solid ${entry.status === "RUNNING" ? `${T.green}33` : `${T.yellow}22`}`,borderRadius:10,background:ink(0.025),padding:"12px 13px",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontFamily:T.headingFont,fontWeight:700,fontSize:14,color:entry.status === "RUNNING" ? T.green : T.yellow}}>{entry.label}</span>
                      <span style={{padding:"2px 6px",borderRadius:999,background:entry.status === "RUNNING" ? `${T.green}22` : `${T.yellow}22`,color:entry.status === "RUNNING" ? T.green : T.yellow,fontFamily:"monospace",fontSize:7,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase"}}>{entry.status}</span>
                      <span style={{padding:"2px 6px",borderRadius:999,background:ink(0.06),color:ink(0.45),fontFamily:"monospace",fontSize:7,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase"}}>{entry.mode || "SMART"}</span>
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:7.5,color:ink(0.28)}}>
                      {entry.paths.length} path{entry.paths.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {entry.reason && (
                    <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.34),lineHeight:1.6}}>
                      {entry.reason}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
                    <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),letterSpacing:0.8,textTransform:"uppercase"}}>
                      Queued {entry.queuedAt ? timeAgo(entry.queuedAt) : "just now"}
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:7,color:ink(0.24),letterSpacing:0.8,textTransform:"uppercase",textAlign:"right"}}>
                      {entry.startedAt ? `Running ${timeAgo(entry.startedAt)}` : (queuedCdnState.activeAction || "Pending CDN action")}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
                    {entry.paths.map((pathValue) => (
                      <div key={`${entry.id}:${pathValue}`} style={{background:T.insetBg,border:`1px solid ${T.borderB}`,borderRadius:6,padding:"6px 7px",fontFamily:"monospace",fontSize:8,color:ink(0.56),lineHeight:1.5,whiteSpace:"normal",overflowWrap:"anywhere",wordBreak:"break-word"}}>
                        {pathValue}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {routeGraphWarning && phase === "done" && (
        <div
          onClick={() => setRouteGraphWarning(null)}
          style={{
            position:"fixed",
            inset:0,
            background:`${T.bg}d0`,
            backdropFilter:"blur(6px)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            padding:24,
            zIndex:50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width:routeGraphLogExpanded ? "min(820px, 100%)" : "min(620px, 100%)",
              maxHeight:"min(82vh, 860px)",
              overflow:"auto",
              background:T.panel,
              border:`1px solid ${T.yellow}44`,
              transition:"width 0.2s ease",
              borderRadius:14,
              boxShadow:`0 20px 60px ${T.floatShadow}`,
            }}
          >
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.borderB}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{fontFamily:T.headingFont,fontWeight:800,fontSize:18,letterSpacing:0.8,color:T.yellow}}>Route Graph Warning</div>
                <div style={{fontFamily:"monospace",fontSize:8,color:ink(0.28),marginTop:3}}>
                  {routeGraphWarning.issueCount} issue{routeGraphWarning.issueCount !== 1 ? "s" : ""} found during {routeGraphWarning.mode} build — advisory only, deploy succeeded
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRouteGraphWarning(null)}
                style={{
                  padding:"7px 10px",
                  borderRadius:8,
                  border:`1px solid ${T.yellow}33`,
                  background:T.yellow+"14",
                  color:T.yellow,
                  fontFamily:"monospace",
                  fontSize:8,
                  letterSpacing:0.8,
                  textTransform:"uppercase",
                  cursor:"pointer",
                }}
              >Dismiss</button>
            </div>
            <div style={{padding:"12px 16px"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"monospace",fontSize:9}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${T.borderB}`}}>
                    <th style={{textAlign:"left",padding:"4px 8px",color:ink(0.5),fontWeight:600}}>Issue Type</th>
                    <th style={{textAlign:"right",padding:"4px 8px",color:ink(0.5),fontWeight:600}}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {routeGraphWarning.summary && Object.entries(routeGraphWarning.summary)
                    .filter(([, count]) => count > 0)
                    .map(([key, count]) => (
                      <tr key={key} style={{borderBottom:`1px solid ${T.borderB}`}}>
                        <td style={{padding:"4px 8px",color:T.textColor}}>{formatIssueTypeLabel(key)}</td>
                        <td style={{padding:"4px 8px",textAlign:"right",color:T.yellow,fontWeight:700}}>{count}</td>
                      </tr>
                    ))
                  }
                  {routeGraphWarning.summary && Object.entries(routeGraphWarning.summary)
                    .filter(([, count]) => count === 0).length > 0 && (
                    <tr style={{borderBottom:`1px solid ${T.borderB}`}}>
                      <td style={{padding:"4px 8px",color:ink(0.3)}}>
                        {Object.entries(routeGraphWarning.summary).filter(([, count]) => count === 0).map(([key]) => formatIssueTypeLabel(key)).join(", ")}
                      </td>
                      <td style={{padding:"4px 8px",textAlign:"right",color:ink(0.2)}}>0</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {routeGraphWarning.logFile && (
                <div style={{marginTop:10,padding:"8px 10px",background:ink(0.04),borderRadius:8,fontFamily:"monospace",fontSize:7.5,color:ink(0.4)}}>
                  Log: {routeGraphWarning.logFile}
                </div>
              )}
              {routeGraphWarning.logText && (
                <div style={{marginTop:10}}>
                  <button
                    type="button"
                    onClick={() => setRouteGraphLogExpanded(prev => !prev)}
                    style={{
                      width:"100%",
                      padding:"8px 10px",
                      borderRadius:8,
                      border:`1px solid ${T.borderB}`,
                      background:ink(0.04),
                      color:ink(0.5),
                      fontFamily:"monospace",
                      fontSize:8,
                      cursor:"pointer",
                      display:"flex",
                      alignItems:"center",
                      justifyContent:"space-between",
                      textAlign:"left",
                    }}
                  >
                    <span>{routeGraphLogExpanded ? "Hide" : "Show"} Full Log</span>
                    <span style={{fontSize:10,lineHeight:1}}>{routeGraphLogExpanded ? "\u25B2" : "\u25BC"}</span>
                  </button>
                  {routeGraphLogExpanded && (
                    <div style={{marginTop:6}}>
                      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(routeGraphWarning.logText)}
                          style={{
                            padding:"4px 10px",
                            borderRadius:6,
                            border:`1px solid ${T.borderB}`,
                            background:"transparent",
                            color:ink(0.45),
                            fontFamily:"monospace",
                            fontSize:7.5,
                            cursor:"pointer",
                          }}
                        >Copy Log</button>
                      </div>
                      <pre style={{
                        margin:0,
                        padding:"10px 12px",
                        background:ink(0.04),
                        border:`1px solid ${T.borderB}`,
                        borderRadius:8,
                        fontFamily:"monospace",
                        fontSize:7.5,
                        lineHeight:1.6,
                        color:ink(0.6),
                        whiteSpace:"pre-wrap",
                        wordBreak:"break-word",
                        maxHeight:320,
                        overflow:"auto",
                      }}>{routeGraphWarning.logText}</pre>
                    </div>
                  )}
                </div>
              )}
              <div style={{marginTop:10,display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button
                  type="button"
                  onClick={() => {
                    const lines = [];
                    lines.push(`Route Graph Warning — ${routeGraphWarning.issueCount} issues (${routeGraphWarning.mode})`);
                    if (routeGraphWarning.summary) {
                      for (const [key, count] of Object.entries(routeGraphWarning.summary)) {
                        if (count > 0) lines.push(`  ${formatIssueTypeLabel(key)}: ${count}`);
                      }
                    }
                    if (routeGraphWarning.logFile) lines.push(`Log: ${routeGraphWarning.logFile}`);
                    navigator.clipboard.writeText(lines.join("\n"));
                  }}
                  style={{
                    padding:"6px 12px",
                    borderRadius:7,
                    border:`1px solid ${T.borderB}`,
                    background:"transparent",
                    color:ink(0.5),
                    fontFamily:"monospace",
                    fontSize:8,
                    cursor:"pointer",
                  }}
                >Copy Summary</button>
                <button
                  type="button"
                  onClick={() => setRouteGraphWarning(null)}
                  style={{
                    padding:"6px 12px",
                    borderRadius:7,
                    border:`1px solid ${T.yellow}33`,
                    background:T.yellow+"14",
                    color:T.yellow,
                    fontFamily:"monospace",
                    fontSize:8,
                    cursor:"pointer",
                  }}
                >Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
