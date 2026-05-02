export function resolveOperatorRoleArn({ env = {}, stackOutputs = {} } = {}) {
  return env.EG_TSX_ASSUME_ROLE_ARN || stackOutputs.GodViewDeployRoleArn || '';
}

export function resolveAssumableOperatorRoleArn({ env = {}, stackOutputs = {}, awsEnv = {} } = {}) {
  const roleArn = resolveOperatorRoleArn({ env, stackOutputs });
  if (!roleArn) {
    return '';
  }

  return awsEnv.EG_TSX_ACTIVE_ASSUME_ROLE_ARN === roleArn ? '' : roleArn;
}

export function parseAssumeRoleCredentials(payload) {
  const credentials = payload?.Credentials;
  if (!credentials?.AccessKeyId || !credentials?.SecretAccessKey || !credentials?.SessionToken) {
    return null;
  }

  return {
    AWS_ACCESS_KEY_ID: credentials.AccessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.SecretAccessKey,
    AWS_SESSION_TOKEN: credentials.SessionToken,
  };
}

export function buildAssumeRoleEnv({ baseEnv = {}, credentials, roleArn = '' }) {
  if (!credentials) {
    return { ...baseEnv };
  }

  const nextEnv = { ...baseEnv, ...credentials };
  if (roleArn) {
    nextEnv.EG_TSX_ACTIVE_ASSUME_ROLE_ARN = roleArn;
  }
  delete nextEnv.AWS_PROFILE;
  delete nextEnv.AWS_DEFAULT_PROFILE;
  return nextEnv;
}

export function buildCloudFormationDeployArgs({
  executionRoleArn = '',
  parameterOverrides,
  region,
  stackName,
  templatePath,
}) {
  const args = [
    'cloudformation',
    'deploy',
    '--template-file',
    templatePath,
    '--stack-name',
    stackName,
    '--region',
    region,
    '--capabilities',
    'CAPABILITY_IAM',
    'CAPABILITY_NAMED_IAM',
  ];

  if (executionRoleArn) {
    args.push('--role-arn', executionRoleArn);
  }

  args.push('--parameter-overrides', ...parameterOverrides);
  return args;
}
