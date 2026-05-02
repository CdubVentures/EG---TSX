#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildAssumeRoleEnv,
  buildCloudFormationDeployArgs,
  parseAssumeRoleCredentials,
  resolveAssumableOperatorRoleArn,
  resolveOperatorRoleArn,
} from './aws-operator.mjs';
import {
  buildCdnInvalidationPlan,
  buildImageCdnInvalidationPlan,
  normalizeInvalidationPaths,
  SITE_FULL_INVALIDATION_PATHS,
} from './invalidation-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const BUILD_DIR = path.join(ROOT_DIR, 'infrastructure', 'aws', 'build');
const TEMP_ROOT = process.env.EG_TSX_TEMP_DIR || process.env.TEMP || process.env.TMP || BUILD_DIR;
const STAGING_DIR = path.join(TEMP_ROOT, 'egtsx-lambda');
export const CAPTURE_OUTPUT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
// Keep this explicit to avoid false positives on legitimate folders like "alloy-origins".
const STATIC_STASH_DIRECTORY_ALIASES = ['orginals', 'orginanls', 'original', 'originals'];
const STATIC_STASH_DIRECTORY_NAMES = new Set(STATIC_STASH_DIRECTORY_ALIASES);
const STATIC_JUNK_FILENAMES = new Set(['Thumbs.db', 'Desktop.ini', '.DS_Store']);
const STATIC_SYNC_EXCLUDE_PATTERNS = [
  ...STATIC_STASH_DIRECTORY_ALIASES.flatMap((directoryName) => [
    `*\\${directoryName}\\*`,
    `*/${directoryName}/*`,
  ]),
  '*\\Thumbs.db',
  '*/Thumbs.db',
  '*\\Desktop.ini',
  '*/Desktop.ini',
  '*\\.DS_Store',
  '*/.DS_Store',
];
const DATA_SCOPE_IMAGE_EXCLUDE_PATTERNS = [
  'images\\*',
  'images/*',
  '*\\images\\*',
  '*/images/*',
];
const STATIC_SCOPE_VALUES = new Set(['site', 'data', 'images']);
const SYNC_MODE_VALUES = new Set(['quick', 'full']);
const INVALIDATION_MODE_VALUES = new Set(['smart', 'full']);
const S3_OBJECT_LIST_LINE_PATTERN = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\d+\s+/;

function isImageStaticScope(staticScope) {
  return staticScope === 'images';
}

function isDataStaticScope(staticScope) {
  return staticScope === 'data';
}

function getStaticScopeLabel(staticScope) {
  if (isImageStaticScope(staticScope)) {
    return 'images';
  }
  if (isDataStaticScope(staticScope)) {
    return 'data';
  }
  return 'site';
}

function getStaticScopeExcludes(staticScope) {
  return isDataStaticScope(staticScope)
    ? [...STATIC_SYNC_EXCLUDE_PATTERNS, ...DATA_SCOPE_IMAGE_EXCLUDE_PATTERNS]
    : STATIC_SYNC_EXCLUDE_PATTERNS;
}

function parseDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const result = {};
  const source = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    if (key) {
      result[key] = value;
    }
  }

  return result;
}

export function loadInfrastructureRunConfigEnv({ rootDir = ROOT_DIR, env = process.env } = {}) {
  const mergedEnv = {
    ...env,
  };

  // Load .env.deploy from tools/deploy-dashboard/ (lowest priority after run-config)
  const envDeployPath = path.join(rootDir, 'tools', 'deploy-dashboard', '.env.deploy');
  const envDeployVars = parseDotenvFile(envDeployPath);
  for (const [key, value] of Object.entries(envDeployVars)) {
    if (!mergedEnv[key]) {
      mergedEnv[key] = value;
    }
  }

  // Load run-config.cmd (overrides .env.deploy but not process.env)
  const runConfigPath = path.join(rootDir, 'infrastructure', 'aws', 'run-config.cmd');
  if (!fs.existsSync(runConfigPath)) {
    return mergedEnv;
  }

  const source = fs.readFileSync(runConfigPath, 'utf8');
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('@echo') || line.toLowerCase().startsWith('rem ')) {
      continue;
    }

    const match = line.match(/^set\s+([^=\s]+)=(.*)$/i);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (mergedEnv[key]) {
      continue;
    }

    mergedEnv[key] = rawValue.trim();
  }

  return mergedEnv;
}

export function parseDeployOptions(argv, env = process.env, options = {}) {
  const hydratedEnv = loadInfrastructureRunConfigEnv({
    env,
    rootDir: options.rootDir || ROOT_DIR,
  });
  const readValue = (flag) => {
    const index = argv.indexOf(flag);
    if (index === -1) {
      return '';
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${flag} requires a value.`);
    }

    return value;
  };

  const readValues = (flag) => {
    const values = [];
    for (let index = 0; index < argv.length; index += 1) {
      if (argv[index] !== flag) {
        continue;
      }

      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a value.`);
      }

      values.push(value);
    }

    return values;
  };

  const hasFlag = (flag) => argv.includes(flag);
  const projectName = readValue('--project-name') || hydratedEnv.EG_TSX_PROJECT_NAME || 'eg-tsx';
  const environment = readValue('--environment') || hydratedEnv.EG_TSX_ENVIRONMENT || 'prod';
  const region = readValue('--region') || hydratedEnv.AWS_REGION || hydratedEnv.AWS_DEFAULT_REGION || 'us-east-2';
  const stackName = readValue('--stack-name') || hydratedEnv.EG_TSX_STACK_NAME || `${projectName}-${environment}`;
  const artifactBucket = readValue('--artifact-bucket') || hydratedEnv.EG_TSX_ARTIFACT_BUCKET || '';
  const artifactPrefix = readValue('--artifact-prefix') || hydratedEnv.EG_TSX_ARTIFACT_PREFIX || 'lambda';
  const databasePassword = readValue('--database-password') || hydratedEnv.EG_TSX_DATABASE_PASSWORD || '';
  const templatePath = readValue('--template-path') || 'infrastructure/aws/eg-tsx-stack.yaml';
  const buildId = readValue('--build-id') || hydratedEnv.EG_TSX_BUILD_ID || createBuildId();
  const staticScope = readValue('--static-scope') || hydratedEnv.EG_TSX_STATIC_SCOPE || 'site';
  const syncMode = readValue('--sync-mode') || hydratedEnv.EG_TSX_SYNC_MODE || 'quick';
  const invalidationMode = readValue('--invalidation-mode') || hydratedEnv.EG_TSX_INVALIDATION_MODE || 'smart';
  const invalidationMaxPaths = Number(
    readValue('--invalidation-max-paths') ||
    hydratedEnv.EG_TSX_INVALIDATION_MAX_PATHS ||
    '6'
  );
  const invalidatePaths = normalizeInvalidationPaths(readValues('--invalidate-path'));
  const skipBuild = hasFlag('--skip-build');
  const skipStatic = hasFlag('--skip-static');
  const skipStack = hasFlag('--skip-stack');
  const skipInvalidate = hasFlag('--skip-invalidate');
  const syncSearch = hasFlag('--sync-search');

  if (!['dev', 'prod'].includes(environment)) {
    throw new Error(`Environment must be dev or prod. Received: ${environment}`);
  }

  if (!STATIC_SCOPE_VALUES.has(staticScope)) {
    throw new Error(`Static scope must be one of ${[...STATIC_SCOPE_VALUES].join(', ')}. Received: ${staticScope}`);
  }

  if (!SYNC_MODE_VALUES.has(syncMode)) {
    throw new Error(`Sync mode must be one of ${[...SYNC_MODE_VALUES].join(', ')}. Received: ${syncMode}`);
  }

  if (!INVALIDATION_MODE_VALUES.has(invalidationMode)) {
    throw new Error(`Invalidation mode must be one of ${[...INVALIDATION_MODE_VALUES].join(', ')}. Received: ${invalidationMode}`);
  }

  if (!Number.isInteger(invalidationMaxPaths) || invalidationMaxPaths < 1) {
    throw new Error(`Invalidation max paths must be a positive integer. Received: ${invalidationMaxPaths}`);
  }

  if (!artifactBucket) {
    throw new Error('Artifact bucket is required. Set EG_TSX_ARTIFACT_BUCKET or pass --artifact-bucket.');
  }

  if (!skipStack && !databasePassword) {
    throw new Error('Database password is required for stack deploys. Set EG_TSX_DATABASE_PASSWORD or pass --database-password.');
  }

  // Lambda environment variables — forwarded as CloudFormation parameters.
  // Sourced from .env.deploy via DEPLOY_* prefix in process.env.
  const lambdaEnv = {
    CognitoRegion: hydratedEnv.DEPLOY_COGNITO_REGION || '',
    CognitoUserPoolId: hydratedEnv.DEPLOY_COGNITO_USER_POOL_ID || '',
    CognitoAppClientId: hydratedEnv.DEPLOY_COGNITO_APP_CLIENT_ID || '',
    CognitoDomain: hydratedEnv.DEPLOY_COGNITO_DOMAIN || '',
    CognitoCallbackUrl: hydratedEnv.DEPLOY_COGNITO_CALLBACK_URL || '',
    CognitoLogoutUrl: hydratedEnv.DEPLOY_COGNITO_LOGOUT_URL || '',
    DynamoDbTableName: hydratedEnv.DEPLOY_DYNAMODB_TABLE_NAME || '',
  };

  return {
    artifactBucket,
    artifactPrefix,
    buildId,
    databasePassword,
    environment,
    invalidatePaths,
    invalidationMode,
    invalidationMaxPaths,
    lambdaEnv,
    projectName,
    region,
    skipBuild,
    skipInvalidate,
    skipStack,
    skipStatic,
    stackName,
    staticScope,
    syncMode,
    syncSearch,
    templatePath,
  };
}

