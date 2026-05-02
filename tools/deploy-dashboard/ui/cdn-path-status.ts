export type CdnPathStateLabel = "planned" | "in-flight" | "cleared" | "unverified";

export interface CdnPathResolutionState {
  activeGroupPaths: string[];
  clearedPaths: string[];
  invalidationPathsById: Record<string, string[]>;
  unverifiedPaths: string[];
}

export function createEmptyCdnPathResolutionState(): CdnPathResolutionState {
  return {
    activeGroupPaths: [],
    clearedPaths: [],
    invalidationPathsById: {},
    unverifiedPaths: [],
  };
}

function dedupePaths(paths: string[]): string[] {
  return [...new Set((paths || []).map((value) => `${value}`.trim()).filter(Boolean))];
}

export function rememberCdnGroupPaths(
  state: CdnPathResolutionState,
  paths: string[],
): CdnPathResolutionState {
  return {
    ...state,
    activeGroupPaths: dedupePaths(paths),
  };
}

export function bindInvalidationToActiveGroup(
  state: CdnPathResolutionState,
  invalidationId: string,
): CdnPathResolutionState {
  const normalizedId = `${invalidationId}`.trim();
  if (!normalizedId || state.activeGroupPaths.length === 0) {
    return state;
  }

  return {
    ...state,
    invalidationPathsById: {
      ...state.invalidationPathsById,
      [normalizedId]: state.activeGroupPaths,
    },
  };
}

function appendUniquePaths(existing: string[], next: string[]): string[] {
  return dedupePaths([...existing, ...next]);
}

export function resolveInvalidationPaths(
  state: CdnPathResolutionState,
  invalidationId: string,
  status: string,
): CdnPathResolutionState {
  const normalizedId = `${invalidationId}`.trim();
  const normalizedStatus = `${status}`.trim().toUpperCase();
  const mappedPaths = dedupePaths(state.invalidationPathsById[normalizedId] || []);
  if (!normalizedId || mappedPaths.length === 0) {
    return state;
  }

  const remainingActivePaths = state.activeGroupPaths.filter((pathValue) => !mappedPaths.includes(pathValue));

  if (normalizedStatus === "COMPLETED") {
    return {
      ...state,
      activeGroupPaths: remainingActivePaths,
      clearedPaths: appendUniquePaths(state.clearedPaths, mappedPaths),
    };
  }

  if (normalizedStatus === "UNVERIFIED") {
    return {
      ...state,
      activeGroupPaths: remainingActivePaths,
      unverifiedPaths: appendUniquePaths(state.unverifiedPaths, mappedPaths),
    };
  }

  return state;
}

export function getCdnPathStateLabel(
  state: CdnPathResolutionState,
  pathValue: string,
): CdnPathStateLabel {
  if (state.unverifiedPaths.includes(pathValue)) {
    return "unverified";
  }
  if (state.clearedPaths.includes(pathValue)) {
    return "cleared";
  }
  if (state.activeGroupPaths.includes(pathValue)) {
    return "in-flight";
  }
  return "planned";
}
