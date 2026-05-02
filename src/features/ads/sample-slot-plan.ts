export interface SampleSlotPlanCreative {
  source: string;
  brand?: string;
  campaign?: string;
  kind?: string;
}

export interface SampleSlotPlan {
  startIndex: number;
  creatives: SampleSlotPlanCreative[];
  initialCreative?: SampleSlotPlanCreative;
}

export interface CreateSampleSlotPlanOptions {
  slotKey: string;
  creatives: SampleSlotPlanCreative[];
}

export interface SampleRefreshWindow {
  minMs: number;
  maxMs: number;
}

export interface SampleRefreshPlan extends SampleRefreshWindow {
  maxRefreshes: number;
}

export interface SampleRefreshWindowOptions {
  placementType?: string;
  sticky?: boolean;
}

export {
  createSampleSlotPlan,
  getSampleRefreshPlan,
  getSampleRefreshWindow,
} from './sample-slot-plan.mjs';