export function buildArtifactKey({
  projectName,
  environment,
  artifactPrefix,
  buildId,
}) {
  return `${trimSlashes(artifactPrefix)}/${projectName}-${environment}-${buildId}.zip`;
}

export function buildCloudFormationParameterOverrides({
  projectName,
  environment,
  databasePassword,
  artifactBucket,
  artifactKey,
  lambdaEnv = {},
}) {
  const overrides = [
    `ProjectName=${projectName}`,
    `Environment=${environment}`,
    `DatabasePassword=${databasePassword}`,
    `LambdaCodeS3Bucket=${artifactBucket}`,
    `LambdaCodeS3Key=${artifactKey}`,
  ];

  for (const [paramName, value] of Object.entries(lambdaEnv)) {
    if (value) {
      overrides.push(`${paramName}=${value}`);
    }
  }

  return overrides;
}

export function shouldReadStackOutputs({
  skipStack,
  skipStatic,
  skipInvalidate,
}) {
  return !skipStack || !skipStatic || !skipInvalidate;
}

export function buildDeployStages({
  invalidationMode = 'smart',
  skipBuild,
  staticScope = 'site',
  skipStack,
  skipStatic,
  skipInvalidate,
  syncMode = 'quick',
  syncSearch,
}) {
  const stages = [];

  if (!skipBuild) {
    stages.push({ id: 'build', label: 'Running Astro Build' });
  }

  if (!skipStack) {
    stages.push({ id: 'stage-lambda', label: 'Packaging Lambda Artifact' });
    stages.push({ id: 'upload-lambda', label: 'Uploading Lambda Artifact' });
    stages.push({ id: 'deploy-stack', label: 'Deploying CloudFormation Stack' });
  }

  if (shouldReadStackOutputs({ skipStack, skipStatic, skipInvalidate })) {
    stages.push({ id: 'read-stack', label: 'Refreshing Stack Outputs' });
  }

  if (!skipStatic) {
    if (syncMode === 'quick' || (!skipInvalidate && invalidationMode === 'smart')) {
      stages.push({
        id: 'preview-static',
        label: isImageStaticScope(staticScope)
          ? 'Previewing Changed Images'
          : isDataStaticScope(staticScope)
            ? 'Previewing Changed Data Files'
            : 'Previewing Changed Site Files',
      });
    }

    stages.push({
      id: 'sync-static',
      label: syncMode === 'full'
        ? isImageStaticScope(staticScope)
          ? 'Uploading Full Image Set'
          : isDataStaticScope(staticScope)
            ? 'Uploading Full Data Set'
            : 'Uploading Full Static Site'
        : isImageStaticScope(staticScope)
          ? 'Syncing Changed Images'
          : isDataStaticScope(staticScope)
            ? 'Syncing Changed Data Files'
            : 'Syncing Changed Site Files',
    });
  }

  if (syncSearch) {
    stages.push({ id: 'sync-search', label: 'Syncing Search Index' });
  }

  if (!skipInvalidate) {
    stages.push({
      id: 'invalidate',
      label: invalidationMode === 'full'
        ? 'Invalidating CloudFront (Full)'
        : 'Invalidating CloudFront (Smart)',
    });
  }

  return stages;
}

export function rewriteWorkspaceReferences(source, workspaceRoot) {
  const workspaceRootWithSlash = ensureTrailingSeparator(workspaceRoot);
  const fileUrlRoot = pathToFileURL(workspaceRootWithSlash).href;
  const forwardRoot = workspaceRootWithSlash.replace(/\\/g, '/');
  const escapedWindowsRoot = workspaceRootWithSlash.replace(/\\/g, '\\\\');

  let rewritten = source.replaceAll(fileUrlRoot, 'file:///var/task/');
  rewritten = replacePathFamily(rewritten, forwardRoot, '/var/task/');
  rewritten = replacePathFamily(rewritten, escapedWindowsRoot, '/var/task/');

  return rewritten;
}

export function buildSpawnInvocation(command, args, platform = process.platform) {
  if (platform !== 'win32') {
    return {
      args,
      command,
    };
  }

  const normalized = command.toLowerCase();
  if (normalized === 'npm' || normalized === 'npx') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `${command}.cmd ${args.join(' ')}`],
    };
  }

  return {
    args,
    command,
  };
}

export function buildLambdaArtifactLayout() {
  return {
    copyDirectories: ['dist/server'],
    copyFiles: [
      'package.json',
      'package-lock.json',
      'lambda-entry.mjs',
    ],
  };
}

export function buildLambdaPackageProgressLine(percentage) {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
  return `[lambda] package ${normalized}%`;
}

export function buildLambdaStageProgressLine(stage, percentage, detail = '') {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
  return `[lambda] stage ${stage} ${normalized}%${detail ? ` ${detail}` : ''}`;
}

export function buildSiteStageProgressEvent(stage, percentage, detail = '') {
  const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
  return {
    detail,
    egTsxEvent: true,
    kind: 'site_stage_progress',
    progress: normalized,
    stage,
  };
}

