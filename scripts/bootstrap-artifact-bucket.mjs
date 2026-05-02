#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const IS_MAIN_MODULE = process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

function readOptions(env = process.env) {
  const projectName = env.EG_TSX_PROJECT_NAME || 'eg-tsx';
  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-2';
  const artifactBucket = env.EG_TSX_ARTIFACT_BUCKET || '';
  const artifactBucketStackName = env.EG_TSX_ARTIFACT_BUCKET_STACK_NAME || `${projectName}-artifacts`;
  const templatePath = path.join(ROOT_DIR, 'infrastructure', 'aws', 'artifact-bucket-bootstrap.yaml');

  if (!artifactBucket) {
    throw new Error('EG_TSX_ARTIFACT_BUCKET is required.');
  }

  return {
    artifactBucket,
    artifactBucketStackName,
    region,
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

export function buildArtifactBucketDeployArgs({
  artifactBucket,
  artifactBucketStackName,
  region,
  templatePath,
}) {
  return [
    'cloudformation',
    'deploy',
    '--template-file',
    templatePath,
    '--stack-name',
    artifactBucketStackName,
    '--region',
    region,
    '--no-fail-on-empty-changeset',
    '--parameter-overrides',
    `ArtifactBucketName=${artifactBucket}`,
  ];
}

function main() {
  const options = readOptions();
  const args = buildArtifactBucketDeployArgs(options);
  runCommand('aws', args);
}

if (IS_MAIN_MODULE) {
  main();
}
