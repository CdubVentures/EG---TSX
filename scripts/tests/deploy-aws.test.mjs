import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, syncBuiltinESMExports } from 'node:module';

import {
  assertStaticDeployArtifactsClean,
  CAPTURE_OUTPUT_MAX_BUFFER_BYTES,
  buildDeployStages,
  buildArtifactKey,
  buildRequestedInvalidationPlan,
  buildSiteStageProgressEvent,
  buildLambdaPackageProgressLine,
  buildLambdaStageProgressLine,
  buildLambdaArtifactLayout,
  parseAstroBuildProgressLine,
  parseAwsCliTransferProgressLine,
  parseDryRunRows,
  resolveRunCommandStdio,
  resolveRunCommandWindowsHide,
  buildStaticCopyArgs,
  buildStaticMirrorDeleteArgs,
  countLocalFilesWithProgress,
  countListedS3Objects,
  countRemoteS3ObjectsWithProgress,
  pruneStaticDeployArtifacts,
  formatStackOutputSummary,
  splitCloudFrontInvalidationGroups,
  resolveStaticSyncOperationTotal,
  shouldReadStackOutputs,
  summarizeStackResourceProgress,
  shouldPreviewStaticDiff,
  summarizeCloudFrontInvalidationPayload,
  summarizeS3TransferOutput,
  buildStaticSyncArgs,
  buildSpawnInvocation,
  startProgressHeartbeat,
  buildCloudFormationParameterOverrides,
  collectRuntimePackagePaths,
  loadInfrastructureRunConfigEnv,
  parseDeployOptions,
  rewriteWorkspaceReferences,
  zipDirectory,
} from '../deploy-aws.mjs';
import { SITE_FULL_INVALIDATION_PATHS } from '../invalidation-core.mjs';

const require = createRequire(import.meta.url);

function createIsolatedRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-parse-options-'));
}