export function parseAwsCliTransferProgressLine(line) {
  const match = line.match(/^Completed\s+([\d.]+)\s+(Bytes|KiB|MiB|GiB|TiB)\/([\d.]+)\s+(Bytes|KiB|MiB|GiB|TiB)\b/i);
  if (!match) {
    return null;
  }

  const completedBytes = convertSizeToBytes(Number(match[1]), match[2]);
  const totalBytes = convertSizeToBytes(Number(match[3]), match[4]);
  if (!Number.isFinite(completedBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) {
    return null;
  }

  return {
    completedBytes,
    totalBytes,
    percentage: Math.max(0, Math.min(100, Math.round((completedBytes / totalBytes) * 100))),
  };
}

export function summarizeStackResourceProgress(events) {
  const latestByLogicalId = new Map();

  for (const event of events) {
    const logicalId = event?.LogicalResourceId;
    const status = event?.ResourceStatus;
    if (!logicalId || !status || latestByLogicalId.has(logicalId)) {
      continue;
    }

    latestByLogicalId.set(logicalId, status);
  }

  const total = latestByLogicalId.size;
  if (total === 0) {
    return { completed: 0, percentage: 0, total: 0 };
  }

  const completed = [...latestByLogicalId.values()].filter(isTerminalStackResourceStatus).length;
  return {
    completed,
    percentage: Math.max(0, Math.min(100, Math.round((completed / total) * 100))),
    total,
  };
}

export async function zipDirectory({
  sourceDir,
  destinationPath,
  onProgress = () => {},
  createArchiver,
} = {}) {
  if (!sourceDir) {
    throw new Error('zipDirectory requires sourceDir.');
  }

  if (!destinationPath) {
    throw new Error('zipDirectory requires destinationPath.');
  }

  removeIfExists(destinationPath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  const archiverFactory = createArchiver || (await import('archiver')).default;

  return new Promise((resolve, reject) => {
    let settled = false;
    let lastPercentage = -1;
    const output = fs.createWriteStream(destinationPath);
    const archive = archiverFactory('zip', {
      zlib: { level: 9 },
    });

    const emitProgress = (value) => {
      const percentage = Math.max(0, Math.min(100, Math.round(value)));
      if (percentage === lastPercentage) {
        return;
      }

      lastPercentage = percentage;
      onProgress(percentage);
    };

    const rejectOnce = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      output.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    output.on('close', () => {
      if (settled) {
        return;
      }

      settled = true;
      emitProgress(100);
      resolve({
        destinationPath,
        bytesWritten: typeof archive.pointer === 'function' ? archive.pointer() : 0,
      });
    });
    output.on('error', rejectOnce);
    archive.on('error', rejectOnce);
    archive.on('warning', rejectOnce);
    archive.on('progress', (progressEvent) => {
      const totalBytes = progressEvent?.fs?.totalBytes ?? 0;
      const processedBytes = progressEvent?.fs?.processedBytes ?? 0;
      if (totalBytes <= 0) {
        return;
      }

      emitProgress((processedBytes / totalBytes) * 100);
    });

    emitProgress(0);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    Promise.resolve(archive.finalize()).catch(rejectOnce);
  });
}

export function collectRuntimePackagePaths({ lockfile }) {
  const packages = lockfile?.packages ?? {};

  return Object.entries(packages)
    .filter(([packagePath, metadata]) => {
      if (!packagePath.startsWith('node_modules/')) {
        return false;
      }

      return metadata?.dev !== true;
    })
    .map(([packagePath]) => packagePath)
    .sort();
}

export function buildStaticSyncArgs({
  bucketName,
  clientDir,
  dryRun,
  region,
  staticScope = 'site',
}) {
  const args = [
    's3',
    'sync',
    `${clientDir}${path.sep}`,
    `s3://${bucketName}/`,
    '--delete',
  ];

  if (dryRun) {
    args.push('--dryrun');
  }

  for (const pattern of getStaticScopeExcludes(staticScope)) {
    args.push('--exclude', pattern);
  }

  args.push('--region', region);

  return args;
}

export function buildStaticCopyArgs({
  destinationUri,
  region,
  sourceDir,
  staticScope = 'site',
}) {
  const args = [
    's3',
    'cp',
    `${sourceDir}${path.sep}`,
    destinationUri,
    '--recursive',
  ];

  for (const pattern of getStaticScopeExcludes(staticScope)) {
    args.push('--exclude', pattern);
  }

  args.push('--region', region);

  return args;
}

export function buildStaticMirrorDeleteArgs({
  destinationUri,
  region,
  staticScope = 'site',
}) {
  const args = [
    's3',
    'rm',
    destinationUri,
    '--recursive',
  ];

  if (isDataStaticScope(staticScope)) {
    args.push('--exclude', 'images/*');
  }

  args.push('--region', region);
  return args;
}

export function countListedS3Objects(output) {
  return `${output}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => S3_OBJECT_LIST_LINE_PATTERN.test(line))
    .length;
}

export function countLocalFilesWithProgress(targetPath, { onProgress = () => {}, reportEvery = 500 } = {}) {
  if (!fs.existsSync(targetPath)) {
    onProgress(0);
    return 0;
  }

  const normalizedReportEvery = Math.max(1, reportEvery);
  const pendingPaths = [targetPath];
  let count = 0;

  while (pendingPaths.length > 0) {
    const currentPath = pendingPaths.pop();
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        pendingPaths.push(entryPath);
        continue;
      }

      count += 1;
      if (count % normalizedReportEvery === 0) {
        onProgress(count);
      }
    }
  }

  if (count === 0 || count % normalizedReportEvery !== 0) {
    onProgress(count);
  }

  return count;
}

export async function countRemoteS3ObjectsWithProgress({
  destinationUri,
  region,
  awsEnv,
  onProgress = () => {},
  reportEvery = 500,
  streamListCommand = streamCommand,
}) {
  const normalizedReportEvery = Math.max(1, reportEvery);
  let count = 0;

  await streamListCommand(
    'aws',
    ['s3', 'ls', destinationUri, '--recursive', '--region', region],
    {
      env: awsEnv,
      onStdoutLine: (line) => {
        const normalizedLine = `${line}`.trim();
        if (!S3_OBJECT_LIST_LINE_PATTERN.test(normalizedLine)) {
          return;
        }

        count += 1;
        if (count % normalizedReportEvery === 0) {
          onProgress(count);
        }
      },
      onStderrLine: () => {},
    }
  );

  if (count === 0 || count % normalizedReportEvery !== 0) {
    onProgress(count);
  }

  return count;
}

export function resolveStaticSyncOperationTotal({
  localFileCount = 0,
  previewRows = [],
  remoteObjectCount = 0,
  syncMode = 'quick',
}) {
  if (syncMode === 'full') {
    return Math.max(1, localFileCount + remoteObjectCount);
  }

  if (previewRows.length > 0) {
    return previewRows.length;
  }

  return Math.max(1, localFileCount);
}

export function pruneStaticDeployArtifacts(clientDir) {
  let removedDirectories = 0;
  let removedFiles = 0;
  const pendingDirectories = [clientDir];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (STATIC_STASH_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
          fs.rmSync(entryPath, { recursive: true, force: true });
          removedDirectories += 1;
          continue;
        }

        pendingDirectories.push(entryPath);
        continue;
      }

      if (STATIC_JUNK_FILENAMES.has(entry.name)) {
        fs.rmSync(entryPath, { force: true });
        removedFiles += 1;
      }
    }
  }

  return {
    removedDirectories,
    removedFiles,
  };
}

function collectStaticDeployArtifactViolations(clientDir) {
  const violations = [];
  const pendingDirectories = [clientDir];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      const entryPath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(clientDir, entryPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (STATIC_STASH_DIRECTORY_NAMES.has(entry.name.toLowerCase())) {
          violations.push(relativePath);
          continue;
        }

        pendingDirectories.push(entryPath);
        continue;
      }

      if (!relativePath.toLowerCase().startsWith('images/')) {
        continue;
      }

      if (path.extname(entry.name).toLowerCase() !== '.html') {
        continue;
      }

      violations.push(relativePath);
    }
  }

  return violations.sort((left, right) => left.localeCompare(right));
}

export function assertStaticDeployArtifactsClean({ clientDir, staticScope = 'site' }) {
  if (!clientDir) {
    throw new Error('assertStaticDeployArtifactsClean requires clientDir.');
  }

  if (isDataStaticScope(staticScope)) {
    return;
  }

  const violations = collectStaticDeployArtifactViolations(clientDir);
  if (violations.length === 0) {
    return;
  }

  const details = violations.map((entry) => `- ${entry}`).join('\n');
  throw new Error(
    [
      `Static deploy artifact validation failed for ${getStaticScopeLabel(staticScope)} publish scope.`,
      'Local-only image stash artifacts must be removed before publish.',
      details,
    ].join('\n')
  );
}

function replacePathFamily(source, rootLiteral, runtimeRoot) {
  const pattern = new RegExp(`${escapeForRegExp(rootLiteral)}([^"'\\r\\n]*)`, 'g');

  return source.replace(pattern, (_, tail) => {
    const normalizedTail = tail.replace(/^[/\\]+/, '').replace(/\\\\/g, '/').replace(/\\/g, '/');
    return `${runtimeRoot}${normalizedTail}`;
  });
}

function createBuildId(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function trimSlashes(value) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function ensureTrailingSeparator(value) {
  if (value.endsWith(path.sep)) {
    return value;
  }

  return `${value}${path.sep}`;
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveFromRoot(relativePath) {
  return path.resolve(ROOT_DIR, relativePath);
}

function emitDeployEvent(event) {
  if (process.env.EG_TSX_EVENT_STREAM !== '1') {
    return;
  }

  console.log(JSON.stringify({
    egTsxEvent: true,
    ...event,
  }));
}

function emitSiteStageProgressSnapshot(stage, percentage, detail = '') {
  emitDeployEvent(buildSiteStageProgressEvent(stage, percentage, detail));
}

function createSiteStageProgressEmitter(stage) {
  let lastPercentage = -1;
  return (percentage, detail = '') => {
    const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
    if (normalized === lastPercentage) {
      return;
    }

    lastPercentage = normalized;
    emitDeployEvent(buildSiteStageProgressEvent(stage, normalized, detail));
  };
}

export function startProgressHeartbeat({
  cap,
  detail = '',
  emitProgress,
  intervalMs = 1500,
  start,
  step = 1,
}) {
  const normalizedStart = Math.max(0, Math.min(100, Math.round(start)));
  const normalizedCap = Math.max(normalizedStart, Math.min(100, Math.round(cap)));
  const normalizedStep = Math.max(1, Math.round(step));

  emitProgress(normalizedStart, detail);

  if (normalizedStart >= normalizedCap) {
    return {
      stop() {},
    };
  }

  let current = normalizedStart;
  let timer = setInterval(() => {
    current = Math.min(normalizedCap, current + normalizedStep);
    emitProgress(current, detail);
    if (current >= normalizedCap && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return {
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = null;
    },
  };
}

async function runStage(stage, callback) {
  emitDeployEvent({
    label: stage.label,
    stage: stage.id,
    status: 'started',
  });

  const result = await callback();

  emitDeployEvent({
    label: stage.label,
    stage: stage.id,
    status: 'completed',
  });

  return result;
}

export function resolveRunCommandStdio(options = {}, env = process.env) {
  if (options.captureOutput || env.EG_TSX_EVENT_STREAM === '1') {
    return ['ignore', 'pipe', 'pipe'];
  }

  return options.stdio || 'inherit';
}

export function resolveRunCommandWindowsHide(platform = process.platform) {
  if (platform === 'win32') {
    return true;
  }

  return undefined;
}

function runCommand(command, args, options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  console.log(`> ${invocation.command} ${invocation.args.join(' ')}`);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || ROOT_DIR,
    encoding: 'utf8',
    env: options.env || process.env,
    maxBuffer: options.maxBuffer || CAPTURE_OUTPUT_MAX_BUFFER_BYTES,
    stdio: resolveRunCommandStdio(options, options.env || process.env),
    windowsHide: resolveRunCommandWindowsHide(),
  });

  if ((options.captureOutput || (options.env || process.env).EG_TSX_EVENT_STREAM === '1') && options.echoOutput !== false) {
    const combined = [result.stdout, result.stderr].filter(Boolean).join('');
    if (combined) {
      process.stdout.write(combined);
    }
  }

  if (result.error) {
    throw new Error(`${invocation.command} ${invocation.args.join(' ')} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    const reason = result.signal
      ? `terminated by signal ${result.signal}`
      : result.status === null
        ? 'ended without an exit code'
        : `exited with code ${result.status}`;
    throw new Error(details || `${invocation.command} ${invocation.args.join(' ')} ${reason}.`);
  }

  return result;
}

function buildStaticTransferTarget({ bucketName, staticScope }) {
  if (isImageStaticScope(staticScope)) {
    return {
      bucketSyncName: `${bucketName}/images`,
      destinationUri: `s3://${bucketName}/images/`,
      label: 'images',
      sourceDir: resolveFromRoot('dist/client/images'),
    };
  }

  return {
    bucketSyncName: bucketName,
    destinationUri: `s3://${bucketName}/`,
    label: 'site',
    sourceDir: resolveFromRoot('dist/client'),
  };
}

export function summarizeS3TransferOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (summary, line) => {
        if (line.startsWith('(dryrun) upload:') || line.startsWith('upload:')) {
          summary.uploads += 1;
        } else if (line.startsWith('(dryrun) delete:') || line.startsWith('delete:')) {
          summary.deletes += 1;
        } else if (line.startsWith('copy:')) {
          summary.copies += 1;
        } else if (line.toLowerCase().startsWith('warning:')) {
          summary.warnings += 1;
        }

        return summary;
      },
      {
        copies: 0,
        deletes: 0,
        uploads: 0,
        warnings: 0,
      }
    );
}

export function summarizeCloudFrontInvalidationPayload(payload) {
  const invalidation = payload?.Invalidation ?? {};
  const id = invalidation.Id ?? 'unknown';
  const status = invalidation.Status ?? 'unknown';
  const pathCount = invalidation?.InvalidationBatch?.Paths?.Items?.length ?? 0;
  return `[cdn] invalidation ${id} ${status} for ${pathCount} paths`;
}

export function formatStackOutputSummary(outputs) {
  const lines = [];

  if (outputs.StaticSiteBucketName) {
    lines.push(`[stack] static bucket ${outputs.StaticSiteBucketName}`);
  }
  if (outputs.CloudFrontDistributionId) {
    lines.push(`[stack] distribution ${outputs.CloudFrontDistributionId}`);
  }
  if (outputs.LambdaFunctionName) {
    lines.push(`[stack] lambda ${outputs.LambdaFunctionName}`);
  }

  return lines;
}

export function shouldPreviewStaticDiff({
  invalidatePaths = [],
  invalidationMode = 'smart',
  syncMode = 'quick',
  skipInvalidate,
  skipStatic,
}) {
  if (skipStatic) {
    return false;
  }

  if (syncMode === 'quick') {
    return true;
  }

  if (skipInvalidate || invalidatePaths.length > 0) {
    return false;
  }

  return invalidationMode === 'smart';
}

function logS3TransferSummary({ operationLabel, output }) {
  const summary = summarizeS3TransferOutput(output);
  console.log(
    `[static] ${operationLabel}: ${summary.uploads} uploads, ${summary.deletes} deletes, ${summary.copies} copies, ${summary.warnings} warnings`
  );
}

function ensureExists(targetPath, label) {
  if (fs.existsSync(targetPath)) {
    return;
  }

  throw new Error(`${label} not found: ${targetPath}`);
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
}

function convertSizeToBytes(value, unit) {
  const normalizedUnit = `${unit}`.toLowerCase();
  const factor = {
    bytes: 1,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  }[normalizedUnit];
  if (!factor || !Number.isFinite(value)) {
    return Number.NaN;
  }

  return value * factor;
}

function isTerminalStackResourceStatus(status) {
  return /_(COMPLETE|FAILED|SKIPPED)$/i.test(`${status}`);
}

function calculateProgressWithinRange({ start, end, completed, total }) {
  if (!Number.isFinite(total) || total <= 0) {
    return start;
  }

  const ratio = Math.max(0, Math.min(1, completed / total));
  return start + ((end - start) * ratio);
}

function createStageProgressReporter(stage) {
  let lastPercentage = -1;
  return (percentage, detail = '') => {
    const normalized = Math.max(0, Math.min(100, Math.round(percentage)));
    if (normalized === lastPercentage) {
      return;
    }

    lastPercentage = normalized;
    console.log(buildLambdaStageProgressLine(stage, normalized, detail));
  };
}

function createLineAccumulator(onLine) {
  let carry = '';
  return (chunk) => {
    const text = `${carry}${chunk.toString('utf8')}`;
    const parts = text.split(/\r?\n|\r/g);
    carry = parts.pop() ?? '';
    for (const part of parts.map((line) => line.trim()).filter(Boolean)) {
      onLine(part);
    }
  };
}

function extractBuiltHtmlPath(line) {
  const match = `${line}`.match(/(\/[^\s]+?\.html)\b/);
  return match ? match[1] : '';
}

export function parseAstroBuildProgressLine(line) {
  const lower = `${line}`.toLowerCase();
  if (lower.includes('enabling sessions with filesystem storage')) {
    return { detail: 'Initializing Astro node adapter', progress: 4 };
  }
  if (lower.includes('syncing content')) {
    return { detail: 'Syncing content', progress: 8 };
  }
  if (lower.includes('synced content')) {
    return { detail: 'Content synchronized', progress: 12 };
  }
  if (lower.includes('[types]') && lower.includes('generated')) {
    return { detail: 'Generated content types', progress: 16 };
  }
  if (lower.includes('output:')) {
    return { detail: 'Resolved static output target', progress: 20 };
  }
  if (lower.includes('mode:')) {
    return { detail: 'Confirmed server build mode', progress: 24 };
  }
  if (lower.includes('directory:')) {
    return { detail: 'Resolved dist directory', progress: 28 };
  }
  if (lower.includes('adapter:')) {
    return { detail: 'Confirmed Node adapter', progress: 32 };
  }
  if (lower.includes('collecting build info')) {
    return { detail: 'Collecting build info', progress: 36 };
  }
  if (lower.includes('building static entrypoints') || lower.includes('building server entrypoints')) {
    return { detail: 'Building entrypoints', progress: 42 };
  }
  if (lower.includes('building client (vite)')) {
    return { detail: 'Building client bundles', progress: 48 };
  }
  if (lower.includes('transforming...')) {
    return { detail: 'Transforming client modules', progress: 52 };
  }
  if (lower.includes('optimizing generated css')) {
    return { detail: 'Optimizing generated CSS', progress: 54 };
  }
  if (lower.includes('modules transformed')) {
    return { detail: 'Transforming client modules', progress: 56 };
  }
  if (lower.includes('[vite]') && lower.includes('built in')) {
    return { detail: 'Bundled entrypoints', progress: 60 };
  }
  if (lower.includes('generating static routes')) {
    return { detail: 'Generating static routes', progress: 72 };
  }
  return null;
}

async function streamCommand(command, args, options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  console.log(`> ${invocation.command} ${invocation.args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd || ROOT_DIR,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: resolveRunCommandWindowsHide(),
    });

    let stdout = '';
    let stderr = '';
    const handleStdout = createLineAccumulator((line) => {
      stdout += `${line}\n`;
      options.onStdoutLine?.(line);
    });
    const handleStderr = createLineAccumulator((line) => {
      stderr += `${line}\n`;
      options.onStderrLine?.(line);
    });

    child.stdout?.on('data', handleStdout);
    child.stderr?.on('data', handleStderr);
    child.on('error', (error) => reject(new Error(`${invocation.command} ${invocation.args.join(' ')} failed to start: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        const details = [stdout, stderr].filter(Boolean).join('\n').trim();
        reject(new Error(`${invocation.command} ${invocation.args.join(' ')} exited with code ${code}${details ? `\n${details}` : ''}`));
        return;
      }

      resolve({ stderr, stdout });
    });
  });
}

