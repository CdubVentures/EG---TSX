export type SiteStageKey = "build" | "sync" | "cdn";

export interface SiteStageProgressState {
  build: number;
  sync: number;
  cdn: number;
}

export interface SiteStageProgressEvent {
  progress: number;
  stage: SiteStageKey;
}

export function createEmptySiteStageProgress(): SiteStageProgressState {
  return {
    build: 0,
    sync: 0,
    cdn: 0,
  };
}

function normalizeProgress(progress: number): number {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function applySiteStageProgressEvent(
  current: SiteStageProgressState,
  event: SiteStageProgressEvent,
): SiteStageProgressState {
  const nextProgress = normalizeProgress(event.progress);
  const currentProgress = current[event.stage];

  if (nextProgress <= currentProgress) {
    return current;
  }

  return {
    ...current,
    [event.stage]: nextProgress,
  };
}