describe('loadInfrastructureRunConfigEnv', () => {
  it('hydrates deploy env defaults from infrastructure/aws/run-config.cmd when present', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-run-config-'));
    const infrastructureDir = path.join(tempRoot, 'infrastructure', 'aws');
    fs.mkdirSync(infrastructureDir, { recursive: true });
    fs.writeFileSync(
      path.join(infrastructureDir, 'run-config.cmd'),
      [
        '@echo off',
        'set EG_TSX_ARTIFACT_BUCKET=eg-tssx-artifacts-prod',
        'set EG_TSX_DATABASE_PASSWORD=Tail$8119ProdDb!',
        'set EG_TSX_STACK_NAME=eg-tsx-prod',
      ].join('\n'),
      'utf8'
    );

    const env = loadInfrastructureRunConfigEnv({
      env: {
        AWS_REGION: 'us-east-2',
      },
      rootDir: tempRoot,
    });

    assert.equal(env.EG_TSX_ARTIFACT_BUCKET, 'eg-tssx-artifacts-prod');
    assert.equal(env.EG_TSX_DATABASE_PASSWORD, 'Tail$8119ProdDb!');
    assert.equal(env.EG_TSX_STACK_NAME, 'eg-tsx-prod');

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('does not override explicitly provided env values with run-config values', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-run-config-'));
    const infrastructureDir = path.join(tempRoot, 'infrastructure', 'aws');
    fs.mkdirSync(infrastructureDir, { recursive: true });
    fs.writeFileSync(
      path.join(infrastructureDir, 'run-config.cmd'),
      [
        '@echo off',
        'set EG_TSX_ARTIFACT_BUCKET=from-config',
        'set EG_TSX_DATABASE_PASSWORD=from-config-password',
      ].join('\n'),
      'utf8'
    );

    const env = loadInfrastructureRunConfigEnv({
      env: {
        EG_TSX_ARTIFACT_BUCKET: 'from-env',
        EG_TSX_DATABASE_PASSWORD: 'from-env-password',
      },
      rootDir: tempRoot,
    });

    assert.equal(env.EG_TSX_ARTIFACT_BUCKET, 'from-env');
    assert.equal(env.EG_TSX_DATABASE_PASSWORD, 'from-env-password');

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('parseDeployOptions', () => {
  it('applies sane defaults for prod deployment', () => {
    const options = parseDeployOptions([], {
      EG_TSX_ARTIFACT_BUCKET: 'eg-tsx-artifacts',
      EG_TSX_DATABASE_PASSWORD: 'secret',
    }, { rootDir: createIsolatedRoot() });

    assert.equal(options.projectName, 'eg-tsx');
    assert.equal(options.environment, 'prod');
    assert.equal(options.region, 'us-east-2');
    assert.equal(options.stackName, 'eg-tsx-prod');
    assert.equal(options.artifactBucket, 'eg-tsx-artifacts');
    assert.equal(options.databasePassword, 'secret');
    assert.equal(options.templatePath, 'infrastructure/aws/eg-tsx-stack.yaml');
    assert.equal(options.artifactPrefix, 'lambda');
    assert.equal(options.invalidationMode, 'smart');
    assert.equal(options.staticScope, 'site');
    assert.equal(options.syncMode, 'quick');
  });

  it('allows explicit args to override env values', () => {
    const options = parseDeployOptions(
      [
        '--project-name',
        'custom',
        '--environment',
        'dev',
        '--region',
        'us-west-2',
        '--stack-name',
        'custom-stack',
        '--artifact-bucket',
        'custom-bucket',
        '--database-password',
        'cli-secret',
        '--artifact-prefix',
        'deployments',
        '--static-scope',
        'images',
        '--sync-mode',
        'full',
        '--invalidation-mode',
        'full',
        '--invalidate-path',
        '/reviews/*',
        '--invalidate-path',
        '/_astro/*',
        '--skip-static',
        '--skip-invalidate',
        '--sync-search',
      ],
      {
        EG_TSX_ARTIFACT_BUCKET: 'ignored',
        EG_TSX_DATABASE_PASSWORD: 'ignored',
      },
      { rootDir: createIsolatedRoot() }
    );

    assert.equal(options.projectName, 'custom');
    assert.equal(options.environment, 'dev');
    assert.equal(options.region, 'us-west-2');
    assert.equal(options.stackName, 'custom-stack');
    assert.equal(options.artifactBucket, 'custom-bucket');
    assert.equal(options.databasePassword, 'cli-secret');
    assert.equal(options.artifactPrefix, 'deployments');
    assert.equal(options.staticScope, 'images');
    assert.equal(options.syncMode, 'full');
    assert.equal(options.invalidationMode, 'full');
    assert.deepEqual(options.invalidatePaths, ['/reviews/*', '/_astro/*']);
    assert.equal(options.skipStatic, true);
    assert.equal(options.skipInvalidate, true);
    assert.equal(options.syncSearch, true);
  });

  it('accepts a non-image data static scope for split rebuilds', () => {
    const options = parseDeployOptions(
      [
        '--artifact-bucket',
        'custom-bucket',
        '--database-password',
        'cli-secret',
        '--static-scope',
        'data',
      ],
      {},
      { rootDir: createIsolatedRoot() }
    );

    assert.equal(options.staticScope, 'data');
  });

  it('does not require a database password when stack updates are skipped', () => {
    const options = parseDeployOptions(
      ['--skip-stack', '--artifact-bucket', 'eg-tsx-artifacts'],
      {},
      { rootDir: createIsolatedRoot() }
    );

    assert.equal(options.skipStack, true);
    assert.equal(options.databasePassword, '');
  });

  it('throws when the artifact bucket is missing', () => {
    assert.throws(
      () => parseDeployOptions([], {}, { rootDir: createIsolatedRoot() }),
      /artifact bucket/i
    );
  });

  it('throws when the database password is missing for stack deploys', () => {
    assert.throws(
      () =>
        parseDeployOptions(['--artifact-bucket', 'eg-tsx-artifacts'], {}, { rootDir: createIsolatedRoot() }),
      /database password/i
    );
  });

  it('throws on an unsupported environment', () => {
    assert.throws(
      () =>
        parseDeployOptions(
          ['--artifact-bucket', 'eg-tsx-artifacts', '--database-password', 'secret', '--environment', 'qa'],
          {},
          { rootDir: createIsolatedRoot() }
        ),
      /environment/i
    );
  });

  it('throws on an unsupported static scope, sync mode, or invalidation mode', () => {
    assert.throws(
      () => parseDeployOptions(['--artifact-bucket', 'x', '--database-password', 'secret', '--static-scope', 'css'], {}, { rootDir: createIsolatedRoot() }),
      /static scope/i
    );
    assert.throws(
      () => parseDeployOptions(['--artifact-bucket', 'x', '--database-password', 'secret', '--sync-mode', 'slow'], {}, { rootDir: createIsolatedRoot() }),
      /sync mode/i
    );
    assert.throws(
      () => parseDeployOptions(['--artifact-bucket', 'x', '--database-password', 'secret', '--invalidation-mode', 'all'], {}, { rootDir: createIsolatedRoot() }),
      /invalidation mode/i
    );
  });
});

describe('CAPTURE_OUTPUT_MAX_BUFFER_BYTES', () => {
  it('allows large AWS dry-run output without overflowing the default sync buffer', () => {
    assert.equal(CAPTURE_OUTPUT_MAX_BUFFER_BYTES >= 32 * 1024 * 1024, true);
  });
});

describe('buildArtifactKey', () => {
  it('builds a timestamped zip key under the configured prefix', () => {
    const key = buildArtifactKey({
      projectName: 'eg-tsx',
      environment: 'prod',
      artifactPrefix: 'lambda',
      buildId: '20260306T120000Z',
    });

    assert.equal(key, 'lambda/eg-tsx-prod-20260306T120000Z.zip');
  });
});

describe('buildStaticSyncArgs', () => {
  it('excludes local-only originals folders and desktop junk from dry-run syncs', () => {
    assert.deepEqual(
      buildStaticSyncArgs({
        bucketName: 'eggear-tsx',
        clientDir: 'C:\\repo\\dist\\client',
        dryRun: true,
        region: 'us-east-2',
      }),
      [
        's3',
        'sync',
        'C:\\repo\\dist\\client\\',
        's3://eggear-tsx/',
        '--delete',
        '--dryrun',
        '--exclude',
        '*\\orginals\\*',
        '--exclude',
        '*/orginals/*',
        '--exclude',
        '*\\orginanls\\*',
        '--exclude',
        '*/orginanls/*',
        '--exclude',
        '*\\original\\*',
        '--exclude',
        '*/original/*',
        '--exclude',
        '*\\originals\\*',
        '--exclude',
        '*/originals/*',
        '--exclude',
        '*\\Thumbs.db',
        '--exclude',
        '*/Thumbs.db',
        '--exclude',
        '*\\Desktop.ini',
        '--exclude',
        '*/Desktop.ini',
        '--exclude',
        '*\\.DS_Store',
        '--exclude',
        '*/.DS_Store',
        '--region',
        'us-east-2',
      ]
    );
  });

  it('uses the same exclusion contract for real syncs without dry-run', () => {
    const args = buildStaticSyncArgs({
      bucketName: 'eggear-tsx',
      clientDir: 'C:\\repo\\dist\\client',
      dryRun: false,
      region: 'us-east-2',
    });

    assert.equal(args.includes('--dryrun'), false);
    assert.equal(args.includes('*\\orginals\\*'), true);
    assert.equal(args.includes('*/orginals/*'), true);
    assert.equal(args.includes('*\\orginanls\\*'), true);
    assert.equal(args.includes('*/orginanls/*'), true);
    assert.equal(args.includes('*\\original\\*'), true);
    assert.equal(args.includes('*/original/*'), true);
    assert.equal(args.includes('*\\originals\\*'), true);
    assert.equal(args.includes('*/originals/*'), true);
  });

  it('excludes image paths for non-image data syncs', () => {
    const args = buildStaticSyncArgs({
      bucketName: 'eggear-tsx',
      clientDir: 'C:\\repo\\dist\\client',
      dryRun: false,
      region: 'us-east-2',
      staticScope: 'data',
    });

    assert.equal(args.includes('--exclude'), true);
    assert.equal(args.includes('images\\*'), true);
    assert.equal(args.includes('images/*'), true);
    assert.equal(args.includes('*\\images\\*'), true);
    assert.equal(args.includes('*/images/*'), true);
  });
});

describe('buildStaticCopyArgs', () => {
  it('builds a recursive copy command with the same exclusion contract', () => {
    assert.deepEqual(
      buildStaticCopyArgs({
        destinationUri: 's3://eggear-tsx/images/',
        region: 'us-east-2',
        sourceDir: 'C:\\repo\\dist\\client\\images',
      }),
      [
        's3',
        'cp',
        'C:\\repo\\dist\\client\\images\\',
        's3://eggear-tsx/images/',
        '--recursive',
        '--exclude',
        '*\\orginals\\*',
        '--exclude',
        '*/orginals/*',
        '--exclude',
        '*\\orginanls\\*',
        '--exclude',
        '*/orginanls/*',
        '--exclude',
        '*\\original\\*',
        '--exclude',
        '*/original/*',
        '--exclude',
        '*\\originals\\*',
        '--exclude',
        '*/originals/*',
        '--exclude',
        '*\\Thumbs.db',
        '--exclude',
        '*/Thumbs.db',
        '--exclude',
        '*\\Desktop.ini',
        '--exclude',
        '*/Desktop.ini',
        '--exclude',
        '*\\.DS_Store',
        '--exclude',
        '*/.DS_Store',
        '--region',
        'us-east-2',
      ]
    );
  });

  it('excludes image paths for non-image data uploads', () => {
    const args = buildStaticCopyArgs({
      destinationUri: 's3://eggear-tsx/',
      region: 'us-east-2',
      sourceDir: 'C:\\repo\\dist\\client',
      staticScope: 'data',
    });

    assert.equal(args.includes('images\\*'), true);
    assert.equal(args.includes('images/*'), true);
    assert.equal(args.includes('*\\images\\*'), true);
    assert.equal(args.includes('*/images/*'), true);
  });
});

describe('buildStaticMirrorDeleteArgs', () => {
  it('builds a recursive wipe command for full mirror syncs', () => {
    assert.deepEqual(
      buildStaticMirrorDeleteArgs({
        destinationUri: 's3://eggear-tsx/',
        region: 'us-east-2',
      }),
      [
        's3',
        'rm',
        's3://eggear-tsx/',
        '--recursive',
        '--region',
        'us-east-2',
      ]
    );
  });

  it('preserves image paths during non-image data wipes', () => {
    assert.deepEqual(
      buildStaticMirrorDeleteArgs({
        destinationUri: 's3://eggear-tsx/',
        region: 'us-east-2',
        staticScope: 'data',
      }),
      [
        's3',
        'rm',
        's3://eggear-tsx/',
        '--recursive',
        '--exclude',
        'images/*',
        '--region',
        'us-east-2',
      ]
    );
  });
});

describe('countListedS3Objects', () => {
  it('counts non-empty aws s3 ls --recursive object rows', () => {
    assert.equal(
      countListedS3Objects(`
2026-03-08 13:20:00       4096 _astro/app.js
2026-03-08 13:20:01      24576 images/reviews/mouse/razer/viper-v3-pro/hero.webp

2026-03-08 13:20:03       1024 manifest.json
`),
      3
    );
  });
});

describe('countLocalFilesWithProgress', () => {
  it('counts local files and reports incremental scan milestones', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-local-scan-'));
    fs.mkdirSync(path.join(tempRoot, 'nested', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'a.txt'), 'a', 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'nested', 'b.txt'), 'b', 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'nested', 'deep', 'c.txt'), 'c', 'utf8');

    const milestones = [];
    const count = countLocalFilesWithProgress(tempRoot, {
      onProgress: (scannedCount) => milestones.push(scannedCount),
      reportEvery: 2,
    });

    assert.equal(count, 3);
    assert.deepEqual(milestones, [2, 3]);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('countRemoteS3ObjectsWithProgress', () => {
  it('counts streamed S3 object rows and reports incremental milestones', async () => {
    const progressMilestones = [];
    const count = await countRemoteS3ObjectsWithProgress({
      awsEnv: {},
      destinationUri: 's3://example-bucket/',
      onProgress: (scannedCount) => progressMilestones.push(scannedCount),
      region: 'us-east-2',
      reportEvery: 2,
      streamListCommand: async (_command, _args, options) => {
        options.onStdoutLine?.('2026-03-08 13:20:00       4096 index.html');
        options.onStdoutLine?.('2026-03-08 13:20:01       2048 _astro/app.js');
        options.onStdoutLine?.('warning: ignoring placeholder object');
        options.onStdoutLine?.('2026-03-08 13:20:02       1024 images/example.webp');
        return { stderr: '', stdout: '' };
      },
    });

    assert.equal(count, 3);
    assert.deepEqual(progressMilestones, [2, 3]);
  });
});

describe('resolveStaticSyncOperationTotal', () => {
  it('uses the preview diff size for quick sync totals when rows are available', () => {
    assert.equal(
      resolveStaticSyncOperationTotal({
        localFileCount: 1200,
        previewRows: [
          { path: 'index.html', status: 'modified' },
          { path: '_astro/app.js', status: 'modified' },
          { path: 'old.html', status: 'deleted' },
        ],
        remoteObjectCount: 900,
        syncMode: 'quick',
      }),
      3
    );
  });

  it('falls back to the local file count when quick preview rows are unavailable', () => {
    assert.equal(
      resolveStaticSyncOperationTotal({
        localFileCount: 57,
        previewRows: [],
        remoteObjectCount: 0,
        syncMode: 'quick',
      }),
      57
    );
  });

  it('treats full sync as wipe plus full upload', () => {
    assert.equal(
      resolveStaticSyncOperationTotal({
        localFileCount: 366,
        previewRows: [],
        remoteObjectCount: 412,
        syncMode: 'full',
      }),
      778
    );
  });
});

describe('pruneStaticDeployArtifacts', () => {
  it('removes local-only image stash directories and junk files without touching legitimate image paths', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-static-prune-'));
    const originalsDir = path.join(tempRoot, 'images', 'mouse', 'asus', 'rog-harpe-ace-aim-lab', 'originals');
    const originalDir = path.join(tempRoot, 'images', 'mouse', 'acer', 'cestus-310', 'original');
    const orginalsDir = path.join(tempRoot, 'images', 'tools', 'database', 'orginals');
    const orginanlsDir = path.join(tempRoot, 'images', 'tools', 'database', 'orginanls');
    const keepDir = path.join(tempRoot, 'images', 'reviews', 'keyboard', 'hyperx-alloy-origins-review');
    const junkFile = path.join(tempRoot, 'images', 'tools', 'mouse', 'mouse-hub', 'Thumbs.db');

    fs.mkdirSync(originalsDir, { recursive: true });
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(orginalsDir, { recursive: true });
    fs.mkdirSync(orginanlsDir, { recursive: true });
    fs.mkdirSync(keepDir, { recursive: true });
    fs.mkdirSync(path.dirname(junkFile), { recursive: true });

    fs.writeFileSync(path.join(originalsDir, 'huge.png'), 'x');
    fs.writeFileSync(path.join(originalDir, 'huge.png'), 'x');
    fs.writeFileSync(path.join(orginalsDir, 'huge.png'), 'x');
    fs.writeFileSync(path.join(orginanlsDir, 'huge.png'), 'x');
    fs.writeFileSync(path.join(keepDir, 'keep.webp'), 'x');
    fs.writeFileSync(junkFile, 'x');

    const result = pruneStaticDeployArtifacts(tempRoot);

    assert.deepEqual(result, {
      removedDirectories: 4,
      removedFiles: 1,
    });
    assert.equal(fs.existsSync(originalsDir), false);
    assert.equal(fs.existsSync(originalDir), false);
    assert.equal(fs.existsSync(orginalsDir), false);
    assert.equal(fs.existsSync(orginanlsDir), false);
    assert.equal(fs.existsSync(junkFile), false);
    assert.equal(fs.existsSync(path.join(keepDir, 'keep.webp')), true);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('assertStaticDeployArtifactsClean', () => {
  it('allows deployable image trees after local stash artifacts have been pruned', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-static-clean-'));
    const originalsDir = path.join(tempRoot, 'images', 'mouse', 'asus', 'rog-harpe-ace-aim-lab', 'originals');
    const keepDir = path.join(tempRoot, 'images', 'reviews', 'keyboard', 'hyperx-alloy-origins-review');

    fs.mkdirSync(originalsDir, { recursive: true });
    fs.mkdirSync(keepDir, { recursive: true });

    fs.writeFileSync(path.join(originalsDir, 'huge.png'), 'x');
    fs.writeFileSync(path.join(keepDir, 'keep.webp'), 'x');

    pruneStaticDeployArtifacts(tempRoot);

    assert.doesNotThrow(() => assertStaticDeployArtifactsClean({
      clientDir: tempRoot,
      staticScope: 'site',
    }));

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('throws when a stash alias directory survives into the deploy tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-static-violation-'));
    const originalsDir = path.join(tempRoot, 'images', 'mouse', 'logitech', 'g-pro-wireless', 'originals');

    fs.mkdirSync(originalsDir, { recursive: true });
    fs.writeFileSync(path.join(originalsDir, 'huge.png'), 'x');

    assert.throws(
      () => assertStaticDeployArtifactsClean({
        clientDir: tempRoot,
        staticScope: 'site',
      }),
      /originals/
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('throws when html survives anywhere under images in the deploy tree', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-static-html-'));
    const htmlFile = path.join(tempRoot, 'images', 'mouse', 'lamzu', 'atlantis-mini', 'render.html');

    fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
    fs.writeFileSync(htmlFile, '<html></html>');

    assert.throws(
      () => assertStaticDeployArtifactsClean({
        clientDir: tempRoot,
        staticScope: 'images',
      }),
      /render\.html/
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('skips image artifact enforcement for data-only publishes', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-static-data-'));
    const htmlFile = path.join(tempRoot, 'images', 'mouse', 'vaxee', 'xe-s', 'render.html');

    fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
    fs.writeFileSync(htmlFile, '<html></html>');

    assert.doesNotThrow(() => assertStaticDeployArtifactsClean({
      clientDir: tempRoot,
      staticScope: 'data',
    }));

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('buildLambdaArtifactLayout', () => {
  it('packages only the server runtime assets and excludes static client files', () => {
    assert.deepEqual(buildLambdaArtifactLayout(), {
      copyDirectories: ['dist/server'],
      copyFiles: ['package.json', 'package-lock.json'],
    });
  });
});

describe('buildLambdaPackageProgressLine', () => {
  it('formats a dashboard-friendly package progress line', () => {
    assert.equal(buildLambdaPackageProgressLine(42), '[lambda] package 42%');
  });

  it('clamps package progress to the valid percentage range', () => {
    assert.equal(buildLambdaPackageProgressLine(-5), '[lambda] package 0%');
    assert.equal(buildLambdaPackageProgressLine(105), '[lambda] package 100%');
  });
});

describe('buildLambdaStageProgressLine', () => {
  it('formats a generic lambda stage progress line for the dashboard', () => {
    assert.equal(
      buildLambdaStageProgressLine('lambda-upload', 64, 'Uploading zip to artifact bucket'),
      '[lambda] stage lambda-upload 64% Uploading zip to artifact bucket'
    );
  });

  it('clamps generic lambda stage progress percentages to the valid range', () => {
    assert.equal(buildLambdaStageProgressLine('lambda-live', -5), '[lambda] stage lambda-live 0%');
    assert.equal(buildLambdaStageProgressLine('lambda-live', 140), '[lambda] stage lambda-live 100%');
  });
});

describe('buildSiteStageProgressEvent', () => {
  it('builds a normalized structured site-stage progress payload', () => {
    assert.deepEqual(
      buildSiteStageProgressEvent('build', 42.2, 'Generating static routes'),
      {
        detail: 'Generating static routes',
        egTsxEvent: true,
        kind: 'site_stage_progress',
        progress: 42,
        stage: 'build',
      }
    );
  });

  it('clamps site-stage progress outside the 0-100 range', () => {
    assert.deepEqual(
      buildSiteStageProgressEvent('cdn', 140),
      {
        detail: '',
        egTsxEvent: true,
        kind: 'site_stage_progress',
        progress: 100,
        stage: 'cdn',
      }
    );
  });
});

describe('startProgressHeartbeat', () => {
  it('emits an immediate progress update and advances toward the cap while work is silent', async () => {
    const events = [];
    const heartbeat = startProgressHeartbeat({
      cap: 20,
      detail: 'Reconciling local files against S3 mirror',
      emitProgress: (progress, detail) => {
        events.push({ detail, progress });
      },
      intervalMs: 5,
      start: 10,
      step: 5,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    heartbeat.stop();

    assert.deepEqual(events, [
      { detail: 'Reconciling local files against S3 mirror', progress: 10 },
      { detail: 'Reconciling local files against S3 mirror', progress: 15 },
      { detail: 'Reconciling local files against S3 mirror', progress: 20 },
    ]);
  });

  it('stops emitting further progress once stopped', async () => {
    const events = [];
    const heartbeat = startProgressHeartbeat({
      cap: 30,
      detail: 'Listing existing S3 objects',
      emitProgress: (progress) => {
        events.push(progress);
      },
      intervalMs: 5,
      start: 20,
      step: 5,
    });

    await new Promise((resolve) => setTimeout(resolve, 8));
    heartbeat.stop();
    const stoppedCount = events.length;
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(events.length, stoppedCount);
    assert.deepEqual(events, [20, 25]);
  });
});

describe('parseAstroBuildProgressLine', () => {
  it('maps Astro lifecycle lines to structured site build progress', () => {
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:51[22m [34m[@astrojs/node][39m Enabling sessions with filesystem storage'),
      { detail: 'Initializing Astro node adapter', progress: 4 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[content][39m Synced content'),
      { detail: 'Content synchronized', progress: 12 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[types][39m Generated [2m1.19s[22m'),
      { detail: 'Generated content types', progress: 16 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[build][39m output: [34m"static"[39m'),
      { detail: 'Resolved static output target', progress: 20 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[build][39m mode: [34m"server"[39m'),
      { detail: 'Confirmed server build mode', progress: 24 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[build][39m directory: [34mC:\\repo\\dist\\[39m'),
      { detail: 'Resolved dist directory', progress: 28 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[2m13:15:52[22m [34m[build][39m adapter: [32m@astrojs/node[39m'),
      { detail: 'Confirmed Node adapter', progress: 32 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[build] Collecting build info...'),
      { detail: 'Collecting build info', progress: 36 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[build] building static entrypoints'),
      { detail: 'Building entrypoints', progress: 42 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[42m[30m building client (vite) [39m[49m'),
      { detail: 'Building client bundles', progress: 48 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[vite] transforming...'),
      { detail: 'Transforming client modules', progress: 52 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[vite] ✓ 128 modules transformed.'),
      { detail: 'Transforming client modules', progress: 56 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('[vite] built in 1.23s'),
      { detail: 'Bundled entrypoints', progress: 60 }
    );
    assert.deepEqual(
      parseAstroBuildProgressLine('generating static routes'),
      { detail: 'Generating static routes', progress: 72 }
    );
  });

  it('does not treat intermediate Astro completion lines as a finished build', () => {
    assert.equal(parseAstroBuildProgressLine('[build] ✓ Completed in 948ms.'), null);
  });

  it('returns null for unrelated build output lines', () => {
    assert.equal(parseAstroBuildProgressLine('random line'), null);
  });
});

describe('parseAwsCliTransferProgressLine', () => {
  it('extracts upload progress from an aws s3 cp progress line', () => {
    assert.deepEqual(
      parseAwsCliTransferProgressLine('Completed 1.6 MiB/4.2 MiB (2.3 MiB/s) with 1 file(s) remaining'),
      {
        completedBytes: 1677721.6,
        totalBytes: 4404019.2,
        percentage: 38,
      }
    );
  });

  it('returns null for lines that are not aws transfer progress', () => {
    assert.equal(parseAwsCliTransferProgressLine('upload: file.zip to s3://bucket/key.zip'), null);
  });
});

describe('summarizeStackResourceProgress', () => {
  it('derives real CloudFormation progress from resource events', () => {
    assert.deepEqual(
      summarizeStackResourceProgress([
        {
          EventId: '3',
          LogicalResourceId: 'SearchApiLambda',
          ResourceType: 'AWS::Lambda::Function',
          ResourceStatus: 'UPDATE_COMPLETE',
        },
        {
          EventId: '2',
          LogicalResourceId: 'SearchApiLambda',
          ResourceType: 'AWS::Lambda::Function',
          ResourceStatus: 'UPDATE_IN_PROGRESS',
        },
        {
          EventId: '1',
          LogicalResourceId: 'SearchApiLogGroup',
          ResourceType: 'AWS::Logs::LogGroup',
          ResourceStatus: 'UPDATE_IN_PROGRESS',
        },
      ]),
      {
        completed: 1,
        percentage: 50,
        total: 2,
      }
    );
  });

  it('returns zero progress when no resource events are available yet', () => {
    assert.deepEqual(summarizeStackResourceProgress([]), {
      completed: 0,
      percentage: 0,
      total: 0,
    });
  });
});

describe('zipDirectory', () => {
  it('creates a zip stream and reports compression progress through the callback', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-zip-directory-'));
    const sourceDir = path.join(tempRoot, 'source');
    const destinationPath = path.join(tempRoot, 'artifact.zip');
    const progressValues = [];
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'index.js'), 'export const ok = true;', 'utf8');

    let archivedSource = '';
    let archivedDestination = '';

    await zipDirectory({
      sourceDir,
      destinationPath,
      onProgress: (percentage) => progressValues.push(percentage),
      createArchiver: () => {
        const archive = new EventEmitter();
        archive.pointer = () => 9;
        archive.directory = (nextSourceDir, nextDestination) => {
          archivedSource = nextSourceDir;
          archivedDestination = nextDestination;
          return archive;
        };
        archive.pipe = (output) => {
          archive.output = output;
          return archive;
        };
        archive.finalize = () => {
          archive.emit('progress', { fs: { totalBytes: 200, processedBytes: 100 } });
          archive.emit('progress', { fs: { totalBytes: 200, processedBytes: 200 } });
          archive.output.end('zip-bytes');
          return Promise.resolve();
        };
        return archive;
      },
    });

    assert.equal(archivedSource, sourceDir);
    assert.equal(archivedDestination, false);
    assert.deepEqual(progressValues, [0, 50, 100]);
    assert.equal(fs.readFileSync(destinationPath, 'utf8'), 'zip-bytes');

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('rejects when the archiver emits an error', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-zip-directory-'));
    const sourceDir = path.join(tempRoot, 'source');
    const destinationPath = path.join(tempRoot, 'artifact.zip');
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'index.js'), 'export const ok = true;', 'utf8');

    await assert.rejects(
      zipDirectory({
        sourceDir,
        destinationPath,
        createArchiver: () => {
          const archive = new EventEmitter();
          archive.pointer = () => 0;
          archive.directory = () => archive;
          archive.pipe = (output) => {
            archive.output = output;
            return archive;
          };
          archive.finalize = () => {
            archive.emit('error', new Error('zip failed'));
            return Promise.resolve();
          };
          return archive;
        },
      }),
      /zip failed/
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe('resolveRunCommandStdio', () => {
  it('captures child command output during dashboard event streaming instead of inheriting stdio', () => {
    assert.deepEqual(
      resolveRunCommandStdio({}, { EG_TSX_EVENT_STREAM: '1' }),
      ['ignore', 'pipe', 'pipe']
    );
  });

  it('still honors explicit captureOutput outside dashboard mode', () => {
    assert.deepEqual(
      resolveRunCommandStdio({ captureOutput: true }, {}),
      ['ignore', 'pipe', 'pipe']
    );
  });

  it('inherits stdio by default when dashboard event streaming is disabled', () => {
    assert.equal(resolveRunCommandStdio({}, {}), 'inherit');
  });
});

describe('resolveRunCommandWindowsHide', () => {
  it('hides child command windows during dashboard event streaming on Windows', () => {
    assert.equal(resolveRunCommandWindowsHide('win32'), true);
  });

  it('does not set windowsHide on non-Windows platforms', () => {
    assert.equal(resolveRunCommandWindowsHide('linux'), undefined);
  });
});

describe('buildCloudFormationParameterOverrides', () => {
  it('builds the parameter overrides expected by the template', () => {
    const overrides = buildCloudFormationParameterOverrides({
      projectName: 'eg-tsx',
      environment: 'prod',
      databasePassword: 'secret',
      artifactBucket: 'eg-tsx-artifacts',
      artifactKey: 'lambda/eg-tsx-prod-20260306T120000Z.zip',
    });

    assert.deepEqual(overrides, [
      'ProjectName=eg-tsx',
      'Environment=prod',
      'DatabasePassword=secret',
      'LambdaCodeS3Bucket=eg-tsx-artifacts',
      'LambdaCodeS3Key=lambda/eg-tsx-prod-20260306T120000Z.zip',
    ]);
  });
});

describe('buildDeployStages', () => {
  it('returns the full operator stage list for a standard deploy', () => {
    assert.deepEqual(
      buildDeployStages({
        invalidationMode: 'smart',
        skipBuild: false,
        staticScope: 'site',
        skipStack: false,
        skipStatic: false,
        skipInvalidate: false,
        syncMode: 'quick',
        syncSearch: false,
      }),
      [
        { id: 'build', label: 'Running Astro Build' },
        { id: 'stage-lambda', label: 'Packaging Lambda Artifact' },
        { id: 'upload-lambda', label: 'Uploading Lambda Artifact' },
        { id: 'deploy-stack', label: 'Deploying CloudFormation Stack' },
        { id: 'read-stack', label: 'Refreshing Stack Outputs' },
        { id: 'preview-static', label: 'Previewing Changed Site Files' },
        { id: 'sync-static', label: 'Syncing Changed Site Files' },
        { id: 'invalidate', label: 'Invalidating CloudFront (Smart)' },
      ]
    );
  });

  it('removes skipped stages for a lambda-only deploy', () => {
    assert.deepEqual(
      buildDeployStages({
        invalidationMode: 'smart',
        skipBuild: true,
        staticScope: 'site',
        skipStack: false,
        skipStatic: true,
        skipInvalidate: true,
        syncMode: 'quick',
        syncSearch: false,
      }),
      [
        { id: 'stage-lambda', label: 'Packaging Lambda Artifact' },
        { id: 'upload-lambda', label: 'Uploading Lambda Artifact' },
        { id: 'deploy-stack', label: 'Deploying CloudFormation Stack' },
        { id: 'read-stack', label: 'Refreshing Stack Outputs' },
      ]
    );
  });

  it('uses explicit labels for full image uploads and full invalidation', () => {
    assert.deepEqual(
      buildDeployStages({
        invalidationMode: 'full',
        skipBuild: true,
        staticScope: 'images',
        skipStack: true,
        skipStatic: false,
        skipInvalidate: false,
        syncMode: 'full',
        syncSearch: false,
      }),
      [
        { id: 'read-stack', label: 'Refreshing Stack Outputs' },
        { id: 'sync-static', label: 'Uploading Full Image Set' },
        { id: 'invalidate', label: 'Invalidating CloudFront (Full)' },
      ]
    );
  });

  it('omits stack refresh for pure astro build-only publishes', () => {
    assert.deepEqual(
      buildDeployStages({
        invalidationMode: 'smart',
        skipBuild: false,
        staticScope: 'site',
        skipStack: true,
        skipStatic: true,
        skipInvalidate: true,
        syncMode: 'quick',
        syncSearch: false,
      }),
      [
        { id: 'build', label: 'Running Astro Build' },
      ]
    );
  });
});

describe('summarizeS3TransferOutput', () => {
  it('counts uploads, deletes, copies, and warnings without echoing every line', () => {
    assert.deepEqual(
      summarizeS3TransferOutput(`
(dryrun) upload: dist/client/index.html to s3://eggear-tsx/index.html
upload: dist/client/index.html to s3://eggear-tsx/index.html
copy: dist/client/_astro/app.js to s3://eggear-tsx/_astro/app.js
delete: s3://eggear-tsx/old.html
warning: Skipping file C:/repo/dist/client/images/originals/foo.png. File does not exist.
`),
      {
        copies: 1,
        deletes: 1,
        uploads: 2,
        warnings: 1,
      }
    );
  });
});

describe('summarizeCloudFrontInvalidationPayload', () => {
  it('builds a concise invalidation summary from the AWS response payload', () => {
    assert.equal(
      summarizeCloudFrontInvalidationPayload({
        Invalidation: {
          Id: 'I123456789',
          InvalidationBatch: {
            Paths: {
              Items: ['/images/*', '/_astro/*'],
            },
          },
          Status: 'InProgress',
        },
      }),
      '[cdn] invalidation I123456789 InProgress for 2 paths'
    );
  });
});

describe('parseDryRunRows', () => {
  it('classifies dry-run uploads as new or modified when existing remote keys are provided', () => {
    assert.deepEqual(
      parseDryRunRows(
        `
(dryrun) upload: dist/client/images/reviews/mouse/razer/viper-v3-pro/thumb.webp to s3://eggear-tsx/images/reviews/mouse/razer/viper-v3-pro/thumb.webp
(dryrun) upload: dist/client/images/news/mice/best-wireless/hero.webp to s3://eggear-tsx/images/news/mice/best-wireless/hero.webp
(dryrun) delete: s3://eggear-tsx/images/games/elden-ring/poster.webp
`,
        {
          existingRemoteKeys: new Set([
            'images/reviews/mouse/razer/viper-v3-pro/thumb.webp',
          ]),
        }
      ),
      [
        { path: 'images/reviews/mouse/razer/viper-v3-pro/thumb.webp', status: 'modified' },
        { path: 'images/news/mice/best-wireless/hero.webp', status: 'new' },
        { path: 'images/games/elden-ring/poster.webp', status: 'deleted' },
      ]
    );
  });
});

describe('buildRequestedInvalidationPlan', () => {
  it('uses the curated full-site manifest instead of a root wildcard for full site invalidation', () => {
    assert.deepEqual(
      buildRequestedInvalidationPlan({
        changedSourcePaths: [],
        invalidatePaths: [],
        invalidationMode: 'full',
        invalidationMaxPaths: 6,
        s3DiffRows: [],
        staticScope: 'site',
        syncMode: 'full',
      }),
      {
        changedCount: SITE_FULL_INVALIDATION_PATHS.length,
        mode: 'full',
        paths: SITE_FULL_INVALIDATION_PATHS,
        reason: 'Operator requested a full CloudFront invalidation.',
      }
    );
  });

  it('uses the images namespace wildcard for full image invalidation', () => {
    assert.deepEqual(
      buildRequestedInvalidationPlan({
        changedSourcePaths: [],
        invalidatePaths: [],
        invalidationMode: 'full',
        invalidationMaxPaths: 6,
        s3DiffRows: [],
        staticScope: 'images',
        syncMode: 'full',
      }),
      {
        changedCount: 1,
        mode: 'full',
        paths: ['/images/*'],
        reason: 'Operator requested a full CloudFront invalidation.',
      }
    );
  });
});

describe('splitCloudFrontInvalidationGroups', () => {
  it('splits large wildcard manifests into CloudFront-safe invalidation groups', () => {
    const groups = splitCloudFrontInvalidationGroups(SITE_FULL_INVALIDATION_PATHS);

    assert.ok(groups.length >= 2);
    assert.equal(groups.flat().length, SITE_FULL_INVALIDATION_PATHS.length);
    assert.equal(
      groups.every((group) => group.filter((item) => item.includes('*')).length <= 15),
      true
    );
  });
});

describe('deploy-aws invalidation verification', () => {
  it('keeps the invalidation flow green when get-invalidation is unauthorized after invalidation creation', async (t) => {
    const childProcessModule = require('node:child_process');
    const awsCalls = [];
    const logLines = [];
    let invalidationCounter = 0;
    const originalSpawnSync = childProcessModule.spawnSync;

    childProcessModule.spawnSync = (_command, args = []) => {
      awsCalls.push(args.join(' '));
      if (args[0] === 'cloudfront' && args[1] === 'create-invalidation') {
        invalidationCounter += 1;
        const pathsIndex = args.indexOf('--paths');
        const regionIndex = args.indexOf('--region');
        const pathArgs = pathsIndex === -1
          ? []
          : args.slice(pathsIndex + 1, regionIndex === -1 ? undefined : regionIndex);
        return {
          error: undefined,
          signal: null,
          status: 0,
          stderr: '',
          stdout: JSON.stringify({
            Invalidation: {
              Id: `I${String(invalidationCounter).padStart(5, '0')}`,
              Status: 'InProgress',
              InvalidationBatch: {
                Paths: {
                  Items: pathArgs,
                },
              },
            },
          }),
        };
      }

      if (args[0] === 'cloudfront' && args[1] === 'get-invalidation') {
        const idIndex = args.indexOf('--id');
        const invalidationId = idIndex === -1 ? 'UNKNOWN' : args[idIndex + 1];
        return {
          error: undefined,
          signal: null,
          status: 1,
          stderr: `An error occurred (AccessDenied) when calling the GetInvalidation operation: User is not authorized to perform cloudfront:GetInvalidation for ${invalidationId}.`,
          stdout: '',
        };
      }

      throw new Error(`Unexpected spawnSync invocation: ${args.join(' ')}`);
    };
    syncBuiltinESMExports();
    t.after(() => {
      childProcessModule.spawnSync = originalSpawnSync;
      syncBuiltinESMExports();
    });
    t.mock.method(console, 'log', (...parts) => {
      logLines.push(parts.join(' '));
    });

    const { invalidateCloudFront } = await import(`../deploy-aws.mjs?invalidate-test=${Date.now()}`);
    await invalidateCloudFront('E1FAKE123456', 'us-east-2', SITE_FULL_INVALIDATION_PATHS, {});

    const output = logLines.join('\n');
    assert.match(output, /\[cdn\] group 2\/2 invalidating /);
    assert.match(output, /\[cdn\] invalidation I00001 status Unverified/);
    assert.match(output, /\[cdn\] invalidation I00002 status Unverified/);
    assert.equal(output.includes('FAILED with exit code'), false);
    assert.equal((awsCalls.filter((call) => call.startsWith('cloudfront create-invalidation')).length), 2);
    assert.equal((awsCalls.filter((call) => call.startsWith('cloudfront get-invalidation')).length), 2);
  });
});

describe('formatStackOutputSummary', () => {
  it('reduces stack outputs to the values an operator actually needs', () => {
    assert.deepEqual(
      formatStackOutputSummary({
        CloudFrontDistributionId: 'EDFDVBD6EXAMPLE',
        LambdaFunctionName: 'eggear-tsx-ssr',
        StaticSiteBucketName: 'eggear-tsx',
      }),
      [
        '[stack] static bucket eggear-tsx',
        '[stack] distribution EDFDVBD6EXAMPLE',
        '[stack] lambda eggear-tsx-ssr',
      ]
    );
  });
});

describe('shouldPreviewStaticDiff', () => {
  it('skips preview when static upload is skipped even if invalidation mode is smart', () => {
    assert.equal(
      shouldPreviewStaticDiff({
        invalidatePaths: ['/images/*'],
        invalidationMode: 'smart',
        skipInvalidate: false,
        skipStatic: true,
      }),
      false
    );
  });

  it('runs preview for smart invalidation when static sync is active', () => {
    assert.equal(
      shouldPreviewStaticDiff({
        invalidatePaths: [],
        invalidationMode: 'smart',
        syncMode: 'full',
        skipInvalidate: false,
        skipStatic: false,
      }),
      true
    );
  });

  it('runs preview for quick syncs even when invalidation is skipped', () => {
    assert.equal(
      shouldPreviewStaticDiff({
        invalidatePaths: [],
        invalidationMode: 'smart',
        syncMode: 'quick',
        skipInvalidate: true,
        skipStatic: false,
      }),
      true
    );
  });
});

describe('shouldReadStackOutputs', () => {
  it('skips stack output refresh for pure build-only publishes', () => {
    assert.equal(
      shouldReadStackOutputs({
        skipStack: true,
        skipStatic: true,
        skipInvalidate: true,
      }),
      false
    );
  });

  it('keeps stack output refresh when later work depends on infrastructure outputs', () => {
    assert.equal(
      shouldReadStackOutputs({
        skipStack: false,
        skipStatic: true,
        skipInvalidate: true,
      }),
      true
    );
    assert.equal(
      shouldReadStackOutputs({
        skipStack: true,
        skipStatic: false,
        skipInvalidate: true,
      }),
      true
    );
    assert.equal(
      shouldReadStackOutputs({
        skipStack: true,
        skipStatic: true,
        skipInvalidate: false,
      }),
      true
    );
  });
});

describe('rewriteWorkspaceReferences', () => {
  it('rewrites file URLs, forward-slash paths, and escaped Windows paths to Lambda runtime paths', () => {
    const workspaceRoot = 'C:\\Users\\Chris\\Desktop\\EG - Convert\\EG - TSX';
    const source = [
      '"client":"file:///C:/Users/Chris/Desktop/EG%20-%20Convert/EG%20-%20TSX/dist/client/"',
      '"server":"file:///C:/Users/Chris/Desktop/EG%20-%20Convert/EG%20-%20TSX/dist/server/"',
      '"C:/Users/Chris/Desktop/EG - Convert/EG - TSX/src/pages/index.astro"',
      '"C:\\\\Users\\\\Chris\\\\Desktop\\\\EG - Convert\\\\EG - TSX\\\\.astro\\\\content-assets.mjs"',
    ].join('\n');

    const rewritten = rewriteWorkspaceReferences(source, workspaceRoot);

    assert.ok(rewritten.includes('"client":"file:///var/task/dist/client/"'));
    assert.ok(rewritten.includes('"server":"file:///var/task/dist/server/"'));
    assert.ok(rewritten.includes('"/var/task/src/pages/index.astro"'));
    assert.ok(rewritten.includes('"/var/task/.astro/content-assets.mjs"'));
    assert.equal(rewritten.includes('C:/Users/Chris/Desktop/EG - Convert/EG - TSX'), false);
    assert.equal(rewritten.includes('C:\\\\Users\\\\Chris\\\\Desktop\\\\EG - Convert\\\\EG - TSX'), false);
  });
});

describe('buildSpawnInvocation', () => {
  it('runs npm through cmd.exe on Windows', () => {
    assert.deepEqual(
      buildSpawnInvocation('npm', ['run', 'build'], 'win32'),
      {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npm.cmd run build'],
      }
    );

    assert.deepEqual(
      buildSpawnInvocation('npx', ['astro', 'build'], 'win32'),
      {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx.cmd astro build'],
      }
    );
  });

  it('leaves direct executables unchanged on non-Windows or for non-cmd tools', () => {
    assert.deepEqual(
      buildSpawnInvocation('npm', ['run', 'build'], 'linux'),
      {
        command: 'npm',
        args: ['run', 'build'],
      }
    );

    assert.deepEqual(
      buildSpawnInvocation('aws', ['--version'], 'win32'),
      {
        command: 'aws',
        args: ['--version'],
      }
    );
  });
});

describe('collectRuntimePackagePaths', () => {
  it('returns only non-dev node_modules package paths from a lockfile payload', () => {
    const runtimePaths = collectRuntimePackagePaths({
      lockfile: {
        packages: {
          '': {
            dependencies: {
              react: '^19.0.0',
            },
            devDependencies: {
              typescript: '^5.0.0',
            },
          },
          'node_modules/react': {
            version: '19.0.0',
          },
          'node_modules/react-dom': {
            version: '19.0.0',
          },
          'node_modules/typescript': {
            dev: true,
            version: '5.0.0',
          },
          'node_modules/@types/react': {
            dev: true,
            version: '19.0.0',
          },
          'node_modules/scheduler': {
            version: '0.25.0',
          },
        },
      },
    });

    assert.deepEqual(runtimePaths, [
      'node_modules/react',
      'node_modules/react-dom',
      'node_modules/scheduler',
    ]);
  });
});