function listFilesRecursively(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const results = [];

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(entryPath));
      continue;
    }

    results.push(entryPath);
  }

  return results;
}

function getLastBuildAtMs(projectRoot) {
  const distDir = path.join(projectRoot, 'dist');
  const buildFiles = listFilesRecursively(distDir);

  if (buildFiles.length === 0) {
    return 0;
  }

  return Math.max(...buildFiles.map((filePath) => fs.statSync(filePath).mtimeMs));
}

function collectChangedSourcePaths(projectRoot) {
  const lastBuildAtMs = getLastBuildAtMs(projectRoot);
  const candidateRoots = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'public'),
    path.join(projectRoot, 'infrastructure', 'aws'),
  ];

  return [
    ...new Set(
      candidateRoots
        .flatMap((rootPath) => listFilesRecursively(rootPath))
        .filter((filePath) => fs.statSync(filePath).mtimeMs > lastBuildAtMs)
        .map((filePath) => path.relative(projectRoot, filePath).replace(/\\/g, '/'))
    ),
  ];
}

function findWorkspaceReferenceHits(targetPath, workspaceRoot) {
  const workspaceRootWithSlash = ensureTrailingSeparator(workspaceRoot);
  const fileUrlRoot = pathToFileURL(workspaceRootWithSlash).href;
  const forwardRoot = workspaceRootWithSlash.replace(/\\/g, '/');
  const escapedWindowsRoot = workspaceRootWithSlash.replace(/\\/g, '\\\\');

  return listFilesRecursively(targetPath)
    .filter((filePath) => filePath.endsWith('.mjs'))
    .filter((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return (
        source.includes(fileUrlRoot) ||
        source.includes(forwardRoot) ||
        source.includes(escapedWindowsRoot)
      );
    });
}

