import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSampleOverlayPresentation } from '../sample-ad-presentation.mjs';

test('buildSampleOverlayPresentation returns null for svg creatives', () => {
  const presentation = buildSampleOverlayPresentation({
    kind: 'svg',
    brand: 'Fresh Pantry',
    headline: 'Weekly grocery restocks without the store run',
    cta: 'Build basket',
    offer: 'Free delivery on the first order',
    campaign: 'Cart builder',
    disclaimer: 'Minimum order totals may apply.',
    networkLabel: 'Google AdSense',
  });

  assert.equal(presentation, null);
});

test('buildSampleOverlayPresentation creates a beauty video presentation', () => {
  const presentation = buildSampleOverlayPresentation({
    kind: 'video',
    brand: 'Glow Ritual',
    headline: 'A quick creator demo for the new glow serum',
    cta: 'Watch now',
    offer: 'Limited launch pricing live today',
    campaign: 'Creator partnership',
    disclaimer: 'Pricing may change after the launch window.',
    networkLabel: 'Mediavine',
  });

  assert.equal(presentation.variant, 'beauty');
  assert.equal(presentation.kicker, 'Creator Routine');
  assert.equal(presentation.badge, 'Launch Drop');
  assert.equal(presentation.sponsorLabel, 'Sponsored · Mediavine');
});

test('buildSampleOverlayPresentation creates an auto video presentation', () => {
  const presentation = buildSampleOverlayPresentation({
    kind: 'video',
    brand: 'Apex Drive',
    headline: 'Meet the GT line in motion before local release',
    cta: 'Watch the spot',
    offer: 'Reserve a private test drive this week',
    campaign: 'Launch film',
    disclaimer: 'Availability varies by market and dealer inventory.',
    networkLabel: 'Raptive',
  });

  assert.equal(presentation.variant, 'auto');
  assert.equal(presentation.kicker, 'New Model Launch');
  assert.equal(presentation.badge, 'Reserve Test Drive');
});

test('buildSampleOverlayPresentation creates a software video presentation', () => {
  const presentation = buildSampleOverlayPresentation({
    kind: 'video',
    brand: 'SignalOS',
    headline: 'Plan, publish, and ship from one clean workspace',
    cta: 'Start free',
    offer: 'Team setup templates included for new accounts',
    campaign: 'Workspace rollout',
    disclaimer: 'Template access varies by plan tier.',
    networkLabel: 'Google AdSense',
  });

  assert.equal(presentation.variant, 'software');
  assert.equal(presentation.kicker, 'Workflow Platform');
  assert.equal(presentation.badge, 'Start Free');
});
