import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAstroBuildInvocation,
  buildSeoSitemapValidationInvocation,
  runAstroBuild,
} from '../run-astro-build.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

describe('buildAstroBuildInvocation', () => {
  it('uses cmd.exe to launch the Windows npx shim on Windows hosts', () => {
    assert.deepEqual(
      buildAstroBuildInvocation({ platform: 'win32' }),
      {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx.cmd astro build'],
      }
    );
  });

  it('uses the standard npx binary on non-Windows hosts', () => {
    assert.deepEqual(
      buildAstroBuildInvocation({ platform: 'linux' }),
      {
        command: 'npx',
        args: ['astro', 'build'],
      }
    );
  });
});

describe('buildSeoSitemapValidationInvocation', () => {
  it('uses the current Node executable with the tsx loader for sitemap validation', () => {
    assert.deepEqual(
      buildSeoSitemapValidationInvocation({
        nodeExecutable: 'node-bin',
        validatorScriptPath: '/repo/scripts/validate-seo-sitemap.mjs',
      }),
      {
        command: 'node-bin',
        args: ['--import', 'tsx', '/repo/scripts/validate-seo-sitemap.mjs'],
      }
    );
  });
});

describe('runAstroBuild', () => {
  it('removes stale dist artifacts before invoking Astro build', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-run-astro-build-'));
    const distDir = path.join(tempRoot, 'dist');
    const staleManifestPath = path.join(distDir, 'server', 'manifest_old.mjs');

    fs.mkdirSync(path.dirname(staleManifestPath), { recursive: true });
    fs.writeFileSync(staleManifestPath, 'stale', 'utf8');

    const receivedCalls = [];

    runAstroBuild({
      cwd: tempRoot,
      distDir,
      env: { PATH: process.env.PATH || '' },
      platform: 'win32',
      nodeExecutable: 'node-bin',
      validatorScriptPath: '/repo/scripts/validate-seo-sitemap.mjs',
      spawnSyncImpl(command, args) {
        receivedCalls.push({ command, args });
        assert.equal(fs.existsSync(staleManifestPath), false);
        return { error: undefined, signal: null, status: 0 };
      },
    });

    assert.deepEqual(receivedCalls, [
      {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx.cmd astro build'],
      },
      {
        command: 'node-bin',
        args: ['--import', 'tsx', '/repo/scripts/validate-seo-sitemap.mjs'],
      },
    ]);
    assert.equal(fs.existsSync(distDir), false);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('throws a readable error when Astro build exits non-zero', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-run-astro-build-'));

    assert.throws(
      () =>
        runAstroBuild({
          cwd: tempRoot,
          distDir: path.join(tempRoot, 'dist'),
          env: { PATH: process.env.PATH || '' },
          spawnSyncImpl() {
            return { error: undefined, signal: null, status: 1 };
          },
        }),
      /exit code 1/i
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('throws a readable error when sitemap validation exits non-zero', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-run-astro-build-'));
    let callCount = 0;

    assert.throws(
      () =>
        runAstroBuild({
          cwd: tempRoot,
          distDir: path.join(tempRoot, 'dist'),
          env: { PATH: process.env.PATH || '' },
          nodeExecutable: 'node-bin',
          validatorScriptPath: '/repo/scripts/validate-seo-sitemap.mjs',
          spawnSyncImpl() {
            callCount += 1;
            if (callCount === 1) {
              return { error: undefined, signal: null, status: 0 };
            }
            return { error: undefined, signal: null, status: 1 };
          },
        }),
      /seo sitemap validation failed with exit code 1/i
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('package.json build script', () => {
  it('routes npm run build through the clean Astro wrapper', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );

    assert.equal(packageJson.scripts.build, 'node scripts/run-astro-build.mjs');
  });
});
