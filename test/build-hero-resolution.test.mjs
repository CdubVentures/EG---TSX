import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'debug', 'test-build-hero-resolution');
const CLIENT_INDEX = path.join(OUT_DIR, 'client', 'index.html');
const ASTRO_CLI = path.join(ROOT, 'node_modules', 'astro', 'astro.js');

function buildSite() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  execFileSync(process.execPath, [ASTRO_CLI, 'build', '--outDir', 'debug/test-build-hero-resolution'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

describe('homepage hero build contract', () => {
  it('emits the resolved AW610M hero derivative instead of a missing direct stem', () => {
    buildSite();

    assert.equal(existsSync(CLIENT_INDEX), true);

    const html = readFileSync(CLIENT_INDEX, 'utf8');
    assert.equal(
      html.includes('/images/reviews/mouse/alienware-aw610m-review/feature-image_s.webp'),
      false,
    );
    assert.equal(
      html.includes('/images/reviews/mouse/alienware-aw610m-review/feature-image---white+black_s.webp'),
      true,
    );
  });
});