function rewriteServerBundle(serverDir, workspaceRoot) {
  for (const filePath of listFilesRecursively(serverDir)) {
    if (!filePath.endsWith('.mjs')) {
      continue;
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const rewritten = rewriteWorkspaceReferences(source, workspaceRoot);
    fs.writeFileSync(filePath, rewritten, 'utf8');
  }
}

function stageRuntimeNodeModules({ sourceRoot, targetRoot, lockfile, onProgress }) {
  const runtimePackagePaths = collectRuntimePackagePaths({ lockfile });
  const sourceNodeModules = path.join(sourceRoot, 'node_modules');
  const targetNodeModules = path.join(targetRoot, 'node_modules');

  ensureExists(sourceNodeModules, 'Root node_modules');
  fs.mkdirSync(targetNodeModules, { recursive: true });

  console.log(`[lambda] copying ${runtimePackagePaths.length} runtime packages`);

  runtimePackagePaths.forEach((relativePackagePath, index) => {
    const sourcePath = path.join(sourceRoot, relativePackagePath);
    if (!fs.existsSync(sourcePath)) {
      onProgress?.(index + 1, runtimePackagePaths.length);
      return;
    }

    const targetPath = path.join(targetRoot, relativePackagePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    onProgress?.(index + 1, runtimePackagePaths.length);
  });
}

function stageLambdaArtifact(onProgress) {
  const distDir = resolveFromRoot('dist');
  const layout = buildLambdaArtifactLayout();
  const packageLockPath = resolveFromRoot('package-lock.json');
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  const runtimePackagePaths = collectRuntimePackagePaths({ lockfile: packageLock });
  const prepareUnitsTotal = layout.copyDirectories.length + layout.copyFiles.length + runtimePackagePaths.length;
  let prepareUnitsCompleted = 0;
  const reportPrepareProgress = (detail) => {
    onProgress?.(
      calculateProgressWithinRange({
        start: 0,
        end: 70,
        completed: prepareUnitsCompleted,
        total: prepareUnitsTotal,
      }),
      detail
    );
  };

  ensureExists(packageLockPath, 'package-lock.json');
  ensureExists(distDir, 'dist');

  removeIfExists(STAGING_DIR);
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  reportPrepareProgress('Preparing runtime bundle');

  for (const relativeDirectory of layout.copyDirectories) {
    const sourceDirectory = resolveFromRoot(relativeDirectory);
    const targetDirectory = path.join(STAGING_DIR, relativeDirectory);
    ensureExists(sourceDirectory, `${relativeDirectory} build output`);
    fs.mkdirSync(path.dirname(targetDirectory), { recursive: true });
    fs.cpSync(sourceDirectory, targetDirectory, { recursive: true });
    prepareUnitsCompleted += 1;
    reportPrepareProgress(`Copied ${relativeDirectory}`);
  }

  for (const relativeFile of layout.copyFiles) {
    const sourceFile = resolveFromRoot(relativeFile);
    const targetFile = path.join(STAGING_DIR, relativeFile);
    ensureExists(sourceFile, relativeFile);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.copyFileSync(sourceFile, targetFile);
    prepareUnitsCompleted += 1;
    reportPrepareProgress(`Copied ${relativeFile}`);
  }

  stageRuntimeNodeModules({
    lockfile: packageLock,
    sourceRoot: ROOT_DIR,
    targetRoot: STAGING_DIR,
    onProgress: (completed, total) => {
      prepareUnitsCompleted = layout.copyDirectories.length + layout.copyFiles.length + completed;
      reportPrepareProgress(`Copied runtime packages ${completed}/${total}`);
    },
  });
  rewriteServerBundle(path.join(STAGING_DIR, 'dist', 'server'), ROOT_DIR);
  onProgress?.(70, 'Runtime bundle prepared');

  const hits = findWorkspaceReferenceHits(path.join(STAGING_DIR, 'dist', 'server'), ROOT_DIR);
  if (hits.length > 0) {
    throw new Error(`Portable Lambda bundle rewrite left local path references in:\n${hits.join('\n')}`);
  }
}

async function zipLambdaArtifact(zipPath, onProgress) {
  await zipDirectory({
    sourceDir: STAGING_DIR,
    destinationPath: zipPath,
    onProgress: (percentage) => onProgress(
      calculateProgressWithinRange({
        start: 70,
        end: 100,
        completed: percentage,
        total: 100,
      }),
      `Compressing artifact ${Math.round(percentage)}%`
    ),
  });
  ensureExists(zipPath, 'Lambda artifact zip');
}

function ensureArtifactBucket(bucketName, region, awsEnv) {
  try {
    runCommand('aws', ['s3api', 'head-bucket', '--bucket', bucketName], { captureOutput: true, echoOutput: false, env: awsEnv });
    return;
  } catch {
    const createArgs = ['s3api', 'create-bucket', '--bucket', bucketName, '--region', region];
    if (region !== 'us-east-1') {
      createArgs.push('--create-bucket-configuration', `LocationConstraint=${region}`);
    }

    runCommand('aws', createArgs, { env: awsEnv });
  }
}

async function uploadLambdaArtifact(zipPath, bucketName, artifactKey, region, awsEnv) {
  const emitProgress = createStageProgressReporter('lambda-upload');
  emitProgress(0, 'Preparing upload');
  await streamCommand(
    'aws',
    ['s3', 'cp', zipPath, `s3://${bucketName}/${artifactKey}`, '--region', region],
    {
      env: awsEnv,
      onStdoutLine: (line) => console.log(line),
      onStderrLine: (line) => {
        const progress = parseAwsCliTransferProgressLine(line);
        if (progress) {
          emitProgress(progress.percentage, `Uploaded ${progress.percentage}%`);
          return;
        }

        console.log(line);
      },
    }
  );
  emitProgress(100, 'Upload complete');
  console.log(`[lambda] uploaded artifact s3://${bucketName}/${artifactKey}`);
}

async function previewStaticSync({ bucketName, region, staticScope, awsEnv }) {
  const target = buildStaticTransferTarget({ bucketName, staticScope });
  const emitProgress = createSiteStageProgressEmitter('sync');
  ensureExists(target.sourceDir, isImageStaticScope(staticScope) ? 'Generated image build output' : 'Client build output');
  const pruneRoot = isImageStaticScope(staticScope) ? resolveFromRoot('dist/client') : target.sourceDir;
  const pruneResult = pruneStaticDeployArtifacts(pruneRoot);
  assertStaticDeployArtifactsClean({ clientDir: pruneRoot, staticScope });
  const shouldEmitDetailedScanProgress = process.env.EG_TSX_EVENT_STREAM === '1';
  if (shouldEmitDetailedScanProgress) {
    emitSiteStageProgressSnapshot('sync', 0, 'Scanning local files 0');
  }
  const localFileCount = shouldEmitDetailedScanProgress
    ? countLocalFilesWithProgress(target.sourceDir, {
      onProgress: (count) => emitSiteStageProgressSnapshot(
        'sync',
        0,
        `Scanning local files ${count.toLocaleString()}`
      ),
      reportEvery: 500,
    })
    : listFilesRecursively(target.sourceDir).length;
  emitProgress(4, `Scanned ${localFileCount.toLocaleString()} local file${localFileCount === 1 ? '' : 's'}`);
  if (pruneResult.removedDirectories > 0 || pruneResult.removedFiles > 0) {
    console.log(`[static] pruned ${pruneResult.removedDirectories} stash directories and ${pruneResult.removedFiles} junk files from dist/client`);
  }

  let remoteObjectCount = 0;
  if (shouldEmitDetailedScanProgress) {
    emitSiteStageProgressSnapshot('sync', 6, 'Scanning S3 mirror 0 objects');
    remoteObjectCount = await countRemoteS3ObjectsWithProgress({
      awsEnv,
      destinationUri: target.destinationUri,
      onProgress: (count) => emitSiteStageProgressSnapshot(
        'sync',
        6,
        `Scanning S3 mirror ${count.toLocaleString()} object${count === 1 ? '' : 's'}`
      ),
      region,
      reportEvery: 500,
    });
    emitProgress(12, `Scanned ${remoteObjectCount.toLocaleString()} S3 object${remoteObjectCount === 1 ? '' : 's'}`);
  } else {
    emitProgress(12, 'Preparing S3 diff preview');
  }

  const heartbeat = startProgressHeartbeat({
    cap: 23,
    detail: 'Comparing local files against S3 mirror',
    emitProgress,
    start: shouldEmitDetailedScanProgress ? 14 : 14,
  });
  const result = await streamCommand(
    'aws',
    buildStaticSyncArgs({
      bucketName: target.bucketSyncName,
      clientDir: target.sourceDir,
      dryRun: true,
      region,
      staticScope,
    }),
    {
      env: awsEnv,
      onStdoutLine: () => heartbeat.stop(),
      onStderrLine: () => heartbeat.stop(),
    }
  );
  heartbeat.stop();
  const previewOutput = `${result.stdout}${result.stderr}`;
  const previewRows = parseDryRunRows(previewOutput);
  logS3TransferSummary({
    operationLabel: `quick ${getStaticScopeLabel(staticScope)} preview`,
    output: previewOutput,
  });
  emitProgress(
    24,
    `S3 diff preview complete (${previewRows.length} change${previewRows.length === 1 ? '' : 's'})`
  );

  return previewOutput;
}

export function parseDryRunRows(output, { existingRemoteKeys = null } = {}) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const uploadMatch = line.match(/^\(dryrun\)\s+upload:\s+.+?\s+to\s+s3:\/\/.+?\/(.+)$/);
      if (uploadMatch) {
        const path = uploadMatch[1];
        const status = existingRemoteKeys
          ? existingRemoteKeys.has(path) ? 'modified' : 'new'
          : 'modified';
        return [{ path, status }];
      }

      const deleteMatch = line.match(/^\(dryrun\)\s+delete:\s+s3:\/\/.+?\/(.+)$/);
      if (deleteMatch) {
        return [{ path: deleteMatch[1], status: 'deleted' }];
      }

      return [];
    });
}

