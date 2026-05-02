import {
  buildCdnInvalidationPlan,
  buildImageCdnInvalidationPlan,
} from "../../../scripts/invalidation-core.mjs";

export interface PendingPublishFile {
  category?: string;
  file_type?: string;
  path?: string;
}

export interface InstantPublishCdnPlan {
  mode: "" | "FULL" | "SMART";
  paths: string[];
  reason: string;
  sourceProfile: string;
}

interface BuildInstantPublishCdnPlanOptions {
  pendingFiles?: PendingPublishFile[];
  profile?: string;
}

const EMPTY_INSTANT_PUBLISH_CDN_PLAN: InstantPublishCdnPlan = {
  mode: "",
  paths: [],
  reason: "",
  sourceProfile: "",
};

function normalizeFilePath(pathValue: string | undefined): string {
  return `${pathValue || ""}`.trim().replace(/\\/g, "/");
}

function normalizeFileStatus(fileType: string | undefined): string {
  const normalizedType = `${fileType || ""}`.trim().toLowerCase();
  if (normalizedType === "new") {
    return "new";
  }
  if (normalizedType === "deleted") {
    return "deleted";
  }
  return "modified";
}

function normalizePlanMode(mode: string | undefined): InstantPublishCdnPlan["mode"] {
  if (`${mode || ""}`.trim().toLowerCase() === "smart") {
    return "SMART";
  }
  if (`${mode || ""}`.trim().toLowerCase() === "full") {
    return "FULL";
  }
  return "";
}

export function buildInstantPublishCdnPlan({
  pendingFiles = [],
  profile = "",
}: BuildInstantPublishCdnPlanOptions = {}): InstantPublishCdnPlan {
  if (profile === "s3-data-publish" || profile === "s3-data-rebuild") {
    const changedSourcePaths = pendingFiles
      .map((file) => normalizeFilePath(file.path))
      .filter((pathValue) => Boolean(pathValue) && !pathValue.startsWith("public/images/"));
    const plan = buildCdnInvalidationPlan({ changedSourcePaths });

    return {
      mode: normalizePlanMode(plan.mode),
      paths: plan.paths || [],
      reason: plan.reason || "",
      sourceProfile: profile,
    };
  }

  if (profile === "s3-image-publish" || profile === "s3-image-rebuild") {
    const s3DiffRows = pendingFiles
      .map((file) => ({
        path: normalizeFilePath(file.path).replace(/^public\//, ""),
        status: normalizeFileStatus(file.file_type),
      }))
      .filter((row) => row.path.startsWith("images/"));
    const plan = buildImageCdnInvalidationPlan({ s3DiffRows });

    return {
      mode: normalizePlanMode(plan.mode),
      paths: plan.paths || [],
      reason: plan.reason || "",
      sourceProfile: profile,
    };
  }

  return {
    ...EMPTY_INSTANT_PUBLISH_CDN_PLAN,
    sourceProfile: profile,
  };
}
