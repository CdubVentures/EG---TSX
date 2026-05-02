import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EG_SERVER_PORTS,
  EG_SERVER_START_TIMEOUT_MS,
  getEgServerContract,
  planEgServerAction,
} from '../scripts/dev-server-control.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

describe('EG dev server control contract', () => {
  it('keeps dedicated ports for dev and preview', () => {
    assert.deepEqual(EG_SERVER_PORTS, {
      dev: 4321,
      preview: 4322,
    });
  });

  it('allows enough startup time before treating Astro boot as failed', () => {
    assert.equal(EG_SERVER_START_TIMEOUT_MS, 180_000);
  });

  it('assigns stable pid files and browser URLs per server role', () => {
    const contract = getEgServerContract(root);

    assert.equal(contract.dev.pidFile, path.join(root, '.server-state', 'eg-astro-dev.pid'));
    assert.equal(contract.preview.pidFile, path.join(root, '.server-state', 'eg-astro-preview.pid'));
    assert.equal(contract.dev.browserUrl, 'http://127.0.0.1:4321');
    assert.equal(contract.preview.browserUrl, 'http://127.0.0.1:4322');
  });

  it('starts dev when nothing is running', () => {
    const plan = planEgServerAction({
      action: 'start-dev',
      root,
      trackedPidRunning: false,
      portOccupied: false,
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.target, 'dev');
    assert.equal(plan.shouldStart, true);
    assert.equal(plan.shouldOpenBrowser, true);
    assert.equal(plan.shouldStopTracked, false);
    assert.equal(plan.shouldClearViteCache, false);
    assert.match(plan.command, /astro dev --port 4321 --host 127\.0\.0\.1/);
  });

  it('reuses a tracked dev server instead of spawning another one', () => {
    const plan = planEgServerAction({
      action: 'start-dev',
      root,
      trackedPidRunning: true,
      portOccupied: true,
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.shouldStart, false);
    assert.equal(plan.shouldOpenBrowser, true);
    assert.equal(plan.shouldReuseRunningServer, true);
  });

  it('blocks an untracked process from hijacking the dev port', () => {
    const plan = planEgServerAction({
      action: 'start-dev',
      root,
      trackedPidRunning: false,
      portOccupied: true,
    });

    assert.equal(plan.ok, false);
    assert.match(plan.error ?? '', /port 4321 is already in use/i);
  });

  it('restart-dev stops the tracked server, clears vite cache, and restarts on the same port', () => {
    const plan = planEgServerAction({
      action: 'restart-dev',
      root,
      trackedPidRunning: true,
      portOccupied: true,
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.shouldStopTracked, true);
    assert.equal(plan.shouldClearViteCache, true);
    assert.equal(plan.shouldStart, true);
    assert.equal(plan.port, 4321);
  });

  it('starts preview on a dedicated preview port so dev and preview do not collide', () => {
    const plan = planEgServerAction({
      action: 'start-preview',
      root,
      trackedPidRunning: false,
      portOccupied: false,
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.target, 'preview');
    assert.equal(plan.port, 4322);
    assert.match(plan.command, /astro preview --port 4322 --host 127\.0\.0\.1/);
  });

  it('restart-preview replaces the tracked preview instead of stacking another preview server', () => {
    const plan = planEgServerAction({
      action: 'restart-preview',
      root,
      trackedPidRunning: true,
      portOccupied: true,
    });

    assert.equal(plan.ok, true);
    assert.equal(plan.target, 'preview');
    assert.equal(plan.shouldStopTracked, true);
    assert.equal(plan.shouldStart, true);
    assert.equal(plan.port, 4322);
  });
});