export function buildRequestedInvalidationPlan({
  changedSourcePaths,
  invalidatePaths,
  invalidationMode,
  invalidationMaxPaths,
  s3DiffRows = [],
  s3DryRunOutput = '',
  staticScope = 'site',
  syncMode = 'quick',
}) {
  const previewRows = s3DiffRows.length > 0 ? s3DiffRows : parseDryRunRows(s3DryRunOutput);

  if (invalidationMode === 'full') {
    if (staticScope === 'images') {
      return {
        changedCount: 1,
        mode: 'full',
        paths: ['/images/*'],
        reason: 'Operator requested a full CloudFront invalidation.',
      };
    }

    return {
      changedCount: SITE_FULL_INVALIDATION_PATHS.length,
      mode: 'full',
      paths: SITE_FULL_INVALIDATION_PATHS,
      reason: 'Operator requested a full CloudFront invalidation.',
    };
  }

  if (invalidatePaths.length > 0) {
    return {
      changedCount: invalidatePaths.length,
      mode: 'manual',
      paths: invalidatePaths,
      reason: 'Using operator-specified CloudFront invalidation paths.',
    };
  }

  if (staticScope === 'images') {
    return buildImageCdnInvalidationPlan({
      maxPaths: invalidationMaxPaths,
      s3DiffRows: previewRows,
    });
  }

  return buildCdnInvalidationPlan({
    changedSourcePaths,
    maxPaths: invalidationMaxPaths,
    s3DiffRows: previewRows,
  });
}

