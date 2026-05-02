import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAssumeRoleEnv,
  buildCloudFormationDeployArgs,
  parseAssumeRoleCredentials,
  resolveAssumableOperatorRoleArn,
  resolveOperatorRoleArn,
} from '../aws-operator.mjs';

describe('resolveOperatorRoleArn', () => {
  it('prefers an explicit env override over stack outputs', () => {
    const roleArn = resolveOperatorRoleArn({
      env: {
        EG_TSX_ASSUME_ROLE_ARN: 'arn:aws:iam::123456789012:role/override',
      },
      stackOutputs: {
        GodViewDeployRoleArn: 'arn:aws:iam::123456789012:role/from-stack',
      },
    });

    assert.equal(roleArn, 'arn:aws:iam::123456789012:role/override');
  });

  it('falls back to the stack-owned God View role output', () => {
    const roleArn = resolveOperatorRoleArn({
      env: {},
      stackOutputs: {
        GodViewDeployRoleArn: 'arn:aws:iam::123456789012:role/from-stack',
      },
    });

    assert.equal(roleArn, 'arn:aws:iam::123456789012:role/from-stack');
  });
});

describe('parseAssumeRoleCredentials', () => {
  it('extracts CLI environment variables from sts assume-role output', () => {
    assert.deepEqual(
      parseAssumeRoleCredentials({
        Credentials: {
          AccessKeyId: 'AKIAEXAMPLE',
          SecretAccessKey: 'secret',
          SessionToken: 'token',
        },
      }),
      {
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'secret',
        AWS_SESSION_TOKEN: 'token',
      }
    );
  });

  it('returns null when credentials are missing', () => {
    assert.equal(parseAssumeRoleCredentials({}), null);
  });
});

describe('buildAssumeRoleEnv', () => {
  it('overlays temporary credentials onto the current AWS environment', () => {
    assert.deepEqual(
      buildAssumeRoleEnv({
        baseEnv: {
          AWS_REGION: 'us-east-2',
          AWS_PROFILE: 'legacy',
          PATH: 'C:/Windows/System32',
        },
        credentials: {
          AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
          AWS_SECRET_ACCESS_KEY: 'secret',
          AWS_SESSION_TOKEN: 'token',
        },
      }),
      {
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        AWS_REGION: 'us-east-2',
        AWS_SECRET_ACCESS_KEY: 'secret',
        AWS_SESSION_TOKEN: 'token',
        PATH: 'C:/Windows/System32',
      }
    );
  });

  it('records the active operator role arn when the assume-role target is known', () => {
    assert.deepEqual(
      buildAssumeRoleEnv({
        baseEnv: {
          AWS_REGION: 'us-east-2',
        },
        credentials: {
          AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
          AWS_SECRET_ACCESS_KEY: 'secret',
          AWS_SESSION_TOKEN: 'token',
        },
        roleArn: 'arn:aws:iam::123456789012:role/eg-tsx-prod-god-view-role',
      }),
      {
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        AWS_REGION: 'us-east-2',
        AWS_SECRET_ACCESS_KEY: 'secret',
        AWS_SESSION_TOKEN: 'token',
        EG_TSX_ACTIVE_ASSUME_ROLE_ARN: 'arn:aws:iam::123456789012:role/eg-tsx-prod-god-view-role',
      }
    );
  });
});

describe('resolveAssumableOperatorRoleArn', () => {
  it('returns the target role when the current env is not already using it', () => {
    const roleArn = resolveAssumableOperatorRoleArn({
      env: {},
      stackOutputs: {
        GodViewDeployRoleArn: 'arn:aws:iam::123456789012:role/from-stack',
      },
      awsEnv: {
        AWS_REGION: 'us-east-2',
      },
    });

    assert.equal(roleArn, 'arn:aws:iam::123456789012:role/from-stack');
  });

  it('skips re-assuming the same operator role after preflight already switched credentials', () => {
    const roleArn = resolveAssumableOperatorRoleArn({
      env: {},
      stackOutputs: {
        GodViewDeployRoleArn: 'arn:aws:iam::123456789012:role/from-stack',
      },
      awsEnv: {
        EG_TSX_ACTIVE_ASSUME_ROLE_ARN: 'arn:aws:iam::123456789012:role/from-stack',
      },
    });

    assert.equal(roleArn, '');
  });
});

describe('buildCloudFormationDeployArgs', () => {
  it('includes the stack-owned execution role when it is available', () => {
    const args = buildCloudFormationDeployArgs({
      executionRoleArn: 'arn:aws:iam::123456789012:role/cfn-execution',
      parameterOverrides: ['ProjectName=eg-tsx'],
      region: 'us-east-2',
      stackName: 'eg-tsx-prod',
      templatePath: 'infrastructure/aws/eg-tsx-stack.yaml',
    });

    assert.deepEqual(args, [
      'cloudformation',
      'deploy',
      '--template-file',
      'infrastructure/aws/eg-tsx-stack.yaml',
      '--stack-name',
      'eg-tsx-prod',
      '--region',
      'us-east-2',
      '--capabilities',
      'CAPABILITY_IAM',
      'CAPABILITY_NAMED_IAM',
      '--role-arn',
      'arn:aws:iam::123456789012:role/cfn-execution',
      '--parameter-overrides',
      'ProjectName=eg-tsx',
    ]);
  });
});
