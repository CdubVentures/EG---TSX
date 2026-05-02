import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { CACHE_CDN_CONTRACT, buildCacheControlHeader } from '../src/core/cache-cdn-contract.ts';

const templatePath = fileURLToPath(
  new URL('../infrastructure/aws/eg-tsx-stack.yaml', import.meta.url)
);

function loadTemplate() {
  assert.ok(fs.existsSync(templatePath), `template not found: ${templatePath}`);

  const source = fs.readFileSync(templatePath, 'utf8');
  const document = YAML.parseDocument(source);

  assert.equal(document.errors.length, 0, `invalid YAML: ${document.errors.join(', ')}`);

  return {
    source,
    template: document.toJS(),
  };
}

function getResource(resources, logicalId, type) {
  const resource = resources[logicalId];
  assert.ok(resource, `missing resource: ${logicalId}`);
  assert.equal(resource.Type, type, `resource ${logicalId} should be ${type}`);
  return resource;
}

function getQueryStringBehavior(resource) {
  return resource.Properties?.CachePolicyConfig?.ParametersInCacheKeyAndForwardedToOrigin?.QueryStringsConfig?.QueryStringBehavior;
}

function getWhitelistedHeaders(resource) {
  const headers =
    resource.Properties?.CachePolicyConfig?.ParametersInCacheKeyAndForwardedToOrigin?.HeadersConfig?.Headers ?? [];

  return [...headers];
}

function getCustomHeaderValue(resource, headerName) {
  const items = resource.Properties?.ResponseHeadersPolicyConfig?.CustomHeadersConfig?.Items ?? [];
  const header = items.find((item) => item.Header === headerName);
  return header?.Value;
}

function getCacheControlHeaderValue(resource) {
  return getCustomHeaderValue(resource, 'Cache-Control');
}

