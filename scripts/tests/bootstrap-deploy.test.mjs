import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';

import {
  buildBootstrapArtifactKey,
  buildBootstrapHandlerSource,
  buildBootstrapParameterOverrides,
  buildRunBatchDefinitions,
  renderRunBatchContent,
} from '../bootstrap-deploy.mjs';
import { buildArtifactBucketDeployArgs } from '../bootstrap-artifact-bucket.mjs';
import { buildBootstrapStackDeployArgs } from '../bootstrap-main-stack.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const infrastructureRoot = path.join(repoRoot, 'infrastructure', 'aws');

function readInfrastructureFile(fileName) {
  return readFileSync(path.join(infrastructureRoot, fileName), 'utf8');
}

describe('buildBootstrapArtifactKey', () => {
  it('places the bootstrap Lambda artifact under the bootstrap prefix', () => {
    assert.equal(
      buildBootstrapArtifactKey({
        projectName: 'eg-tsx',
        environment: 'prod',
      }),
      'bootstrap/eg-tsx-prod-bootstrap.zip'
    );
  });
});

describe('buildBootstrapParameterOverrides', () => {
  it('creates the main stack parameters for the bootstrap stack deploy', () => {
    assert.deepEqual(
      buildBootstrapParameterOverrides({
        projectName: 'eg-tsx',
        environment: 'prod',
        databasePassword: 'secret',
        artifactBucket: 'eg-tsx-artifacts-chris-2026',
      }),
      [
        'ProjectName=eg-tsx',
        'Environment=prod',
        'DatabasePassword=secret',
        'LambdaCodeS3Bucket=eg-tsx-artifacts-chris-2026',
        'LambdaCodeS3Key=bootstrap/eg-tsx-prod-bootstrap.zip',
      ]
    );
  });
});

describe('buildBootstrapHandlerSource', () => {
  it('returns the maintenance handler used for the first stack creation', () => {
    const source = buildBootstrapHandlerSource();

    assert.match(source, /export async function handler/);
    assert.match(source, /statusCode: 503/);
    assert.match(source, /Bootstrap artifact/);
  });
});

describe('buildRunBatchDefinitions', () => {
  it('defines the expected first through fourth run launchers', () => {
    assert.deepEqual(
      buildRunBatchDefinitions(),
      [
        {
          fileName: 'first-run-artifact-bucket.bat',
          target: 'scripts/bootstrap-artifact-bucket.mjs',
        },
        {
          fileName: 'second-run-main-stack.bat',
          target: 'scripts/bootstrap-main-stack.mjs',
        },
        {
          fileName: 'third-run-first-deploy.bat',
          target: 'scripts/deploy-aws.mjs',
        },
        {
          fileName: 'fourth-run-refresh-god-view-role.bat',
          target: 'scripts/deploy-aws.mjs',
          args: ['--skip-static', '--skip-invalidate'],
        },
      ]
    );
  });
});

