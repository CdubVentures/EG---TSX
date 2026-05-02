const WINDOWS_LINE_ENDING = '\r\n';

export function buildBootstrapArtifactKey({
  projectName,
  environment,
}) {
  return `bootstrap/${projectName}-${environment}-bootstrap.zip`;
}

export function buildBootstrapParameterOverrides({
  projectName,
  environment,
  databasePassword,
  artifactBucket,
}) {
  return [
    `ProjectName=${projectName}`,
    `Environment=${environment}`,
    `DatabasePassword=${databasePassword}`,
    `LambdaCodeS3Bucket=${artifactBucket}`,
    `LambdaCodeS3Key=${buildBootstrapArtifactKey({ projectName, environment })}`,
  ];
}

export function buildBootstrapHandlerSource() {
  return [
    "export async function handler() {",
    "  return {",
    "    statusCode: 503,",
    "    headers: {",
    "      'content-type': 'text/plain; charset=utf-8',",
    "      'cache-control': 'no-store',",
    "    },",
    "    body: 'Bootstrap artifact active. Run third-run-first-deploy.bat to activate the EG-TSX app.',",
    "  };",
    "}",
    "",
  ].join('\n');
}

export function buildRunBatchDefinitions() {
  return [
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
  ];
}

export function renderRunConfigExample() {
  return [
    '@echo off',
    'set AWS_REGION=us-east-2',
    'set EG_TSX_PROJECT_NAME=eg-tsx',
    'set EG_TSX_ENVIRONMENT=prod',
    'set EG_TSX_STACK_NAME=eg-tsx-prod',
    'set EG_TSX_ARTIFACT_PREFIX=lambda',
    'set EG_TSX_ARTIFACT_BUCKET_STACK_NAME=eg-tsx-artifacts',
    'set EG_TSX_ARTIFACT_BUCKET=eg-tsx-artifacts-yourname-2026',
    'set EG_TSX_DATABASE_PASSWORD=CHANGE_ME',
    '',
  ].join(WINDOWS_LINE_ENDING);
}

export function renderRunBatchContent({ target, args = [] }) {
  const targetPath = target.replaceAll('/', '\\');
  const renderedArgs = args.length > 0 ? ` ${args.join(' ')}` : '';

  return [
    '@echo off',
    'setlocal',
    'if not exist "%~dp0run-config.cmd" (',
    '  echo Missing run-config.cmd. Copy run-config.example.cmd to run-config.cmd and fill in your values first.',
    '  exit /b 1',
    ')',
    'call "%~dp0run-config.cmd"',
    'if errorlevel 1 exit /b %errorlevel%',
    'pushd "%~dp0..\\.."',
    `node "%~dp0..\\..\\${targetPath}"${renderedArgs} %*`,
    'set "EXIT_CODE=%ERRORLEVEL%"',
    'popd',
    'if not "%EXIT_CODE%"=="0" (',
    '  echo.',
    '  echo Deployment failed with exit code %EXIT_CODE%.',
    '  pause',
    ')',
    'exit /b %EXIT_CODE%',
    '',
  ].join(WINDOWS_LINE_ENDING);
}