describe('EG-TSX CloudFormation template', () => {
  it('defines the required parameters', () => {
    const { template } = loadTemplate();
    const parameters = template.Parameters ?? {};

    assert.deepEqual(parameters.ProjectName, {
      Type: 'String',
      Default: 'eg-tsx',
      Description: 'Project slug used to name stack resources.',
    });

    assert.equal(parameters.DatabasePassword?.Type, 'String');
    assert.equal(parameters.DatabasePassword?.NoEcho, true);
    assert.ok(
      parameters.DatabasePassword?.Description?.includes('PostgreSQL'),
      'DatabasePassword should describe the PostgreSQL master password'
    );

    assert.equal(parameters.Environment?.Type, 'String');
    assert.deepEqual(parameters.Environment?.AllowedValues, ['dev', 'prod']);
  });

  it('defines a VPC with two public and two private subnets plus internet egress', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};

    getResource(resources, 'Vpc', 'AWS::EC2::VPC');
    getResource(resources, 'PublicSubnetA', 'AWS::EC2::Subnet');
    getResource(resources, 'PublicSubnetB', 'AWS::EC2::Subnet');
    getResource(resources, 'PrivateSubnetA', 'AWS::EC2::Subnet');
    getResource(resources, 'PrivateSubnetB', 'AWS::EC2::Subnet');
    getResource(resources, 'InternetGateway', 'AWS::EC2::InternetGateway');
    getResource(resources, 'NatGatewayA', 'AWS::EC2::NatGateway');
    getResource(resources, 'NatGatewayB', 'AWS::EC2::NatGateway');
    getResource(resources, 'PrivateRouteTableA', 'AWS::EC2::RouteTable');
    getResource(resources, 'PrivateRouteTableB', 'AWS::EC2::RouteTable');
  });

  it('provisions the S3 static site bucket behind CloudFront OAC', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const bucket = getResource(resources, 'StaticSiteBucket', 'AWS::S3::Bucket');
    const bucketPolicy = getResource(resources, 'StaticSiteBucketPolicy', 'AWS::S3::BucketPolicy');

    assert.equal(bucket.Properties?.WebsiteConfiguration?.IndexDocument, 'index.html');
    assert.equal(bucket.Properties?.WebsiteConfiguration?.ErrorDocument, '404.html');

    getResource(resources, 'StaticSiteOriginAccessControl', 'AWS::CloudFront::OriginAccessControl');

    const statement = bucketPolicy.Properties?.PolicyDocument?.Statement?.[0];
    assert.equal(statement?.Principal?.Service, 'cloudfront.amazonaws.com');
    assert.deepEqual(statement?.Action, 's3:GetObject');
  });

  it('provisions PostgreSQL in private subnets and restricts access to the Lambda security group', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const dbSubnetGroup = getResource(resources, 'DatabaseSubnetGroup', 'AWS::RDS::DBSubnetGroup');
    const dbInstance = getResource(resources, 'DatabaseInstance', 'AWS::RDS::DBInstance');
    const dbIngress = getResource(resources, 'DatabaseSecurityGroupIngressFromLambda', 'AWS::EC2::SecurityGroupIngress');

    assert.equal(dbInstance.Properties?.Engine, 'postgres');
    assert.equal(dbInstance.Properties?.DBInstanceClass, 'db.t4g.micro');
    assert.equal(dbInstance.Properties?.DBSubnetGroupName?.Ref, 'DatabaseSubnetGroup');
    assert.equal(dbInstance.Properties?.PubliclyAccessible, false);
    assert.equal(dbInstance.Properties?.MasterUsername, 'egadmin');

    assert.deepEqual(dbSubnetGroup.Properties?.SubnetIds, [
      { Ref: 'PrivateSubnetA' },
      { Ref: 'PrivateSubnetB' },
    ]);

    assert.equal(dbIngress.Properties?.FromPort, 5432);
    assert.equal(dbIngress.Properties?.ToPort, 5432);
    assert.equal(dbIngress.Properties?.SourceSecurityGroupId?.Ref, 'LambdaSecurityGroup');
  });

  it('creates a VPC-enabled Node.js 20 Lambda with a public function URL and IAM permissions for VPC and logs', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const role = getResource(resources, 'LambdaExecutionRole', 'AWS::IAM::Role');
    const fn = getResource(resources, 'SsrFunction', 'AWS::Lambda::Function');
    const functionUrl = getResource(resources, 'SsrFunctionUrl', 'AWS::Lambda::Url');
    const functionUrlPermission = getResource(
      resources,
      'SsrFunctionUrlPermission',
      'AWS::Lambda::Permission'
    );

    assert.equal(fn.Properties?.Runtime, 'nodejs20.x');
    assert.equal(fn.Properties?.Architectures?.[0], 'arm64');
    assert.equal(fn.Properties?.Handler, 'dist/server/entry.handler');
    assert.deepEqual(fn.Properties?.VpcConfig?.SubnetIds, [
      { Ref: 'PrivateSubnetA' },
      { Ref: 'PrivateSubnetB' },
    ]);
    assert.deepEqual(fn.Properties?.VpcConfig?.SecurityGroupIds, [{ Ref: 'LambdaSecurityGroup' }]);

    assert.equal(functionUrl.Properties?.AuthType, 'NONE');
    assert.equal(functionUrlPermission.Properties?.Action, 'lambda:InvokeFunctionUrl');
    assert.equal(functionUrlPermission.Properties?.Principal, '*');

    const managedPolicies = role.Properties?.ManagedPolicyArns ?? [];
    assert.ok(
      managedPolicies.some(
        (policy) =>
          JSON.stringify(policy) ===
          JSON.stringify({
            'Fn::Sub': 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
          })
      ),
      'Lambda role should include AWSLambdaVPCAccessExecutionRole'
    );

    const inlineStatements =
      role.Properties?.Policies?.flatMap((policy) => policy.PolicyDocument?.Statement ?? []) ?? [];
    assert.ok(
      inlineStatements.some((statement) => statement.Action?.includes?.('logs:CreateLogGroup')),
      'Lambda role should include CloudWatch Logs permissions'
    );
  });

  it('creates stack-owned deploy roles and core monitoring resources for God View', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const deployRole = getResource(resources, 'GodViewDeployRole', 'AWS::IAM::Role');
    const executionRole = getResource(resources, 'CloudFormationExecutionRole', 'AWS::IAM::Role');
    const dashboard = getResource(resources, 'OperationsDashboard', 'AWS::CloudWatch::Dashboard');

    getResource(resources, 'LambdaErrorsAlarm', 'AWS::CloudWatch::Alarm');
    getResource(resources, 'LambdaThrottlesAlarm', 'AWS::CloudWatch::Alarm');
    getResource(resources, 'LambdaDurationAlarm', 'AWS::CloudWatch::Alarm');
    getResource(resources, 'CloudFront5xxAlarm', 'AWS::CloudWatch::Alarm');
    getResource(resources, 'DatabaseCpuAlarm', 'AWS::CloudWatch::Alarm');
    getResource(resources, 'DatabaseFreeStorageAlarm', 'AWS::CloudWatch::Alarm');

    assert.equal(
      executionRole.Properties?.AssumeRolePolicyDocument?.Statement?.[0]?.Principal?.Service,
      'cloudformation.amazonaws.com'
    );

    const deployTrust = deployRole.Properties?.AssumeRolePolicyDocument?.Statement?.[0];
    assert.match(JSON.stringify(deployTrust?.Principal?.AWS ?? ''), /AccountId|root/);

    const deployStatements =
      deployRole.Properties?.Policies?.flatMap((policy) => policy.PolicyDocument?.Statement ?? []) ?? [];
    assert.ok(
      deployStatements.some((statement) => statement.Action?.includes?.('cloudfront:CreateInvalidation')),
      'GodViewDeployRole should allow CloudFront invalidations'
    );
    assert.ok(
      deployStatements.some((statement) => statement.Action?.includes?.('cloudfront:GetInvalidation')),
      'GodViewDeployRole should allow CloudFront invalidation status reads'
    );
    assert.ok(
      deployStatements.some((statement) => statement.Action?.includes?.('iam:PassRole')),
      'GodViewDeployRole should be able to pass the CloudFormation execution role'
    );

    const dashboardBody = JSON.stringify(dashboard.Properties?.DashboardBody ?? {});
    assert.ok(dashboardBody.includes('AWS/Lambda'), 'dashboard should include Lambda widgets');
    assert.ok(dashboardBody.includes('AWS/CloudFront'), 'dashboard should include CloudFront widgets');
    assert.ok(dashboardBody.includes('AWS/RDS'), 'dashboard should include RDS widgets');
  });

  it('creates CloudFront with S3 and Lambda origins, defaulting to S3 and routing dynamic APIs to Lambda', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const distribution = getResource(
      resources,
      'CloudFrontDistribution',
      'AWS::CloudFront::Distribution'
    );

    const config = distribution.Properties?.DistributionConfig ?? {};
    const origins = config.Origins ?? [];

    assert.equal(origins.length, 2);
    assert.ok(origins.some((origin) => origin.Id === 's3-origin'));
    assert.ok(origins.some((origin) => origin.Id === 'lambda-origin'));

    getResource(resources, 'StaticPageCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'StaticAssetCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'HubPageCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'ImagesCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'SearchCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'DynamicNoCachePolicy', 'AWS::CloudFront::CachePolicy');
    getResource(resources, 'DynamicOriginRequestPolicy', 'AWS::CloudFront::OriginRequestPolicy');
    getResource(resources, 'ImagesResponseHeadersPolicy', 'AWS::CloudFront::ResponseHeadersPolicy');

    const imageFunction = getResource(
      resources,
      'ImagePlusEncodingFunction',
      'AWS::CloudFront::Function'
    );
    const hubViewFunction = getResource(
      resources,
      'HubSmallViewFunction',
      'AWS::CloudFront::Function'
    );

    assert.match(
      imageFunction.Properties?.FunctionCode ?? '',
      /req\.uri = req\.uri\.replace\(\/\\\+\/g, '%2B'\);/
    );
    assert.match(hubViewFunction.Properties?.FunctionCode ?? '', /view=small|qs\.view/);
    assert.match(hubViewFunction.Properties?.FunctionCode ?? '', /mouse/);
    assert.match(hubViewFunction.Properties?.FunctionCode ?? '', /keyboard/);
    assert.match(hubViewFunction.Properties?.FunctionCode ?? '', /monitor/);

    assert.equal(config.DefaultCacheBehavior?.TargetOriginId, 's3-origin');
    assert.equal(config.DefaultCacheBehavior?.ViewerProtocolPolicy, 'redirect-to-https');
    assert.equal(config.DefaultCacheBehavior?.CachePolicyId?.Ref, 'StaticPageCachePolicy');

    const cacheBehaviors = config.CacheBehaviors ?? [];
    const expectedS3Paths = ['/assets/*', '/_astro/*', '/images/*', '/fonts/*', '/js/*', '/hubs/*'];
    const expectedLambdaPaths = [
      '/api/search*',
      '/api/*',
      '/api/auth/*',
      '/api/user/*',
      '/api/vault/*',
      '/auth/*',
      '/login/*',
      '/logout',
    ];

    for (const pathPattern of expectedS3Paths) {
      const behavior = cacheBehaviors.find((entry) => entry.PathPattern === pathPattern);
      assert.ok(behavior, `CloudFront should define ${pathPattern}`);
      assert.equal(behavior.TargetOriginId, 's3-origin');
    }

    for (const pathPattern of expectedLambdaPaths) {
      const behavior = cacheBehaviors.find((entry) => entry.PathPattern === pathPattern);
      assert.ok(behavior, `CloudFront should define ${pathPattern}`);
      assert.equal(behavior.TargetOriginId, 'lambda-origin');
    }

    const imageBehavior = cacheBehaviors.find((entry) => entry.PathPattern === '/images/*');
    assert.equal(imageBehavior.CachePolicyId?.Ref, 'ImagesCachePolicy');
    assert.equal(imageBehavior.ResponseHeadersPolicyId?.Ref, 'ImagesResponseHeadersPolicy');
    assert.equal(imageBehavior.FunctionAssociations?.[0]?.EventType, 'viewer-request');
    assert.equal(
      imageBehavior.FunctionAssociations?.[0]?.FunctionARN?.['Fn::GetAtt']?.[0],
      'ImagePlusEncodingFunction'
    );

    const hubBehavior = cacheBehaviors.find((entry) => entry.PathPattern === '/hubs/*');
    assert.equal(hubBehavior.CachePolicyId?.Ref, 'HubPageCachePolicy');
    assert.equal(hubBehavior.FunctionAssociations?.[0]?.EventType, 'viewer-request');
    assert.equal(
      hubBehavior.FunctionAssociations?.[0]?.FunctionARN?.['Fn::GetAtt']?.[0],
      'HubSmallViewFunction'
    );

    const searchBehavior = cacheBehaviors.find((entry) => entry.PathPattern === '/api/search*');
    assert.equal(searchBehavior.CachePolicyId?.Ref, 'SearchCachePolicy');
    assert.equal(searchBehavior.OriginRequestPolicyId?.Ref, 'DynamicOriginRequestPolicy');

    const apiBehavior = cacheBehaviors.find((entry) => entry.PathPattern === '/api/*');
    assert.equal(apiBehavior.CachePolicyId?.Ref, 'DynamicNoCachePolicy');
    assert.equal(apiBehavior.OriginRequestPolicyId?.Ref, 'DynamicOriginRequestPolicy');
  });

  it('projects the shared cache/CDN contract into CloudFront cache keys and response headers', () => {
    const { template } = loadTemplate();
    const resources = template.Resources ?? {};
    const distribution = getResource(
      resources,
      'CloudFrontDistribution',
      'AWS::CloudFront::Distribution'
    );
    const config = distribution.Properties?.DistributionConfig ?? {};
    const cacheBehaviors = config.CacheBehaviors ?? [];

    const staticPageCachePolicy = getResource(resources, 'StaticPageCachePolicy', 'AWS::CloudFront::CachePolicy');
    const hubPageCachePolicy = getResource(resources, 'HubPageCachePolicy', 'AWS::CloudFront::CachePolicy');
    const staticAssetCachePolicy = getResource(resources, 'StaticAssetCachePolicy', 'AWS::CloudFront::CachePolicy');
    const imagesCachePolicy = getResource(resources, 'ImagesCachePolicy', 'AWS::CloudFront::CachePolicy');
    const searchCachePolicy = getResource(resources, 'SearchCachePolicy', 'AWS::CloudFront::CachePolicy');
    const dynamicNoCachePolicy = getResource(resources, 'DynamicNoCachePolicy', 'AWS::CloudFront::CachePolicy');

    assert.equal(getQueryStringBehavior(staticPageCachePolicy), CACHE_CDN_CONTRACT.policies.staticPages.varyQuery);
    assert.equal(getQueryStringBehavior(hubPageCachePolicy), CACHE_CDN_CONTRACT.policies.hubPages.varyQuery);
    assert.equal(getQueryStringBehavior(staticAssetCachePolicy), CACHE_CDN_CONTRACT.policies.staticAssets.varyQuery);
    assert.equal(getQueryStringBehavior(imagesCachePolicy), CACHE_CDN_CONTRACT.policies.images.varyQuery);
    assert.equal(getQueryStringBehavior(searchCachePolicy), CACHE_CDN_CONTRACT.policies.searchApi.varyQuery);
    assert.equal(getQueryStringBehavior(dynamicNoCachePolicy), CACHE_CDN_CONTRACT.policies.dynamicApis.varyQuery);
    assert.deepEqual(
      getWhitelistedHeaders(imagesCachePolicy),
      CACHE_CDN_CONTRACT.policies.images.varyHeaders
    );

    const staticPageHeaders = getResource(
      resources,
      'StaticPageResponseHeadersPolicy',
      'AWS::CloudFront::ResponseHeadersPolicy'
    );
    const hubPageHeaders = getResource(
      resources,
      'HubPageResponseHeadersPolicy',
      'AWS::CloudFront::ResponseHeadersPolicy'
    );
    const staticAssetHeaders = getResource(
      resources,
      'StaticAssetResponseHeadersPolicy',
      'AWS::CloudFront::ResponseHeadersPolicy'
    );
    const imageHeaders = getResource(
      resources,
      'ImagesResponseHeadersPolicy',
      'AWS::CloudFront::ResponseHeadersPolicy'
    );

    assert.equal(
      getCacheControlHeaderValue(staticPageHeaders),
      buildCacheControlHeader('staticPages')
    );
    assert.equal(
      getCacheControlHeaderValue(hubPageHeaders),
      buildCacheControlHeader('hubPages')
    );
    assert.equal(
      getCacheControlHeaderValue(staticAssetHeaders),
      buildCacheControlHeader('staticAssets')
    );
    assert.equal(
      getCacheControlHeaderValue(imageHeaders),
      buildCacheControlHeader('images')
    );
    assert.equal(
      getCustomHeaderValue(imageHeaders, 'Vary'),
      'Accept'
    );

    assert.equal(
      config.DefaultCacheBehavior?.ResponseHeadersPolicyId?.Ref,
      'StaticPageResponseHeadersPolicy'
    );

    const hubBehavior = cacheBehaviors.find((entry) => entry.PathPattern === '/hubs/*');
    assert.equal(hubBehavior?.ResponseHeadersPolicyId?.Ref, 'HubPageResponseHeadersPolicy');

    for (const pathPattern of ['/assets/*', '/_astro/*', '/fonts/*', '/js/*']) {
      const behavior = cacheBehaviors.find((entry) => entry.PathPattern === pathPattern);
      assert.equal(
        behavior?.ResponseHeadersPolicyId?.Ref,
        'StaticAssetResponseHeadersPolicy',
        `${pathPattern} must use the shared static asset response headers policy`
      );
    }
  });

  it('exposes the deployed Lambda function name as a stack output', () => {
    const { template } = loadTemplate();
    const outputs = template.Outputs ?? {};

    assert.deepEqual(outputs.LambdaFunctionName, {
      Description: 'Deployed Lambda function name for the shared EG-TSX runtime.',
      Value: { Ref: 'SsrFunction' },
    });

    assert.ok(outputs.GodViewDeployRoleArn, 'stack should expose GodViewDeployRoleArn');
    assert.ok(
      outputs.CloudFormationExecutionRoleArn,
      'stack should expose CloudFormationExecutionRoleArn'
    );
    assert.ok(outputs.OperationsDashboardName, 'stack should expose OperationsDashboardName');
  });
});
