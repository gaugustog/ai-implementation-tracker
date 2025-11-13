# MVP-003-01: Configure Backend with Lambda and KMS

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 1  
**Estimated Time**: 1 hour  
**Status**: Todo  
**Priority**: Critical  
**Depends On**: MVP-002-01

---

## Objective

Configure `amplify/backend.ts` to register the git-integration Lambda function, grant AppSync permissions, and create a KMS key for Git credential encryption.

---

## Current Backend State

File: `amplify/backend.ts`

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

export const backend = defineBackend({
  auth,
  data,
  storage,
});
```

---

## Target Backend Configuration

Replace the entire content of `amplify/backend.ts` with:

```typescript
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
```

---

## Implementation Steps

### 1. Update backend.ts

```bash
# Navigate to backend directory
cd amplify

# Edit backend.ts
code backend.ts  # or your preferred editor
```

Paste the complete backend configuration shown above.

### 2. Verify gitIntegration Import

The import `import { gitIntegration } from './functions/git-integration/resource';` requires that the Lambda function resource file exists.

**Note**: The actual Lambda implementation happens in the next tickets. For now, we'll create a minimal resource file to prevent import errors.

Create `amplify/functions/git-integration/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const gitIntegration = defineFunction({
  name: 'git-integration',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  environment: {
    NODE_ENV: 'production',
  },
});
```

Create a minimal `amplify/functions/git-integration/handler.ts`:

```typescript
export const handler = async (event: any) => {
  console.log('Git Integration Lambda - Event:', JSON.stringify(event, null, 2));
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Git Integration Lambda - Placeholder',
      event,
    }),
  };
};
```

### 3. Deploy Backend

```bash
# From project root
npx ampx sandbox
```

### 4. Monitor Deployment

Watch for:
- ✅ Lambda function creation
- ✅ KMS key creation
- ✅ IAM role updates
- ✅ Environment variables injection
- ✅ AppSync API updates

---

## Acceptance Criteria

- [ ] `backend.ts` updated with Lambda registration
- [ ] KMS key configuration added
- [ ] AppSync grant permissions configured
- [ ] Minimal Lambda function created (prevents import errors)
- [ ] Deployment completes successfully
- [ ] KMS key created with key rotation enabled
- [ ] Lambda has correct IAM permissions
- [ ] Environment variables auto-injected

---

## Verification Steps

### 1. Check Lambda Function

```bash
# List Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName'

# Get Lambda configuration
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text)
```

Expected output should include:
- Environment variables: `API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT`, `API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT`, `KMS_KEY_ID`
- Timeout: 300 seconds
- Memory: 512 MB

### 2. Check KMS Key

```bash
# List KMS keys
aws kms list-aliases --query 'Aliases[?contains(AliasName, `specforge`)]'

# Should show: alias/specforge/git-credentials
```

### 3. Verify Lambda IAM Role

```bash
# Get Lambda role ARN
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Role' --output text)

# List attached policies
aws iam list-attached-role-policies --role-name $(basename $ROLE_ARN)

# Should include policies for:
# - AppSync access
# - KMS encrypt/decrypt
# - CloudWatch Logs
```

### 4. Test Lambda Invocation

```bash
# Test with sample event
aws lambda invoke \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --payload '{"test": true}' \
  response.json

# Check response
cat response.json
```

Expected: Placeholder message with event data

### 5. Check Environment Variables

```bash
# Get Lambda environment variables
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Environment.Variables' \
  --output json
```

Expected JSON:
```json
{
  "API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT": "https://....appsync-api.us-east-1.amazonaws.com/graphql",
  "API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT": "....",
  "KMS_KEY_ID": "....",
  "NODE_ENV": "production"
}
```

---

## Architecture Validation

### CloudFormation Deployment Order

1. **AppSync API** is created first
2. AppSync endpoint URL is captured as CloudFormation output
3. **Lambda function** is created second with endpoint URL injected
4. **KMS key** is created alongside Lambda
5. IAM permissions are automatically configured

### No Circular Dependencies

```
✅ Correct Flow:
defineBackend() → AppSync created → Lambda created → Extensions applied

❌ Would cause circular dependency:
Lambda needs AppSync URL → AppSync needs Lambda ARN → Deadlock
```

Amplify's `grant*` methods solve this by:
- Creating resources in dependency-safe order
- Injecting URLs at runtime (not build time)
- Using CloudFormation outputs for dynamic values

---

## Common Issues & Solutions

### Issue: Import Error for gitIntegration

**Error**: `Cannot find module './functions/git-integration/resource'`

**Solution**: Ensure minimal Lambda files are created:
- `amplify/functions/git-integration/resource.ts`
- `amplify/functions/git-integration/handler.ts`

### Issue: KMS Key Creation Fails

**Error**: `Key with alias already exists`

**Solution**: Delete existing key alias:
```bash
aws kms delete-alias --alias-name alias/specforge/git-credentials
```

### Issue: Lambda Has No Environment Variables

**Solution**: Check grant methods are called AFTER defineBackend():
```typescript
// ✅ Correct
const backend = defineBackend({ ... });
backend.data.resources.graphqlApi.grantMutation(...);

// ❌ Wrong
backend.data.resources.graphqlApi.grantMutation(...);
const backend = defineBackend({ ... });
```

---

## Rollback Procedure

If deployment fails:

```bash
# Stop sandbox
# Press Ctrl+C

# Restore original backend.ts
git checkout amplify/backend.ts

# Remove Lambda placeholder
rm -rf amplify/functions/git-integration

# Redeploy
npx ampx sandbox
```

---

## Notes

- **KMS Key Rotation**: Enabled automatically for security compliance
- **IAM Least Privilege**: Lambda only gets permissions it needs
- **Environment Variables**: Amplify handles injection—no manual configuration
- **AppSync-First**: Lambda never accesses DynamoDB directly

---

## Next Ticket

MVP-004-01: Implement Lambda Directory Structure
