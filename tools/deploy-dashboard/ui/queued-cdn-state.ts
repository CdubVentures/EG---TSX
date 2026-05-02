export interface QueuedCdnEntry {
  id: string;
  label: string;
  mode: "" | "FULL" | "SMART";
  paths: string[];
  reason: string;
  sourceProfile: string;
  status: "QUEUED" | "RUNNING";
  queuedAt: string;
  startedAt: string;
}

export interface QueuedCdnState {
  activeAction: string;
  entries: QueuedCdnEntry[];
  logLines: string[];
  mode: "" | "FULL" | "SMART";
  paths: string[];
  status: "CLEAR" | "QUEUED" | "RUNNING";
}

interface AppendQueuedCdnPlanOptions {
  label: string;
  plan: {
    mode: "" | "FULL" | "SMART";
    paths: string[];
    reason?: string;
    sourceProfile?: string;
  };
}

export function createEmptyQueuedCdnState(): QueuedCdnState {
  return {
    activeAction: "",
    entries: [],
    logLines: [],
    mode: "",
    paths: [],
    status: "CLEAR",
  };
}

function dedupePaths(paths: string[]): string[] {
  return [...new Set((paths || []).map((value) => `${value}`.trim()).filter(Boolean))];
}

function normalizeMode(mode: string | undefined): QueuedCdnEntry["mode"] {
  const normalizedMode = `${mode || ""}`.trim().toUpperCase();
  if (normalizedMode === "FULL") {
    return "FULL";
  }
  if (normalizedMode === "SMART") {
    return "SMART";
  }
  return "";
}

function normalizeStatus(status: string | undefined): QueuedCdnEntry["status"] {
  return `${status || ""}`.trim().toUpperCase() === "RUNNING" ? "RUNNING" : "QUEUED";
}

function buildQueueLogLine(entry: QueuedCdnEntry): string {
  return `[queue] ${entry.label} ${entry.status === "RUNNING" ? "running" : "queued"} ${entry.paths.length} CDN path(s)`;
}

function buildQueuedCdnState(entries: QueuedCdnEntry[], activeAction = ""): QueuedCdnState {
  const normalizedEntries = entries.filter((entry) => entry.paths.length > 0);
  const paths = dedupePaths(normalizedEntries.flatMap((entry) => entry.paths));
  return {
    activeAction,
    entries: normalizedEntries,
    logLines: normalizedEntries.map(buildQueueLogLine),
    mode: normalizedEntries.some((entry) => entry.mode === "FULL")
      ? "FULL"
      : normalizedEntries.find((entry) => entry.mode)?.mode || "",
    paths,
    status: normalizedEntries.length === 0
      ? "CLEAR"
      : normalizedEntries.some((entry) => entry.status === "RUNNING")
        ? "RUNNING"
        : "QUEUED",
  };
}

function createQueuedCdnEntry(label: string, plan: AppendQueuedCdnPlanOptions["plan"]): QueuedCdnEntry {
  const queuedAt = new Date().toISOString();
  return {
    id: `local:${queuedAt}:${label}:${Math.random().toString(16).slice(2)}`,
    label,
    mode: normalizeMode(plan.mode),
    paths: dedupePaths(plan.paths),
    reason: `${plan.reason || ""}`,
    sourceProfile: `${plan.sourceProfile || ""}`,
    status: "QUEUED",
    queuedAt,
    startedAt: "",
  };
}

export function appendQueuedCdnPlan(
  state: QueuedCdnState,
  { label, plan }: AppendQueuedCdnPlanOptions,
): QueuedCdnState {
  if (!plan.paths || plan.paths.length === 0) {
    return state;
  }

  return buildQueuedCdnState([
    ...state.entries,
    createQueuedCdnEntry(label, plan),
  ], state.activeAction);
}

export function hydrateQueuedCdnState(rawState: Partial<QueuedCdnState> | null | undefined): QueuedCdnState {
  const rawEntries = Array.isArray(rawState?.entries) ? rawState.entries : [];
  const entries = rawEntries.map((entry) => ({
    id: `${entry?.id || ""}` || `queue:${Math.random().toString(16).slice(2)}`,
    label: `${entry?.label || ""}`,
    mode: normalizeMode(entry?.mode),
    paths: dedupePaths(entry?.paths || []),
    reason: `${entry?.reason || ""}`,
    sourceProfile: `${entry?.sourceProfile || ""}`,
    status: normalizeStatus(entry?.status),
    queuedAt: `${entry?.queuedAt || ""}`,
    startedAt: `${entry?.startedAt || ""}`,
  }));

  return buildQueuedCdnState(entries, `${rawState?.activeAction || ""}`);
}

export function markQueuedCdnStateRunning(state: QueuedCdnState, actionLabel: string): QueuedCdnState {
  return buildQueuedCdnState(
    state.entries.map((entry) => ({
      ...entry,
      status: "RUNNING",
      startedAt: entry.startedAt || new Date().toISOString(),
    })),
    actionLabel,
  );
}
