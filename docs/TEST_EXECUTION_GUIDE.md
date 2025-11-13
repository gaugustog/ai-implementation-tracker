# Epic-01 Test Execution Guide

This guide provides step-by-step instructions for executing end-to-end integration tests for the Git Integration functionality (Epic-01).

---

## Prerequisites

### 1. GitHub Personal Access Token

You'll need a GitHub PAT with `repo` scope:

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Select scopes:
   - ✅ `repo` (Full control of private repositories)
4. Generate token
5. **Copy the token immediately** (it won't be shown again)

**Security Note**: Never commit this token to Git. Use environment variables only.

### 2. Verify Infrastructure

```bash
# Check that amplify_outputs.json exists
ls amplify_outputs.json

# Verify Lambda function is deployed
aws lambda get-function \
  --function-name amplify-aiimplementationt-gitintegrationlambdaC102-orJPDEhJRm8j \
  --query 'Configuration.{Name:FunctionName,State:State,Runtime:Runtime}'

# Check DynamoDB tables (should show 13 tables)
aws dynamodb list-tables | grep $(aws dynamodb list-tables --query 'TableNames[0]' --output text | cut -d'-' -f1-4) | wc -l
```

Expected outputs:
- amplify_outputs.json: ✅ Exists
- Lambda State: ✅ Active
- DynamoDB tables: ✅ 13 tables

---

## Test Scenarios

### Test 1: Public Repository (Recommended First Test)

This test uses a well-known public repository to verify basic functionality.

```bash
TEST_REPO_URL="https://github.com/aws-amplify/amplify-js" \
TEST_PAT="YOUR_GITHUB_TOKEN_HERE" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - Amplify JS" \
npm run test:git-integration
```

**What this tests**:
- ✅ Project creation in DynamoDB
- ✅ Repository connection
- ✅ GitHub API integration
- ✅ Default branch detection
- ✅ Branch listing
- ✅ Credential encryption with KMS
- ✅ Data persistence

**Expected output**:
```
================================================================================
  🚀 SpecForge Git Integration Test
================================================================================

Configuration:
   Project Name: "Test - Amplify JS"
   Repository URL: "https://github.com/aws-amplify/amplify-js"
   Provider: "github"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Step 1: Create Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Project created successfully
   Project ID: "abc123..."

... [continues through all 6 steps]

================================================================================
  🎉 All Tests Passed Successfully!
================================================================================
```

---

### Test 2: Private Repository

Test with your own private repository to verify access control.

```bash
TEST_REPO_URL="https://github.com/YOUR_USERNAME/YOUR_PRIVATE_REPO" \
TEST_PAT="YOUR_GITHUB_TOKEN_HERE" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - Private Repo" \
npm run test:git-integration
```

**What this tests additionally**:
- ✅ Private repository access
- ✅ Token authentication
- ✅ Access validation

---

### Test 3: Multi-Branch Repository

Test with a repository that has many branches.

```bash
TEST_REPO_URL="https://github.com/facebook/react" \
TEST_PAT="YOUR_GITHUB_TOKEN_HERE" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - React Repo" \
npm run test:git-integration
```

**What this tests additionally**:
- ✅ Branch pagination handling
- ✅ Branch caching (100 limit)
- ✅ Branch switching between multiple branches
- ✅ Performance with large branch lists

---

## Verification Steps

### Step 1: Run Data Verification

After running at least one integration test:

```bash
npm run verify:data
```

**Expected output**:
```
================================================================================
  Data Integrity Verification
================================================================================

📋 Verifying Projects...
✅ Projects: 3
   - Test - Amplify JS (abc123...)
   - Test - Private Repo (def456...)
   - Test - React Repo (ghi789...)

🔗 Verifying Git Repositories...
✅ Git Repositories: 3
   - https://github.com/aws-amplify/amplify-js
     Provider: github
     Current Branch: main
     Status: ready
     Branches Cached: 45

🔑 Verifying Git Credentials...
✅ Git Credentials: 3
   - Repository ID: abc123...
     Type: token
     Encrypted: ✅ Yes (KMS)
     ✅ Token appears encrypted (base64)

================================================================================
  Verification Summary
================================================================================

  Projects: 3
  Repositories: 3
  Credentials: 3
  Repository-Project Links: 3/3
  Credential-Repository Links: 3/3

✅ Data integrity verification PASSED

All records found and relationships intact.
```

---

### Step 2: Check CloudWatch Logs

```bash
# Tail logs from the Lambda function
aws logs tail "/aws/lambda/amplify-aiimplementationt-gitintegrationlambdaC102-orJPDEhJRm8j" \
  --since 10m \
  --format short
```

**Look for**:
- ✅ "Lambda initialized successfully"
- ✅ "Signing request with AWS IAM credentials..."
- ✅ "✅ GraphQL operation successful"
- ✅ "[GitHub] ✅ Default branch: main"
- ✅ "✅ Repository connected successfully"
- ❌ No error messages

---

### Step 3: Verify KMS Encryption

```bash
# List KMS keys
aws kms list-aliases --query 'Aliases[?contains(AliasName, `specforge`)]' --output table

# Check if key rotation is enabled
KMS_KEY_ID=$(aws kms list-aliases --query 'Aliases[?contains(AliasName, `specforge`)].TargetKeyId' --output text)
aws kms get-key-rotation-status --key-id "$KMS_KEY_ID"
```

**Expected**:
```
Alias: alias/specforge/git-credentials
KeyRotationEnabled: true
```

---

### Step 4: Check DynamoDB Records

```bash
# Count records in Project table
aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `Project-`)]' --output text | head -1) \
  --select COUNT

# Check GitCredential table (verify encryption)
aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `GitCredential-`)]' --output text | head -1) \
  --max-items 1
```

**Verify**:
- ✅ Records exist
- ✅ `encryptedToken` is base64 string (not plaintext)
- ✅ Does NOT start with `ghp_` or `github_pat_`

---

## Troubleshooting

### Issue: "Missing required environment variables"

**Cause**: TEST_REPO_URL or TEST_PAT not set

**Solution**:
```bash
# Make sure both are set
echo $TEST_REPO_URL
echo $TEST_PAT

# Re-run with explicit variables
TEST_REPO_URL="..." TEST_PAT="..." npm run test:git-integration
```

---

### Issue: "GraphQL request failed: 401 Unauthorized"

**Cause**: AppSync IAM authentication issue

**Solution**:
```bash
# Verify Lambda has AppSync permissions
aws iam get-role-policy \
  --role-name amplify-aiimplementationt-gitintegrationlambdaServi-cFswU07UTHTQ \
  --policy-name gitintegrationlambdaServiceRoleDefaultPolicy290EF936 \
  --query 'PolicyDocument.Statement[?Action==`appsync:GraphQL`]'
```

---

### Issue: "Repository not found or access denied"

**Cause**: Invalid GitHub token or insufficient permissions

**Solution**:
```bash
# Test token manually
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user

# Verify token has 'repo' scope
# Check at: https://github.com/settings/tokens
```

---

### Issue: "Invalid GitHub token or insufficient permissions"

**Cause**: Token expired or doesn't have `repo` scope

**Solution**:
1. Generate new token: https://github.com/settings/tokens
2. Select `repo` scope
3. Update TEST_PAT environment variable

---

### Issue: Test hangs at "Invoking connectRepository operation..."

**Cause**: Lambda timeout or network issue

**Solution**:
```bash
# Check Lambda logs for errors
aws logs tail "/aws/lambda/amplify-aiimplementationt-gitintegrationlambdaC102-orJPDEhJRm8j" \
  --since 5m

# Verify Lambda timeout is 300s
aws lambda get-function-configuration \
  --function-name amplify-aiimplementationt-gitintegrationlambdaC102-orJPDEhJRm8j \
  --query 'Timeout'
```

---

## Filling Out the Test Report

After running all tests:

1. Open `docs/tasks/mvp/epics/Epic-01-Test-Report.md`

2. Fill in the sections:
   - Test Environment (dates, versions)
   - Test Results (for each test scenario)
   - Performance Metrics (durations from output)
   - Data Integrity Verification (paste verify script output)
   - CloudWatch Logs (paste relevant logs)

3. Take screenshots:
   - Terminal output showing all tests passing
   - AWS Console - Lambda function details
   - AWS Console - DynamoDB table with records
   - CloudWatch logs showing successful execution

4. Complete the acceptance criteria checklist

5. Update the status: `**Status**: ✅ PASSED`

---

## Performance Benchmarks

Expected performance (approximate):

| Operation | Expected Duration |
|-----------|------------------|
| Project Creation | < 100ms |
| Repository Connection | 2-5s |
| Credential Encryption | < 50ms |
| List Branches (10) | 1-2s |
| List Branches (100+) | 3-5s |
| Branch Switch | < 500ms |
| Access Validation | 1-2s |
| **Total Test** | **10-20s** |

If significantly slower:
- Check network latency to AWS
- Check GitHub API rate limits
- Review Lambda CloudWatch metrics

---

## Security Checklist

Before marking Epic-01 complete, verify:

- [ ] ✅ All credentials encrypted with KMS
- [ ] ✅ No plaintext tokens in DynamoDB
- [ ] ✅ Lambda uses AppSync (no direct DynamoDB access)
- [ ] ✅ KMS key rotation enabled
- [ ] ✅ Least-privilege IAM permissions
- [ ] ✅ API key required for GraphQL operations
- [ ] ✅ No sensitive data in CloudWatch logs

---

## Cleaning Up Test Data (Optional)

If you want to remove test data after validation:

```bash
# List all projects
aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `Project-`)]' --output text | head -1) \
  --query 'Items[*].id.S' \
  --output text

# Delete specific project (this will cascade to related records)
# Use Amplify client to properly handle relationships
```

**Note**: For sandbox environments, data cleanup is optional.

---

## Next Steps After Successful Tests

1. **Mark Epic-01 as Complete**:
   - Update `docs/tasks/mvp/epics/Epic-01.md`
   - Set status to `✅ Complete`
   - Add completion date

2. **Commit Test Results**:
   ```bash
   git add docs/tasks/mvp/epics/Epic-01-Test-Report.md
   git commit -m "docs: Add Epic-01 test execution report"
   ```

3. **Tag Release**:
   ```bash
   git tag -a epic-01-complete -m "Epic 01: Project & Git Management Foundation - Complete"
   git push --tags
   ```

4. **Begin Epic-02**:
   - Repository Analysis
   - Monorepo detection
   - Workspace enumeration

---

## Support

If you encounter issues not covered in this guide:

1. Check CloudWatch logs for detailed error messages
2. Review Lambda environment variables
3. Verify IAM permissions
4. Check GitHub token validity
5. Ensure all infrastructure is deployed

---

**Happy Testing!** 🚀
