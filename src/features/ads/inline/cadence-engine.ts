import { calculateInjectionPoints as calculateInjectionPointsPure } from './cadence-engine.mjs';

export interface CadenceInput {
  anchorCount: number;
  wordCount: number;
  firstAfter: number;
  every: number;
  max: number;
  wordsPerAd: number;
  minFirstAdWords: number;
  manualAdIndices: number[];
}

export const calculateInjectionPoints: (input: CadenceInput) => number[] = calculateInjectionPointsPure;
