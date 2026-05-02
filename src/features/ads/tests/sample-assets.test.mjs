import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

test('readSampleSvg returns raw SVG markup in dev runtime', async () => {
  const { readSampleSvg } = await import('../sample-assets.ts');
  const svg = readSampleSvg('300x250-0.svg', {
    rootDir: ROOT,
    devRuntime: true,
  });

  assert.equal(typeof svg, 'string');
  assert.match(svg, /<svg[\s>]/i);
});

test('readSampleSvg stays disabled outside dev runtime', async () => {
  const { readSampleSvg } = await import('../sample-assets.ts');
  const svg = readSampleSvg('300x250-0.svg', {
    rootDir: ROOT,
    devRuntime: false,
  });

  assert.equal(svg, undefined);
});

test('resolveSampleVideoSource returns a Vite @fs URL in dev runtime', async () => {
  const { resolveSampleVideoSource } = await import('../sample-assets.ts');
  const source = resolveSampleVideoSource('sample-ad-video-beauty-influencer.mp4', {
    rootDir: ROOT,
    devRuntime: true,
  });

  assert.equal(typeof source, 'string');
  assert.equal(source.startsWith('/@fs/'), true);
  assert.equal(source.includes('sample-ad-video-beauty-influencer.mp4'), true);
});

test('resolveSampleVideoSource stays disabled outside dev runtime', async () => {
  const { resolveSampleVideoSource } = await import('../sample-assets.ts');
  const source = resolveSampleVideoSource('sample-ad-video-beauty-influencer.mp4', {
    rootDir: ROOT,
    devRuntime: false,
  });

  assert.equal(source, undefined);
});

test('sample creative API is importable under the tsx-backed node test runner', async () => {
  const mod = await import('../sample-images.ts');

  assert.equal(typeof mod.getSampleAdCreative, 'function');
  assert.equal(typeof mod.getSampleAdCreativeSequence, 'function');
});

test('sample creative API can resolve both SVG and video creatives for a known size', async () => {
  const mod = await import('../sample-images.ts');
  const originalRandom = Math.random;
  Math.random = () => 0;

  try {
    const svgCreative = mod.getSampleAdCreative(300, 250, 'svg', 'adsense');
    const videoCreative = mod.getSampleAdCreative(300, 250, 'video', 'adsense');

    assert.equal(svgCreative?.kind, 'svg');
    assert.equal(typeof svgCreative?.source, 'string');
    assert.match(svgCreative?.source ?? '', /<svg[\s>]/i);

    assert.equal(videoCreative?.kind, 'video');
    assert.equal(typeof videoCreative?.source, 'string');
    assert.equal(videoCreative?.source.startsWith('/@fs/'), true);
    assert.equal(videoCreative?.source.includes('sample-ad-video-'), true);
  } finally {
    Math.random = originalRandom;
  }
});
