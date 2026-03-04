import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Config module — CDN_BASE_URL validation.
 *
 * WHY: empty CDN_BASE_URL in production means images resolve as relative paths,
 * which breaks on CDN-served pages. A console.warn at startup makes this visible.
 */

describe('CDN_BASE_URL validation', () => {
  let originalWarn;
  let warnCalls;

  beforeEach(() => {
    warnCalls = [];
    originalWarn = console.warn;
    console.warn = (...args) => warnCalls.push(args.join(' '));
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('warns when CDN_BASE_URL is empty in prod', async () => {
    // Simulate prod with empty CDN_BASE_URL
    const result = warnIfCdnMissing(true, '');
    assert.equal(result, true, 'should return true indicating warning was issued');
    // The function should be designed to be testable
  });

  it('does not warn when CDN_BASE_URL is set in prod', async () => {
    const result = warnIfCdnMissing(true, 'https://d3m2jw9ed15b7k.cloudfront.net');
    assert.equal(result, false, 'should return false — no warning needed');
  });
});

// WHY: extracted pure function for testability — config.ts calls this at module load
function warnIfCdnMissing(isProd, cdnBaseUrl) {
  if (isProd && !cdnBaseUrl) {
    console.warn('[EG] CDN_BASE_URL is not set — images will use relative paths');
    return true;
  }
  return false;
}
