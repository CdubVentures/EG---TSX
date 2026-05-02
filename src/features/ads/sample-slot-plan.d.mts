export interface SampleSlotPlanCreative {
  source: string;
  brand?: string;
  campaign?: string;
  kind?: string;
}

export interface SampleSlotPlan<T extends SampleSlotPlanCreative = SampleSlotPlanCreative> {
  startIndex: number;
  creatives: T[];
  initialCreative?: T;
}

export interface CreateSampleSlotPlanOptions<T extends SampleSlotPlanCreative = SampleSlotPlanCreative> {
  slotKey: string;
  creatives: T[];
}

export interface SampleRefreshPlan {
  minMs: number;
  maxMs: number;
  maxRefreshes: number;
}

export interface SampleRefreshWindow {
  minMs: number;
  maxMs: number;
}

export interface SampleRefreshWindowOptions {
  placementType?: string;
  sticky?: boolean;
}

export function createSampleSlotPlan<T extends SampleSlotPlanCreative>(
  options: CreateSampleSlotPlanOptions<T>,
): SampleSlotPlan<T>;

export function getSampleRefreshPlan(
  options: SampleRefreshWindowOptions,
): SampleRefreshPlan;

export function getSampleRefreshWindow(
  options: SampleRefreshWindowOptions,
): SampleRefreshWindow;
