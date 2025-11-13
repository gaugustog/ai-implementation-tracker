import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';

// Initialize backend with all resources
const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
});

// Extract environment and AppSync references
const graphqlUrl = backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl;
const graphqlApiId = backend.data.resources.cfnResources.cfnGraphqlApi.attrApiId;
const dataRegion = Stack.of(backend.data).region;
const stackName = Stack.of(backend.data).stackName;
const envName = stackName.split('-')[2] || 'sandbox';

console.log(`📦 Environment: ${envName}`);
console.log(`📦 Stack: ${stackName}`);

// Store AppSync URL in SSM for environment-aware configuration
// Lambda will read from /specforge/{env}/appsync-url instead of hardcoded env vars
const appSyncUrlParameter = new StringParameter(
  backend.gitIntegration.resources.lambda,
  'AppSyncUrlParameter',
  {
    parameterName: `/specforge/${envName}/appsync-url`,
    stringValue: graphqlUrl,
    description: `AppSync GraphQL API endpoint URL for ${envName} environment`,
  }
);

console.log('✅ Configured AppSync URL in SSM Parameter Store');
console.log(`   - Parameter: /specforge/${envName}/appsync-url`);
console.log(`   - GraphQL Endpoint: ${graphqlUrl}`);

// Configure Lambda permissions and environment
const gitIntegrationLambda = backend.gitIntegration.resources.lambda as Function;

appSyncUrlParameter.grantRead(gitIntegrationLambda);
gitIntegrationLambda.addEnvironment('APPSYNC_URL_PARAMETER', appSyncUrlParameter.parameterName);

const appSyncPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['appsync:GraphQL'],
  resources: [`arn:aws:appsync:${dataRegion}:*:apis/${graphqlApiId}/*`],
});
gitIntegrationLambda.addToRolePolicy(appSyncPolicy);

console.log('✅ Configured Git Integration Lambda');
console.log(`   - Granted SSM read permission for AppSync URL`);
console.log(`   - Granted AppSync GraphQL API access`);

// Create KMS key for Git credential encryption
const gitCredentialKey = new Key(
  backend.gitIntegration.resources.lambda,
  'GitCredentialEncryptionKey',
  {
    description: 'SpecForge - Git credential encryption key',
    enableKeyRotation: true,
    alias: 'specforge/git-credentials',
  }
);

gitCredentialKey.grantEncryptDecrypt(gitIntegrationLambda);

console.log('✅ Configured KMS encryption key for Git credentials');

// Store KMS key ID in SSM for environment-aware configuration
const kmsKeyParameter = new StringParameter(
  backend.gitIntegration.resources.lambda,
  'GitCredentialKmsKeyParameter',
  {
    parameterName: `/specforge/${envName}/kms-key-id`,
    stringValue: gitCredentialKey.keyId,
    description: `KMS key ID for Git credential encryption in ${envName} environment`,
  }
);

kmsKeyParameter.grantRead(gitIntegrationLambda);
gitIntegrationLambda.addEnvironment('KMS_KEY_ID_PARAMETER', kmsKeyParameter.parameterName);

console.log('✅ Configured SSM Parameter Store for KMS key ID');
console.log(`   - Parameter: /specforge/${envName}/kms-key-id`);

// ============================================================================
// ARCHITECTURE NOTES
// ============================================================================

/**
 * SSM Parameter Store Pattern
 *
 * Configuration is stored in SSM using environment-aware paths:
 * - /specforge/{env}/appsync-url - AppSync GraphQL endpoint (shared across Lambdas)
 * - /specforge/{env}/kms-key-id - KMS key for credential encryption
 *
 * Benefits:
 * - Environment isolation (sandbox, dev, prod)
 * - Centralized configuration
 * - No redeployment needed for config changes
 * - Audit trail via CloudWatch
 *
 * Data Flow:
 * Client → AppSync (custom query) → Lambda → SSM (config) → AppSync (mutations) → DynamoDB
 */
