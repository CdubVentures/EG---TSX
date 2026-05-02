#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildCloudFormationDeployArgs } from './aws-operator.mjs';
import {
  buildBootstrapArtifactKey,
  buildBootstrapHandlerSource,
  buildBootstrapParameterOverrides,
} from './bootstrap-deploy.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const IS_MAIN_MODULE = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

function readOptions(env = process.env) {
  const projectName = env.EG_TSX_PROJECT_NAME || 'eg-tsx';
  const environment = env.EG_TSX_ENVIRONMENT || 'prod';
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-2';
  const stackName = env.EG_TSX_STACK_NAME || `${projectName}-${environment}`;
  const artifactBucket = env.EG_TSX_ARTIFACT_BUCKET || '';
  const databasePassword = env.EG_TSX_DATABASE_PASSWORD || '';
  const templatePath = path.join(ROOT_DIR, 'infrastructure', 'aws', 'eg-tsx-stack.yaml');

  if (!artifactBucket) {
    throw new Error('EG_TSX_ARTIFACT_BUCKET is required.');
  }

  if (!databasePassword) {
    throw new Error('EG_TSX_DATABASE_PASSWORD is required.');
  }

  if (!['dev', 'prod'].includes(environment)) {
    throw new Error(`EG_TSX_ENVIRONMENT must be dev or prod. Received: ${environment}`);
  }

  return {
    artifactBucket,
    databasePassword,
    environment,
    projectName,
    region,
    stackName,
    templatePath,
  };
}

function runCommand(command, args, options = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT_DIR,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}.`);
  }
}

function createBootstrapZip({ handlerSource, zipPath }) {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-tsx-bootstrap-'));
  const entryPath = path.join(stagingDir, 'entry.mjs');
  fs.writeFileSync(entryPath, handlerSource);

  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  runCommand(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      'Compress-Archive -Path $env:EG_TSX_BOOTSTRAP_SOURCE -DestinationPath $env:EG_TSX_BOOTSTRAP_ZIP -Force',
    ],
    {
      env: {
        ...process.env,
        EG_TSX_BOOTSTRAP_SOURCE: entryPath,
        EG_TSX_BOOTSTRAP_ZIP: zipPath,
      },
    }
  );

  return stagingDir;
}

function cleanupDirectory(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

export function buildBootstrapStackDeployArgs(options) {
  const parameterOverrides = buildBootstrapParameterOverrides(options);
  const args = buildCloudFormationDeployArgs({
    executionRoleArn: '',
    parameterOverrides,
    region: options.region,
    stackName: options.stackName,
    templatePath: options.templatePath,
  });

  const capabilitiesIndex = args.indexOf('--capabilities');
  args.splice(capabilitiesIndex === -1 ? args.length : capabilitiesIndex, 0, '--no-fail-on-empty-changeset');
  return args;
}

function main() {
  const options = readOptions();
  const buildDir = path.join(ROOT_DIR, 'infrastructure', 'aws', 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  const artifactKey = buildBootstrapArtifactKey(options);
  const zipPath = path.join(buildDir, `${options.projectName}-${options.environment}-bootstrap.zip`);
  const stagingDir = createBootstrapZip({
    handlerSource: buildBootstrapHandlerSource(),
    zipPath,
  });

  try {
    runCommand('aws', [
      's3',
      'cp',
      zipPath,
      `s3://${options.artifactBucket}/${artifactKey}`,
      '--region',
      options.region,
    ]);

    runCommand('aws', buildBootstrapStackDeployArgs(options));
  } finally {
    cleanupDirectory(stagingDir);
  }
}

if (IS_MAIN_MODULE) {
  main();
}
