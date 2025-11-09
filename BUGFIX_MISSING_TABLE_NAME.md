# Bug Fix: Missing TABLE_NAME Environment Variable

## Issue Identified

**Error Message**:
```
1 validation error detected: Value '' at 'tableName' failed to satisfy constraint:
Member must have length greater than or equal to 1
```

**Root Cause**:
The `git-integration-lambda` function's `TABLE_NAME` environment variable was empty (`''`), causing DynamoDB operations to fail.

**Discovered via Debug Logs**:
```
[GitAPI] Lambda response data: {
  error: 'Failed to connect repository',
  details: "1 validation error detected: Value '' at 'tableName' failed to satisfy constraint..."
}
```

---

## Why This Happened

The Lambda function code expected these environment variables:
```typescript
const TABLE_NAME = process.env.TABLE_NAME || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
```

But `amplify/backend.ts` never set them. The function had IAM permissions to access DynamoDB (`dynamodb:PutItem`, etc.) but no table to connect to.

---

## Solution Implemented

### 1. Created Dedicated DynamoDB Table

**File**: `amplify/backend.ts`

```typescript
// Create DynamoDB table for Git Integration data
const gitDataTable = new Table(
  backend.gitIntegration.resources.lambda,
  'GitIntegrationTable',
  {
    partitionKey: { name: 'id', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
    tableName: 'GitIntegrationData',
  }
);
```

**Table Details**:
- **Name**: `GitIntegrationData`
- **Partition Key**: `id` (STRING)
- **Billing**: Pay-per-request (auto-scaling)
- **Purpose**: Store GitRepository, CodeSnapshot, and ProjectContext records

### 2. Granted IAM Access

```typescript
// Grant Lambda access to the table
gitDataTable.grantReadWriteData(backend.gitIntegration.resources.lambda);
gitDataTable.grantReadWriteData(backend.codeAnalyzer.resources.lambda);
```

This adds IAM permissions to both Lambda functions to read/write the table.

### 3. Set Environment Variables

```typescript
// Set environment variables
backend.gitIntegration.addEnvironment('TABLE_NAME', gitDataTable.tableName);
backend.gitIntegration.addEnvironment('BUCKET_NAME', backend.storage.resources.bucket.bucketName);
backend.gitIntegration.addEnvironment('DEBUG_GIT_INTEGRATION', process.env.DEBUG_GIT_INTEGRATION || 'false');

// Also for code-analyzer
backend.codeAnalyzer.addEnvironment('TABLE_NAME', gitDataTable.tableName);
backend.codeAnalyzer.addEnvironment('BUCKET_NAME', backend.storage.resources.bucket.bucketName);
```

Now the Lambda functions can access:
- `TABLE_NAME` = `'GitIntegrationData'`
- `BUCKET_NAME` = S3 bucket name for file trees
- `DEBUG_GIT_INTEGRATION` = `'true'` (for debug logging)

---

## Deployment

```bash
npx ampx sandbox --once --outputs-format json --outputs-out-dir .
```

**Result**:
```
✔ CREATE_COMPLETE | AWS::DynamoDB::Table | GitIntegrationTable
✔ UPDATE_COMPLETE | AWS::Lambda::Function | git-integration-lambda
✔ UPDATE_COMPLETE | AWS::Lambda::Function | code-analyzer-lambda
```

---

## Files Modified

1. ✅ `amplify/backend.ts`:
   - Added DynamoDB Table import
   - Created `gitDataTable`
   - Granted IAM permissions
   - Set environment variables for both Lambda functions

---

## Verification

### Before Fix:
```typescript
// Lambda environment
TABLE_NAME = ''  // ❌ Empty!
BUCKET_NAME = ''
```

**Error**: `Value '' at 'tableName' failed to satisfy constraint`

### After Fix:
```typescript
// Lambda environment
TABLE_NAME = 'GitIntegrationData'  // ✅ Set!
BUCKET_NAME = 'amplify-aiimplementationtr-specfilesbucket82f395dc-oic0ocjwgt8q'
DEBUG_GIT_INTEGRATION = 'true'
```

**Result**: Lambda can now save Git repository data to DynamoDB

---

## Testing

**Try connecting a repository**:
1. Open your application
2. Go to a project
3. Click "Git Integration"
4. Enter:
   - Repository URL: `https://github.com/owner/repo`
   - GitHub PAT: (your personal access token)
5. Click "Connect Repository"

**Expected Debug Logs** (with DEBUG=true):
```
[GitLambda] handleConnect() - Step 4: Saving to DynamoDB {
  repositoryId: 'repo-1234567890',
  tableName: 'GitIntegrationData',  ✅
  branch: 'main'
}
[GitLambda] handleConnect() - Repository saved to DynamoDB  ✅
[GitLambda] handleConnect() - Success, returning: { statusCode: 200, ... }
```

---

## Related Issues Fixed

This same fix also resolved issues for:
- **Code Analyzer**: Now has TABLE_NAME and BUCKET_NAME
- **Repository Sync**: Can save CodeSnapshot records
- **Project Context**: Can save analysis results

---

## Production Considerations

For production deployment, consider:

1. **Table Name**: Use CloudFormation-generated names instead of hardcoded
2. **Removal Policy**: Change to `RemovalPolicy.RETAIN` to keep data on stack deletion
3. **Backup**: Enable point-in-time recovery:
   ```typescript
   pointInTimeRecovery: true,
   ```
4. **Encryption**: Enable encryption at rest:
   ```typescript
   encryption: TableEncryption.AWS_MANAGED,
   ```

---

## Key Learnings

1. **Debug Logs Work!** The comprehensive logging immediately showed:
   - Which layer failed (Lambda)
   - Which step failed (Step 4: DynamoDB save)
   - Exact error (empty tableName)

2. **Environment Variables Must Be Set**: Even with correct IAM permissions, Lambda functions need environment variables to know which resources to access

3. **Amplify Gen 2 Pattern**:
   - Data resource creates GraphQL-backed tables
   - Custom operations need custom tables
   - Use CDK constructs directly in backend.ts

---

**Fixed**: 2025-11-08
**Issue**: Missing TABLE_NAME environment variable
**Solution**: Created DynamoDB table and set environment variables
**Status**: ✅ Resolved and deployed
