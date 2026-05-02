#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

export function buildAstroBuildInvocation({ platform = process.platform } = {}) {
  if (platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'npx.cmd astro build'],
    };
  }

  return {
    command: 'npx',
    args: ['astro', 'build'],
  };
}

export function buildSeoSitemapValidationInvocation({
  nodeExecutable = process.execPath,
  validatorScriptPath = path.join(ROOT_DIR, 'scripts', 'validate-seo-sitemap.mjs'),
} = {}) {
  return {
    command: nodeExecutable,
    args: ['--import', 'tsx', validatorScriptPath],
  };
}

export function removeBuildOutput({ distDir = path.join(ROOT_DIR, 'dist') } = {}) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

export function runAstroBuild({
  cwd = ROOT_DIR,
  distDir = path.join(cwd, 'dist'),
  env = process.env,
  platform = process.platform,
  nodeExecutable = process.execPath,
  validatorScriptPath = path.join(ROOT_DIR, 'scripts', 'validate-seo-sitemap.mjs'),
  spawnSyncImpl = spawnSync,
} = {}) {
  removeBuildOutput({ distDir });

  const invocation = buildAstroBuildInvocation({ platform });
  const result = spawnSyncImpl(invocation.command, invocation.args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    throw new Error(`astro build terminated by signal ${result.signal}`);
  }

  if (result.status !== 0) {
    const error = new Error(`astro build failed with exit code ${result.status}`);
    error.exitCode = result.status;
    throw error;
  }

  const validationInvocation = buildSeoSitemapValidationInvocation({
    nodeExecutable,
    validatorScriptPath,
  });
  const validationResult = spawnSyncImpl(validationInvocation.command, validationInvocation.args, {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (validationResult.error) {
    throw validationResult.error;
  }

  if (validationResult.signal) {
    throw new Error(`seo sitemap validation terminated by signal ${validationResult.signal}`);
  }

  if (validationResult.status !== 0) {
    const error = new Error(`seo sitemap validation failed with exit code ${validationResult.status}`);
    error.exitCode = validationResult.status;
    throw error;
  }

  return result;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    runAstroBuild();
  } catch (error) {
    console.error(error.message);
    process.exit(error.exitCode || 1);
  }
}