export function splitCloudFrontInvalidationGroups(paths, { maxPaths = 1000, maxWildcards = 15 } = {}) {
  const groups = [];
  let current = [];
  let wildcardCount = 0;

  for (const pathValue of paths) {
    const isWildcard = pathValue.includes('*');
    if (current.length > 0 && (current.length >= maxPaths || (isWildcard && wildcardCount >= maxWildcards))) {
      groups.push(current);
      current = [];
      wildcardCount = 0;
    }

    current.push(pathValue);
    if (isWildcard) {
      wildcardCount += 1;
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

async function createCloudFrontInvalidation(distributionId, region, paths, awsEnv, groupIndex, groupCount) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      return JSON.parse(
        runCommand('aws', [
          'cloudfront',
          'create-invalidation',
          '--distribution-id',
          distributionId,
          '--paths',
          ...paths,
          '--region',
          region,
          '--output',
          'json',
        ], { captureOutput: true, echoOutput: false, env: awsEnv }).stdout
      );
    } catch (error) {
      if (!String(error?.message || error).includes('TooManyInvalidationsInProgress') || attempt === 60) {
        throw error;
      }

      const delayMs = Math.min(attempt * 10_000, 300_000);
      console.log(`[cdn] group ${groupIndex}/${groupCount} throttled, retrying in ${Math.round(delayMs / 1000)}s`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('CloudFront invalidation did not complete after retrying.');
}

function isCloudFrontGetInvalidationPermissionError(error) {
  const message = String(error?.message || error);
  return (
    message.includes('GetInvalidation') &&
    /AccessDenied|not authorized|not authorised|not allowed|cloudfront:GetInvalidation/i.test(message)
  );
}

function listStackEvents(options, awsEnv) {
  const result = runCommand(
    'aws',
    [
      'cloudformation',
      'describe-stack-events',
      '--stack-name',
      options.stackName,
      '--region',
      options.region,
      '--output',
      'json',
    ],
    { captureOutput: true, echoOutput: false, env: awsEnv }
  );

  return JSON.parse(result.stdout).StackEvents ?? [];
}

function extractRecentStackEvents(events, startedAtMs) {
  return events.filter((event) => {
    const timestamp = Date.parse(event?.Timestamp ?? '');
    return Number.isFinite(timestamp) && timestamp >= startedAtMs - 1000;
  });
}

async function deployStack(options, artifactKey, executionRoleArn, awsEnv) {
  const templatePath = resolveFromRoot(options.templatePath);
  ensureExists(templatePath, 'CloudFormation template');

  const parameterOverrides = buildCloudFormationParameterOverrides({
    artifactBucket: options.artifactBucket,
    artifactKey,
    databasePassword: options.databasePassword,
    environment: options.environment,
    projectName: options.projectName,
    lambdaEnv: options.lambdaEnv,
  });
  const emitProgress = createStageProgressReporter('lambda-deploy');
  const startedAtMs = Date.now();
  const seenEventIds = new Set();
  emitProgress(0, 'Submitting CloudFormation update');

  const deployPromise = streamCommand(
    'aws',
    buildCloudFormationDeployArgs({
      executionRoleArn,
      parameterOverrides,
      region: options.region,
      stackName: options.stackName,
      templatePath,
    }),
    {
      env: awsEnv,
      onStdoutLine: (line) => console.log(line),
      onStderrLine: (line) => console.log(line),
    }
  );

  let finished = false;
  deployPromise.then(
    () => { finished = true; },
    () => { finished = true; }
  );

  while (!finished) {
    try {
      const recentEvents = extractRecentStackEvents(listStackEvents(options, awsEnv), startedAtMs);
      const orderedEvents = [...recentEvents].reverse();
      for (const event of orderedEvents) {
        if (!event.EventId || seenEventIds.has(event.EventId)) {
          continue;
        }

        seenEventIds.add(event.EventId);
        console.log(`[stack] ${event.LogicalResourceId} ${event.ResourceStatus}`);
      }

      const progress = summarizeStackResourceProgress(recentEvents);
      if (progress.total > 0) {
        emitProgress(Math.min(progress.percentage, 95), `Resources ${progress.completed}/${progress.total}`);
      }
    } catch {
      // Ignore polling failures while the stack update command is running.
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  await deployPromise;
  emitProgress(100, 'Stack update complete');
}

function describeStackOutputs(options, awsEnv) {
  const result = runCommand(
    'aws',
    [
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      options.stackName,
      '--region',
      options.region,
      '--output',
      'json',
    ],
    { captureOutput: true, echoOutput: false, env: awsEnv }
  );

  const payload = JSON.parse(result.stdout);
  const outputs = payload.Stacks?.[0]?.Outputs ?? [];

  return Object.fromEntries(outputs.map((item) => [item.OutputKey, item.OutputValue]));
}

function logStackOutputsWithProgress(outputs) {
  const lines = formatStackOutputSummary(outputs);
  const emitProgress = createStageProgressReporter('lambda-live');
  const emitSiteSyncProgress = createSiteStageProgressEmitter('sync');
  if (lines.length === 0) {
    emitProgress(100, 'No stack outputs reported');
    emitSiteSyncProgress(10, 'No stack outputs reported');
    return;
  }

  lines.forEach((line, index) => {
    console.log(line);
    const detail = `Read ${index + 1}/${lines.length} stack outputs`;
    emitProgress(
      calculateProgressWithinRange({
        start: 0,
        end: 100,
        completed: index + 1,
        total: lines.length,
      }),
      `Read ${index + 1}/${lines.length} output values`
    );
    emitSiteSyncProgress(
      calculateProgressWithinRange({
        start: 4,
        end: 12,
        completed: index + 1,
        total: lines.length,
      }),
      detail
    );
  });
}

async function syncStaticTarget({ bucketName, region, staticScope, syncMode, awsEnv, s3PreviewRows = [] }) {
  const target = buildStaticTransferTarget({ bucketName, staticScope });
  const emitProgress = createSiteStageProgressEmitter('sync');
  ensureExists(
    target.sourceDir,
    isImageStaticScope(staticScope) ? 'Generated image build output' : 'Client build output'
  );

  const pruneRoot = isImageStaticScope(staticScope) ? resolveFromRoot('dist/client') : target.sourceDir;
  pruneStaticDeployArtifacts(pruneRoot);
  assertStaticDeployArtifactsClean({ clientDir: pruneRoot, staticScope });
  const shouldEmitDetailedScanProgress = process.env.EG_TSX_EVENT_STREAM === '1';
  if (syncMode === 'full' && shouldEmitDetailedScanProgress) {
    emitSiteStageProgressSnapshot('sync', 0, 'Scanning local files 0');
  }
  const localFileCount = syncMode === 'full' && shouldEmitDetailedScanProgress
    ? countLocalFilesWithProgress(target.sourceDir, {
      onProgress: (count) => emitSiteStageProgressSnapshot(
        'sync',
        0,
        `Scanning local files ${count.toLocaleString()}`
      ),
      reportEvery: 500,
    })
    : listFilesRecursively(target.sourceDir).length;
  let observedTransfers = 0;
  const trackLineProgress = (line, detailPrefix, totalOperations) => {
    if (line.startsWith('upload:') || line.startsWith('delete:') || line.startsWith('copy:')) {
      observedTransfers += 1;
      emitProgress(
        calculateProgressWithinRange({
          start: 25,
          end: 100,
          completed: Math.min(observedTransfers, totalOperations),
          total: totalOperations,
        }),
        `${detailPrefix} ${Math.min(observedTransfers, totalOperations)}/${totalOperations}`
      );
      return;
    }

    const progress = parseAwsCliTransferProgressLine(line);
    if (progress) {
      const fractionalTransfers = Math.min(
        totalOperations,
        observedTransfers + Math.max(0, Math.min(1, progress.percentage / 100))
      );
      emitProgress(
        calculateProgressWithinRange({
          start: 25,
          end: 100,
          completed: fractionalTransfers,
          total: totalOperations,
        }),
        `${detailPrefix} ${Math.min(totalOperations, observedTransfers + 1)}/${totalOperations}`
      );
    }
  };

  if (syncMode === 'quick') {
    const totalOperations = resolveStaticSyncOperationTotal({
      localFileCount,
      previewRows: s3PreviewRows,
      syncMode,
    });
    emitProgress(25, 'Preparing S3 sync');
    emitProgress(
      28,
      s3PreviewRows.length > 0
        ? `Prepared ${s3PreviewRows.length} object change${s3PreviewRows.length === 1 ? '' : 's'} for quick sync`
        : `Scanning ${localFileCount} local file${localFileCount === 1 ? '' : 's'} for quick sync`
    );
    const heartbeat = startProgressHeartbeat({
      cap: 36,
      detail: 'Reconciling local files against S3 mirror',
      emitProgress,
      start: 30,
      step: 2,
    });
    const result = await streamCommand(
      'aws',
      buildStaticSyncArgs({
        bucketName: target.bucketSyncName,
        clientDir: target.sourceDir,
        dryRun: false,
        region,
        staticScope,
      }),
      {
        env: awsEnv,
        onStdoutLine: (line) => {
          heartbeat.stop();
          console.log(line);
          trackLineProgress(line, 'Syncing files', totalOperations);
        },
        onStderrLine: (line) => {
          heartbeat.stop();
          console.log(line);
          trackLineProgress(line, 'Syncing files', totalOperations);
        },
      }
    );
    heartbeat.stop();
    const output = `${result.stdout}${result.stderr}`;

    logS3TransferSummary({
      operationLabel: `quick ${getStaticScopeLabel(staticScope)} sync`,
      output,
    });
    emitProgress(100, 'S3 sync complete');
    return;
  }

  emitProgress(4, `Scanned ${localFileCount.toLocaleString()} local file${localFileCount === 1 ? '' : 's'}`);
  let remoteObjectCount;
  if (shouldEmitDetailedScanProgress) {
    emitSiteStageProgressSnapshot('sync', 10, 'Scanning S3 mirror 0 objects');
    remoteObjectCount = await countRemoteS3ObjectsWithProgress({
      awsEnv,
      destinationUri: target.destinationUri,
      onProgress: (count) => emitSiteStageProgressSnapshot(
        'sync',
        10,
        `Scanning S3 mirror ${count.toLocaleString()} object${count === 1 ? '' : 's'}`
      ),
      region,
      reportEvery: 500,
    });
  } else {
    emitProgress(12, 'Listing existing S3 objects');
    const listHeartbeat = startProgressHeartbeat({
      cap: 18,
      detail: 'Listing existing S3 objects',
      emitProgress,
      start: 13,
    });
    const remoteListResult = await streamCommand(
      'aws',
      ['s3', 'ls', target.destinationUri, '--recursive', '--region', region],
      {
        env: awsEnv,
        onStdoutLine: () => listHeartbeat.stop(),
        onStderrLine: () => listHeartbeat.stop(),
      }
    );
    listHeartbeat.stop();
    remoteObjectCount = countListedS3Objects(remoteListResult.stdout);
  }
  const totalOperations = resolveStaticSyncOperationTotal({
    localFileCount,
    remoteObjectCount,
    syncMode,
  });

  emitProgress(
    20,
    `Indexed ${remoteObjectCount} remote object${remoteObjectCount === 1 ? '' : 's'} for mirror cleanup`
  );
  emitProgress(25, 'Starting mirror wipe');
  observedTransfers = 0;
  const cleanupHeartbeat = startProgressHeartbeat({
    cap: 30,
    detail: 'Preparing mirror wipe',
    emitProgress,
    start: 26,
    step: 2,
  });
  const cleanupResult = await streamCommand(
    'aws',
    buildStaticMirrorDeleteArgs({
      destinationUri: target.destinationUri,
      region,
      staticScope,
    }),
    {
      env: awsEnv,
      onStdoutLine: (line) => {
        cleanupHeartbeat.stop();
        console.log(line);
        trackLineProgress(line, 'Cleaning S3 mirror', totalOperations);
      },
      onStderrLine: (line) => {
        cleanupHeartbeat.stop();
        console.log(line);
        trackLineProgress(line, 'Cleaning S3 mirror', totalOperations);
      },
    }
  );
  cleanupHeartbeat.stop();

  emitProgress(
    calculateProgressWithinRange({
      start: 25,
      end: 100,
      completed: remoteObjectCount,
      total: totalOperations,
    }),
    remoteObjectCount > 0
      ? `Mirror wipe complete ${Math.min(remoteObjectCount, totalOperations)}/${totalOperations}`
      : 'Mirror wipe complete'
  );
  const copyResult = await streamCommand(
    'aws',
    buildStaticCopyArgs({
      destinationUri: target.destinationUri,
      region,
      sourceDir: target.sourceDir,
      staticScope,
    }),
    {
      env: awsEnv,
      onStdoutLine: (line) => {
        console.log(line);
        trackLineProgress(line, 'Uploading static files', totalOperations);
      },
      onStderrLine: (line) => {
        console.log(line);
        trackLineProgress(line, 'Uploading static files', totalOperations);
      },
    }
  );
  const cleanupOutput = `${cleanupResult.stdout}${cleanupResult.stderr}`;
  const copyOutput = `${copyResult.stdout}${copyResult.stderr}`;

  logS3TransferSummary({
    operationLabel: `full ${getStaticScopeLabel(staticScope)} cleanup`,
    output: cleanupOutput,
  });
  logS3TransferSummary({
    operationLabel: `full ${getStaticScopeLabel(staticScope)} upload`,
    output: copyOutput,
  });
  emitProgress(100, 'S3 sync complete');
}

async function runBuildWithFallback(awsEnv) {
  const buildCommand = ['run', 'build'];
  const astroCliPath = path.join(ROOT_DIR, 'node_modules', 'astro', 'dist', 'cli', 'index.js');
  const emitProgress = createSiteStageProgressEmitter('build');
  const attempts = [
    {
      label: 'standard build',
      env: awsEnv,
      maxOldSpace: null,
      runner: 'npm',
      args: buildCommand,
    },
    {
      label: '4GB build',
      env: {
        ...awsEnv,
        NODE_OPTIONS: `${awsEnv.NODE_OPTIONS ? `${awsEnv.NODE_OPTIONS} ` : ''}--max-old-space-size=4096`,
      },
      maxOldSpace: 4096,
      runner: 'npm',
      args: buildCommand,
    },
    {
      label: '12GB build',
      env: {
        ...awsEnv,
        NODE_OPTIONS: `${awsEnv.NODE_OPTIONS ? `${awsEnv.NODE_OPTIONS} ` : ''}--max-old-space-size=12288`,
      },
      maxOldSpace: 12288,
      runner: 'npm',
      args: buildCommand,
    },
    {
      label: 'direct astro cli',
      env: {
        ...awsEnv,
        NODE_OPTIONS: `${awsEnv.NODE_OPTIONS ? `${awsEnv.NODE_OPTIONS} ` : ''}--max-old-space-size=16384`,
      },
      maxOldSpace: 16384,
      runner: 'node',
      args: [astroCliPath, 'build'],
    },
  ];

  emitProgress(0, 'Preparing Astro build');
  let lastError;
  for (const attempt of attempts) {
    if (attempt.maxOldSpace) {
      console.log(`[build] trying with --max-old-space-size=${attempt.maxOldSpace}`);
    }
    try {
      console.log(`[build] ${attempt.label}`);
      const handleBuildLine = (line) => {
        console.log(line);
        const progressEvent = parseAstroBuildProgressLine(line);
        if (progressEvent) {
          emitProgress(progressEvent.progress, progressEvent.detail);
        }

        const builtPath = extractBuiltHtmlPath(line);
        if (!builtPath) {
          return;
        }
        console.log(`[build] page ${builtPath}`);
      };
      await streamCommand(attempt.runner, attempt.args, {
        cwd: ROOT_DIR,
        env: attempt.env,
        onStdoutLine: handleBuildLine,
        onStderrLine: handleBuildLine,
      });
      emitProgress(100, 'Astro build complete');
      return;
    } catch (error) {
      lastError = error;
      if (
        `${error.message || ''}`.includes('terminated by signal')
        || `${error.message || ''}`.includes('exited with code null')
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Build failed after retry. Last error: ${String(lastError && (lastError.message || lastError) )}`
  );
}

export async function invalidateCloudFront(distributionId, region, paths, awsEnv) {
  const emitProgress = createSiteStageProgressEmitter('cdn');
  if (paths.length === 0) {
    console.log('> cloudfront invalidation skipped (no CDN-facing changes detected)');
    emitProgress(100, 'No invalidation needed');
    return;
  }

  const groups = splitCloudFrontInvalidationGroups(paths);
  console.log(`[cdn] submitting ${paths.length} path(s) across ${groups.length} invalidation group(s)`);
  emitProgress(0, `Submitting ${groups.length} invalidation group(s)`);

  for (const [index, group] of groups.entries()) {
    const groupIndex = index + 1;
    console.log(`[cdn] group ${groupIndex}/${groups.length} invalidating ${group.join(', ')}`);
    emitProgress(
      Math.round(((groupIndex - 1) / groups.length) * 40),
      `Submitting group ${groupIndex}/${groups.length}`
    );

    const payload = await createCloudFrontInvalidation(
      distributionId,
      region,
      group,
      awsEnv,
      groupIndex,
      groups.length
    );
    const invalidationId = payload?.Invalidation?.Id || '';
    console.log(summarizeCloudFrontInvalidationPayload(payload));
    if (!invalidationId) {
      continue;
    }

    let pollingProgress = Math.round(((groupIndex - 1) / groups.length) * 40) + 20;
    while (true) {
      try {
        const pollResult = runCommand('aws', [
          'cloudfront',
          'get-invalidation',
          '--distribution-id',
          distributionId,
          '--id',
          invalidationId,
          '--output',
          'json',
        ], { captureOutput: true, echoOutput: false, env: awsEnv });
        const pollPayload = JSON.parse(pollResult.stdout);
        const status = pollPayload?.Invalidation?.Status || 'Unknown';
        console.log(`[cdn] invalidation ${invalidationId} status ${status}`);
        if (`${status}`.toLowerCase() === 'completed') {
          emitProgress(
            Math.round((groupIndex / groups.length) * 100),
            `Completed group ${groupIndex}/${groups.length}`
          );
          break;
        }

        pollingProgress = Math.min(pollingProgress + 10, Math.round((groupIndex / groups.length) * 100) - 1);
        emitProgress(pollingProgress, `CloudFront invalidation ${String(status).toLowerCase()}`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        if (!isCloudFrontGetInvalidationPermissionError(error)) {
          throw error;
        }

        console.log(`[cdn] invalidation ${invalidationId} status Unverified`);
        emitProgress(
          Math.round((groupIndex / groups.length) * 100),
          `GetInvalidation permission unavailable for group ${groupIndex}/${groups.length}`
        );
        break;
      }
    }
  }

  emitProgress(100, 'CloudFront invalidation complete');
}

function tryDescribeStackOutputs(options, awsEnv) {
  try {
    return describeStackOutputs(options, awsEnv);
  } catch {
    return {};
  }
}

function assumeOperatorRole(roleArn, region, awsEnv) {
  const result = runCommand(
    'aws',
    [
      'sts',
      'assume-role',
      '--role-arn',
      roleArn,
      '--role-session-name',
      'eg-tsx-god-view',
      '--region',
      region,
      '--output',
      'json',
    ],
    { captureOutput: true, echoOutput: false, env: awsEnv }
  );

  const credentials = parseAssumeRoleCredentials(JSON.parse(result.stdout));
  if (!credentials) {
    throw new Error(`Unable to parse assume-role credentials for ${roleArn}.`);
  }

  return buildAssumeRoleEnv({ baseEnv: awsEnv, credentials, roleArn });
}

function syncSearchIndex(awsEnv) {
  runCommand('node', ['scripts/sync-db.mjs', '--full'], { env: awsEnv });
}

async function main() {
  const options = parseDeployOptions(process.argv.slice(2));
  const artifactKey = buildArtifactKey(options);
  const zipPath = path.join(BUILD_DIR, `${options.projectName}-${options.environment}.zip`);
  const changedSourcePaths = collectChangedSourcePaths(ROOT_DIR);
  const needsStackOutputs = shouldReadStackOutputs(options);
  const stages = Object.fromEntries(
    buildDeployStages(options).map((stage) => [stage.id, stage])
  );
  let awsEnv = { ...process.env };
  let stackOutputs = {};

  if (needsStackOutputs) {
    runCommand('aws', ['--version'], { captureOutput: true, echoOutput: false, env: awsEnv });

    stackOutputs = tryDescribeStackOutputs(options, awsEnv);
    const preflightRoleArn = resolveAssumableOperatorRoleArn({ env: process.env, stackOutputs, awsEnv });
    if (preflightRoleArn) {
      try {
        awsEnv = assumeOperatorRole(preflightRoleArn, options.region, awsEnv);
        stackOutputs = tryDescribeStackOutputs(options, awsEnv);
        console.log(`[auth] assumed operator role ${preflightRoleArn}`);
      } catch (error) {
        console.warn(`[auth] unable to assume operator role ${preflightRoleArn}: ${error.message}`);
      }
    }
  }

  if (!options.skipBuild) {
    await runStage(stages.build, () => runBuildWithFallback(awsEnv));
  }

  // Advisory route-graph analysis — runs after build for site-oriented modes.
  // Never fails the deploy. Emits a structured JSON event for the dashboard.
  if (options.staticScope === 'site') {
    try {
      const { validateRouteGraph } = await import('./validate-route-graph.mjs');
      const result = await validateRouteGraph({
        clientDir: path.join(ROOT_DIR, 'dist', 'client'),
        siteUrl: process.env.PUBLIC_SITE_URL ?? 'https://eggear.com',
        mode: options.syncMode === 'full' ? 'full'
          : options.skipBuild ? 'quick-sync-only'
          : options.skipStatic ? (options.syncMode === 'quick' ? 'astro-publish' : 'astro-rebuild')
          : 'quick',
      });
      if (result.event) {
        console.log(JSON.stringify(result.event));
      }
    } catch (error) {
      console.warn(`[route-graph] advisory analysis failed: ${error.message}`);
    }
  }

  if (!options.skipStack) {
    await runStage(stages['stage-lambda'], async () => {
      const emitProgress = createStageProgressReporter('lambda-package');
      stageLambdaArtifact((percentage, detail) => {
        emitProgress(percentage, detail);
      });
      await zipLambdaArtifact(zipPath, (percentage, detail) => {
        emitProgress(percentage, detail);
        console.log(buildLambdaPackageProgressLine(calculateProgressWithinRange({
          start: 0,
          end: 100,
          completed: percentage,
          total: 100,
        })));
      });
    });
    await runStage(stages['upload-lambda'], async () => {
      ensureArtifactBucket(options.artifactBucket, options.region, awsEnv);
      await uploadLambdaArtifact(zipPath, options.artifactBucket, artifactKey, options.region, awsEnv);
    });
    await runStage(stages['deploy-stack'], () => deployStack(
      options,
      artifactKey,
      stackOutputs.CloudFormationExecutionRoleArn || '',
      awsEnv,
    ));
  }

  if (!needsStackOutputs) {
    if (options.syncSearch) {
      await runStage(stages['sync-search'], () => syncSearchIndex(awsEnv));
    }

    console.log(`Deploy complete.
Stack: ${options.stackName}
Build-only Astro publish`);
    return;
  }

  const outputs = await runStage(stages['read-stack'], () => {
    const liveOutputs = describeStackOutputs(options, awsEnv);
    logStackOutputsWithProgress(liveOutputs);
    return liveOutputs;
  });
  const discoveredRoleArn = resolveAssumableOperatorRoleArn({
    env: process.env,
    stackOutputs: outputs,
    awsEnv,
  });
  if (discoveredRoleArn) {
    try {
      awsEnv = assumeOperatorRole(discoveredRoleArn, options.region, awsEnv);
      console.log(`[auth] assumed operator role ${discoveredRoleArn}`);
    } catch (error) {
      console.warn(`[auth] unable to assume operator role ${discoveredRoleArn}: ${error.message}`);
    }
  }
  const staticBucketName = outputs.StaticSiteBucketName;
  const distributionId = outputs.CloudFrontDistributionId;

  if (!staticBucketName) {
    throw new Error(`Stack ${options.stackName} does not expose StaticSiteBucketName.`);
  }

  const needsSmartPreview = shouldPreviewStaticDiff({
    invalidatePaths: options.invalidatePaths,
    invalidationMode: options.invalidationMode,
    syncMode: options.syncMode,
    skipInvalidate: options.skipInvalidate,
    skipStatic: options.skipStatic,
  });
  const s3DryRunOutput = needsSmartPreview
    ? await runStage(
      stages['preview-static'],
      () => previewStaticSync({
        awsEnv,
        bucketName: staticBucketName,
        region: options.region,
        staticScope: options.staticScope,
      })
    )
    : '';
  const s3PreviewRows = parseDryRunRows(s3DryRunOutput);
  const invalidationPlan = !options.skipInvalidate
    ? buildRequestedInvalidationPlan({
      changedSourcePaths,
      invalidatePaths: options.invalidatePaths,
      invalidationMode: options.invalidationMode,
      invalidationMaxPaths: options.invalidationMaxPaths,
      s3DiffRows: s3PreviewRows,
      staticScope: options.staticScope,
      syncMode: options.syncMode,
    })
    : { changedCount: 0, mode: 'none', paths: [], reason: 'CloudFront invalidation was skipped by flag.' };

  if (!distributionId && !options.skipInvalidate && invalidationPlan.paths.length > 0) {
    throw new Error(`Stack ${options.stackName} does not expose CloudFrontDistributionId.`);
  }

  if (!options.skipStatic) {
    await runStage(stages['sync-static'], () => syncStaticTarget({
      awsEnv,
      bucketName: staticBucketName,
      region: options.region,
      s3PreviewRows,
      staticScope: options.staticScope,
      syncMode: options.syncMode,
    }));
  }

  if (options.syncSearch) {
    await runStage(stages['sync-search'], () => syncSearchIndex(awsEnv));
  }

  if (!options.skipInvalidate) {
    console.log(`[cdn] ${invalidationPlan.reason}`);
    console.log(`[cdn] paths: ${invalidationPlan.paths.length > 0 ? invalidationPlan.paths.join(', ') : 'none'}`);
    await runStage(stages.invalidate, () => invalidateCloudFront(distributionId, options.region, invalidationPlan.paths, awsEnv));
  }

  console.log(`Deploy complete.
Stack: ${options.stackName}
Static bucket: ${staticBucketName}
Distribution: ${distributionId}
Invalidation: ${invalidationPlan.mode}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
