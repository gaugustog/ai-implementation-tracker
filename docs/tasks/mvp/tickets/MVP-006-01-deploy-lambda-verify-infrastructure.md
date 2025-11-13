# MVP-006-01: Deploy Lambda and Verify Infrastructure

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 2  
**Estimated Time**: 30 minutes  
**Status**: Todo  
**Priority**: High  
**Depends On**: MVP-005-01

---

## Objective

Deploy the complete Lambda function with all dependencies and verify that all infrastructure components are properly configured and working.

---

## Deployment Steps

### 1. Install Lambda Dependencies

```bash
# Navigate to Lambda directory
cd amplify/functions/git-integration

# Install dependencies
npm install

# Verify installation
ls node_modules/@aws-sdk/client-kms
ls node_modules/@octokit/rest
ls node_modules/aws-amplify
```

### 2. Deploy with Amplify Sandbox

```bash
# From project root
npx ampx sandbox
```

Wait for deployment to complete. Watch for:
- ✅ Lambda function update
- ✅ Environment variables injection
- ✅ IAM permissions update
- ✅ No errors or warnings

### 3. Monitor CloudWatch Logs

```bash
# Get Lambda function name
LAMBDA_NAME=$(aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' \
  --output text)

echo "Lambda Function: $LAMBDA_NAME"

# Create log stream (if needed)
aws logs tail "/aws/lambda/$LAMBDA_NAME" --follow
```

---

## Verification Checklist

### 1. Lambda Function Configuration

```bash
# Get function configuration
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --output json > lambda-config.json

# Verify configuration
cat lambda-config.json | jq '{
  FunctionName: .FunctionName,
  Runtime: .Runtime,
  Timeout: .Timeout,
  MemorySize: .MemorySize,
  Environment: .Environment.Variables
}'
```

**Expected Values:**
- Timeout: 300 seconds
- MemorySize: 512 MB
- Environment Variables:
  - `API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT`
  - `API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT`
  - `KMS_KEY_ID`
  - `NODE_ENV`

### 2. IAM Role Permissions

```bash
# Get Lambda role
ROLE_NAME=$(aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Role' --output text | xargs basename)

echo "IAM Role: $ROLE_NAME"

# List attached policies
aws iam list-attached-role-policies --role-name "$ROLE_NAME"

# List inline policies
aws iam list-role-policies --role-name "$ROLE_NAME"
```

**Expected Permissions:**
- AppSync: Query, Mutation
- KMS: Encrypt, Decrypt
- CloudWatch: Logs creation
- DynamoDB: (via AppSync, not direct)

### 3. KMS Key

```bash
# List KMS keys with SpecForge alias
aws kms list-aliases \
  --query 'Aliases[?contains(AliasName, `specforge`)]' \
  --output table

# Get key details
KMS_KEY_ID=$(aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Environment.Variables.KMS_KEY_ID' --output text)

aws kms describe-key --key-id "$KMS_KEY_ID" | jq '{
  KeyId: .KeyMetadata.KeyId,
  KeyState: .KeyMetadata.KeyState,
  Enabled: .KeyMetadata.Enabled,
  KeyRotationEnabled: .KeyMetadata.KeyRotationEnabled
}'
```

**Expected:**
- KeyState: "Enabled"
- Enabled: true
- KeyRotationEnabled: true (should be enabled)

### 4. AppSync API

```bash
# Get AppSync API details
API_ID=$(aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Environment.Variables.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT' --output text)

aws appsync get-graphql-api --api-id "$API_ID" | jq '{
  name: .graphqlApi.name,
  apiId: .graphqlApi.apiId,
  authenticationType: .graphqlApi.authenticationType,
  uris: .graphqlApi.uris
}'
```

### 5. DynamoDB Tables

```bash
# List all Amplify tables
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `amplify`)]' \
  --output table

# Should show all 14 tables from schema
```

Expected tables:
- Project
- GitRepository
- GitCredential
- Workspace
- MonorepoStructure
- MonorepoDependency
- Context
- SpecificationContext
- SpecificationType
- Specification
- Epic
- Ticket
- TicketDependency

---

## Test Lambda Invocation

### Simple Test

```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "arguments": {
    "operation": "validateAccess",
    "data": {
      "repositoryId": "test-repo-id"
    }
  }
}
EOF

# Invoke Lambda
aws lambda invoke \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --payload file://test-event.json \
  response.json

# Check response
cat response.json | jq
```

**Expected Response:**
- Should execute (may fail due to missing repository, but Lambda should initialize)
- Check CloudWatch logs for initialization messages
- Verify no environment variable errors

### Check CloudWatch Logs

```bash
# View recent logs
aws logs tail "/aws/lambda/$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text)" \
  --since 5m \
  --follow
```

**Expected Log Messages:**
```
Initializing Lambda...
AppSync Endpoint: https://....
KMS Key ID: ....
✅ Lambda initialized successfully
```

---

## Acceptance Criteria

- [ ] Lambda deployed successfully
- [ ] Lambda has correct timeout (300s) and memory (512MB)
- [ ] All environment variables are present
- [ ] KMS key created with rotation enabled
- [ ] IAM role has AppSync and KMS permissions
- [ ] AppSync API is accessible
- [ ] All 14 DynamoDB tables exist
- [ ] Test invocation succeeds (Lambda initializes)
- [ ] CloudWatch logs show initialization messages
- [ ] No errors in deployment or execution

---

## Troubleshooting

### Issue: Missing Environment Variables

**Symptom**: Lambda logs show "Missing required environment variable"

**Solution**:
```bash
# Verify backend.ts has grant methods
cat amplify/backend.ts | grep -A 2 "grantMutation\|grantQuery"

# Redeploy
npx ampx sandbox --once
```

### Issue: KMS Permission Denied

**Symptom**: "AccessDeniedException: User is not authorized to perform: kms:Decrypt"

**Solution**:
```bash
# Verify KMS permissions in backend.ts
cat amplify/backend.ts | grep -A 2 "grantEncryptDecrypt"

# Check if key ID is correct
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Environment.Variables.KMS_KEY_ID'
```

### Issue: AppSync GraphQL Errors

**Symptom**: "GraphQL request failed"

**Solution**:
```bash
# Verify AppSync endpoint
aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Environment.Variables.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT'

# Test AppSync directly
aws appsync list-graphql-apis
```

---

## Success Indicators

✅ **Infrastructure Deployed**
- Lambda function exists
- KMS key created
- IAM permissions configured
- Environment variables injected

✅ **Configuration Verified**
- Timeout: 300 seconds
- Memory: 512 MB
- Key rotation: Enabled
- All env vars present

✅ **Logs Healthy**
- Initialization succeeds
- No missing dependencies
- No permission errors

---

## Next Ticket

MVP-007-01: Create Integration Test Script
