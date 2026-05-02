export interface SampleOverlayPresentation {
  variant: string;
  sponsorLabel: string;
  kicker: string;
  badge: string;
  brand: string;
  headline: string;
  offer: string;
  cta: string;
  disclaimer: string;
  duration?: string;
}

export interface SampleOverlayCreative {
  kind?: string;
  brand?: string;
  headline?: string;
  cta?: string;
  offer?: string;
  campaign?: string;
  disclaimer?: string;
  duration?: string;
  networkLabel?: string;
}

export { buildSampleOverlayPresentation } from './sample-ad-presentation.mjs';