describe('renderRunBatchContent', () => {
  it('keeps the window open on failure so double-click errors stay visible', () => {
    const content = renderRunBatchContent({
      target: 'scripts/bootstrap-artifact-bucket.mjs',
    });

    assert.match(content, /if not "%EXIT_CODE%"=="0" \(/);
    assert.match(content, /pause/);
  });

  it('appends optional script arguments to the batch launcher command', () => {
    const content = renderRunBatchContent({
      target: 'scripts/deploy-aws.mjs',
      args: ['--skip-static', '--skip-invalidate'],
    });

    assert.match(content, /deploy-aws\.mjs" --skip-static --skip-invalidate %\*/);
  });
});

describe('buildArtifactBucketDeployArgs', () => {
  it('creates the bootstrap bucket stack deploy command', () => {
    assert.deepEqual(
      buildArtifactBucketDeployArgs({
        artifactBucket: 'eg-tsx-artifacts-chris-2026',
        artifactBucketStackName: 'eg-tsx-artifacts',
        region: 'us-east-2',
        templatePath: 'infrastructure/aws/artifact-bucket-bootstrap.yaml',
      }),
      [
        'cloudformation',
        'deploy',
        '--template-file',
        'infrastructure/aws/artifact-bucket-bootstrap.yaml',
        '--stack-name',
        'eg-tsx-artifacts',
        '--region',
        'us-east-2',
        '--no-fail-on-empty-changeset',
        '--parameter-overrides',
        'ArtifactBucketName=eg-tsx-artifacts-chris-2026',
      ]
    );
  });
});

describe('buildBootstrapStackDeployArgs', () => {
  it('creates the main stack deploy command for the bootstrap Lambda artifact', () => {
    assert.deepEqual(
      buildBootstrapStackDeployArgs({
        artifactBucket: 'eg-tsx-artifacts-chris-2026',
        databasePassword: 'secret',
        environment: 'prod',
        projectName: 'eg-tsx',
        region: 'us-east-2',
        stackName: 'eg-tsx-prod',
        templatePath: 'infrastructure/aws/eg-tsx-stack.yaml',
      }),
      [
        'cloudformation',
        'deploy',
        '--template-file',
        'infrastructure/aws/eg-tsx-stack.yaml',
        '--stack-name',
        'eg-tsx-prod',
        '--region',
        'us-east-2',
        '--no-fail-on-empty-changeset',
        '--capabilities',
        'CAPABILITY_IAM',
        'CAPABILITY_NAMED_IAM',
        '--parameter-overrides',
        'ProjectName=eg-tsx',
        'Environment=prod',
        'DatabasePassword=secret',
        'LambdaCodeS3Bucket=eg-tsx-artifacts-chris-2026',
        'LambdaCodeS3Key=bootstrap/eg-tsx-prod-bootstrap.zip',
      ]
    );
  });
});

describe('bootstrap run files', () => {
  it('provides the shared run-config template for the three-stage bootstrap', () => {
    const template = readInfrastructureFile('run-config.example.cmd');

    assert.match(template, /EG_TSX_ARTIFACT_BUCKET=/);
    assert.match(template, /EG_TSX_DATABASE_PASSWORD=/);
    assert.match(template, /EG_TSX_ARTIFACT_BUCKET_STACK_NAME=/);
  });

  it('writes the first run batch launcher', () => {
    const file = readInfrastructureFile('first-run-artifact-bucket.bat');

    assert.match(file, /run-config\.cmd/);
    assert.match(file, /bootstrap-artifact-bucket\.mjs/);
    assert.match(file, /pause/);
  });

  it('writes the second run batch launcher', () => {
    const file = readInfrastructureFile('second-run-main-stack.bat');

    assert.match(file, /run-config\.cmd/);
    assert.match(file, /bootstrap-main-stack\.mjs/);
    assert.match(file, /pause/);
  });

  it('writes the third run batch launcher', () => {
    const file = readInfrastructureFile('third-run-first-deploy.bat');

    assert.match(file, /run-config\.cmd/);
    assert.match(file, /deploy-aws\.mjs/);
    assert.match(file, /pause/);
  });

  it('writes the fourth run batch launcher for stack-owned IAM refreshes', () => {
    const file = readInfrastructureFile('fourth-run-refresh-god-view-role.bat');

    assert.match(file, /run-config\.cmd/);
    assert.match(file, /deploy-aws\.mjs/);
    assert.match(file, /--skip-static --skip-invalidate/);
    assert.match(file, /pause/);
  });

  it('documents the fourth run as the direct God View role permission refresh path', () => {
    const file = readInfrastructureFile('RUN-ORDER.txt');

    assert.match(file, /fourth-run-refresh-god-view-role\.bat/);
    assert.match(file, /God View role/i);
    assert.match(file, /cloudfront:GetInvalidation/i);
    assert.match(file, /direct IAM policy patch/i);
  });
});
