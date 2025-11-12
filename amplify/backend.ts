import { defineBackend } from '@aws-amplify/backend';
import { Key } from 'aws-cdk-lib/aws-kms';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';

/**
 * Define the Amplify backend
 * @see https://docs.amplify.aws/react/build-a-backend/
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
});

// ============================================================================
// APPSYNC PERMISSIONS
// ============================================================================

// Grant Lambda permission to invoke AppSync GraphQL API
// This automatically:
// - Injects API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT environment variable
// - Injects API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT environment variable
// - Creates IAM permissions for Lambda to call AppSync
// - Grants all necessary DynamoDB permissions via AppSync (no direct DynamoDB access needed)
backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.gitIntegration.resources.lambda);

// ============================================================================
// KMS ENCRYPTION KEY
// ============================================================================

// Create KMS key for Git credential encryption
const gitCredentialKey = new Key(
  backend.gitIntegration.resources.lambda,
  'GitCredentialEncryptionKey',
  {
    description: 'SpecForge - Git credential encryption key',
    enableKeyRotation: true, // Automatic key rotation for security
    alias: 'specforge/git-credentials',
  }
);

// Grant Lambda permissions to use the KMS key
gitCredentialKey.grantEncryptDecrypt(backend.gitIntegration.resources.lambda);

// Add KMS key ID as environment variable for Lambda
backend.gitIntegration.resources.lambda.addEnvironment(
  'KMS_KEY_ID',
  gitCredentialKey.keyId
);

// ============================================================================
// NOTES
// ============================================================================

/**
 * Environment Variables Auto-Injected by Amplify:
 *
 * 1. API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT
 *    - AppSync GraphQL endpoint URL
 *    - Injected automatically via grantMutation/grantQuery
 *    - Access in Lambda: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT
 *
 * 2. API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT
 *    - AppSync API ID
 *    - Injected automatically via grantMutation/grantQuery
 *    - Access in Lambda: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT
 *
 * 3. KMS_KEY_ID
 *    - KMS key ID for encryption
 *    - Injected manually via addEnvironment above
 *    - Access in Lambda: process.env.KMS_KEY_ID
 *
 * Architecture Pattern:
 * - Lambda → AppSync → DynamoDB (AppSync-first, no direct DynamoDB access)
 * - CloudFormation creates AppSync first, then Lambda with injected endpoint
 * - No circular dependencies: Lambda extends after defineBackend() completes
 */
