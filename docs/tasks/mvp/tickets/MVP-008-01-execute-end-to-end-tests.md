# MVP-008-01: Execute End-to-End Integration Tests

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 3  
**Estimated Time**: 1 hour  
**Status**: Todo  
**Priority**: High  
**Depends On**: MVP-007-01

---

## Objective

Execute the complete integration test suite with a real GitHub repository, document all results, capture screenshots/logs, and verify that Epic-01 is fully complete and functional.

---

## Prerequisites

### 1. GitHub Repository Access

You need a GitHub repository and Personal Access Token:

- **Repository**: Any GitHub repo you have access to (can be a test repo)
- **Token**: GitHub PAT with `repo` scope
  - Get token: https://github.com/settings/tokens
  - Required scope: `repo` (Full control of private repositories)

### 2. Amplify Sandbox Running

```bash
# Ensure sandbox is running
npx ampx sandbox

# Verify outputs file exists
ls amplify_outputs.json
```

### 3. Lambda Deployed

```bash
# Verify Lambda exists
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName'
```

---

## Test Execution

### Test 1: Basic Repository Connection

```bash
# Test with a public repository
TEST_REPO_URL="https://github.com/aws-amplify/amplify-js" \
TEST_PAT="your_github_token_here" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - Amplify JS" \
npm run test:git-integration
```

**Expected Result**: ✅ All steps pass

**Capture**:
- Screenshot of terminal output
- Copy CloudWatch logs
- Note: Project ID, Repository ID, Branch count

### Test 2: Private Repository

```bash
# Test with your own private repository
TEST_REPO_URL="https://github.com/your-username/private-repo" \
TEST_PAT="your_github_token_here" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - Private Repo" \
npm run test:git-integration
```

**Expected Result**: ✅ All steps pass

**Verify**:
- Credentials are encrypted in database
- Branch switch works correctly
- Access validation succeeds

### Test 3: Repository with Multiple Branches

```bash
# Test with a repo that has many branches
TEST_REPO_URL="https://github.com/facebook/react" \
TEST_PAT="your_github_token_here" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="Test - React Repo" \
npm run test:git-integration
```

**Expected Result**: ✅ All steps pass

**Verify**:
- Lists all branches correctly
- Branch switching between different branches works
- Caches up to 100 branches

---

## Verification Checklist

### Infrastructure Verification

```bash
# 1. Check DynamoDB for created records
aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `Project`)]' --output text) \
  --max-items 5

# 2. Verify encrypted credentials in GitCredential table
aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `GitCredential`)]' --output text) \
  --max-items 5

# 3. Check CloudWatch logs
aws logs tail "/aws/lambda/$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text)" \
  --since 10m \
  --follow
```

### Data Integrity Verification

```bash
# Create verification script
cat > scripts/verify-data.ts << 'EOF'
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function verifyData() {
  console.log('Verifying data integrity...\n');

  // List all projects
  const projects = await client.models.Project.list();
  console.log(`✅ Projects: ${projects.data.length}`);
  
  projects.data.forEach(p => {
    console.log(`   - ${p.name} (${p.id})`);
  });

  // List all repositories
  const repos = await client.models.GitRepository.list();
  console.log(`\n✅ Git Repositories: ${repos.data.length}`);
  
  repos.data.forEach(r => {
    console.log(`   - ${r.repoUrl}`);
    console.log(`     Provider: ${r.provider}`);
    console.log(`     Branch: ${r.currentBranch}`);
    console.log(`     Status: ${r.status}`);
    console.log(`     Branches cached: ${r.branches?.length || 0}`);
  });

  // List all credentials (without showing encrypted data)
  const creds = await client.models.GitCredential.list();
  console.log(`\n✅ Git Credentials: ${creds.data.length}`);
  
  creds.data.forEach(c => {
    console.log(`   - Repository ID: ${c.repositoryId}`);
    console.log(`     Type: ${c.type}`);
    console.log(`     Username: ${c.username || 'N/A'}`);
    console.log(`     Encrypted: ${c.encryptedToken ? 'Yes (KMS)' : 'No'}`);
  });
}

verifyData().then(() => {
  console.log('\n✅ Data verification complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
EOF

# Run verification
npx tsx scripts/verify-data.ts
```

---

## Security Verification

### 1. Verify KMS Encryption

```bash
# Get a credential record
CRED_ID=$(aws dynamodb scan \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `GitCredential`)]' --output text) \
  --max-items 1 \
  --query 'Items[0].id.S' \
  --output text)

# Get encrypted token (should be base64 encoded ciphertext)
aws dynamodb get-item \
  --table-name $(aws dynamodb list-tables --query 'TableNames[?contains(@, `GitCredential`)]' --output text) \
  --key "{\"id\": {\"S\": \"$CRED_ID\"}}" \
  --query 'Item.encryptedToken.S' \
  --output text

# Verify it's not plaintext (should be base64 encoded)
```

**Expected**: Encrypted token is base64 string, NOT plaintext token

### 2. Verify IAM Permissions

```bash
# Lambda should NOT have direct DynamoDB permissions
ROLE_NAME=$(aws lambda get-function-configuration \
  --function-name $(aws lambda list-functions --query 'Functions[?contains(FunctionName, `git-integration`)].FunctionName' --output text) \
  --query 'Role' --output text | xargs basename)

aws iam list-attached-role-policies --role-name "$ROLE_NAME"

# Should NOT include AmazonDynamoDBFullAccess or similar
# Should include policies for AppSync, KMS, CloudWatch
```

---

## Documentation

### Create Test Report

Create `docs/tasks/mvp/epics/Epic-01-Test-Report.md`:

```markdown
# Epic-01 Test Report

**Date**: [Current Date]
**Epic**: Epic-01 - Project & Git Management Foundation
**Status**: ✅ PASSED

---

## Test Environment

- **AWS Region**: [Your region]
- **Amplify Environment**: Sandbox
- **Lambda Version**: [Check with `aws lambda get-function --function-name ...`]
- **Node.js Version**: [Check with `node --version`]

---

## Test Results

### Test 1: Public Repository (amplify-js)

- **Status**: ✅ PASSED
- **Duration**: [X seconds]
- **Project ID**: [ID]
- **Repository ID**: [ID]
- **Branches Found**: [Count]
- **Screenshots**: [Link or attach]

**Operations Verified**:
- ✅ Project creation
- ✅ Repository connection
- ✅ Credential encryption
- ✅ Branch listing
- ✅ Branch switching
- ✅ Access validation

### Test 2: Private Repository

- **Status**: ✅ PASSED
- **Duration**: [X seconds]
- **Project ID**: [ID]
- **Repository ID**: [ID]
- **Branches Found**: [Count]

### Test 3: Multi-Branch Repository (react)

- **Status**: ✅ PASSED
- **Duration**: [X seconds]
- **Branches Found**: [Count]
- **Branch Caching**: ✅ First 100 cached

---

## Infrastructure Validation

### DynamoDB Tables
- ✅ All 14 tables created
- ✅ Records successfully written
- ✅ Relationships working correctly

### Lambda Function
- ✅ Timeout: 300s
- ✅ Memory: 512MB
- ✅ Environment variables: All present
- ✅ Logs: Clean, no errors

### KMS Encryption
- ✅ Key created with rotation enabled
- ✅ Credentials encrypted successfully
- ✅ Decryption working correctly

### AppSync API
- ✅ GraphQL endpoint accessible
- ✅ Mutations working
- ✅ Queries working
- ✅ IAM permissions correct

---

## Security Verification

- ✅ Credentials encrypted with KMS
- ✅ No plaintext tokens in database
- ✅ Lambda uses AppSync (no direct DynamoDB)
- ✅ Least-privilege IAM permissions
- ✅ KMS key rotation enabled

---

## Performance Metrics

| Operation | Duration | Status |
|-----------|----------|--------|
| Project Creation | [X]ms | ✅ |
| Repository Connection | [X]s | ✅ |
| Credential Encryption | [X]ms | ✅ |
| List Branches (10 branches) | [X]s | ✅ |
| List Branches (100+ branches) | [X]s | ✅ |
| Branch Switch | [X]ms | ✅ |
| Access Validation | [X]s | ✅ |

---

## Issues Found

[None / List any issues discovered]

---

## Recommendations

1. [Any recommendations for improvements]
2. [Performance optimizations]
3. [Additional test scenarios]

---

## Sign-off

**Epic-01 Status**: ✅ COMPLETE

All acceptance criteria met:
- ✅ Schema deployed with 14 models
- ✅ Lambda function operational
- ✅ KMS encryption working
- ✅ All 5 operations functional
- ✅ GitHub integration verified
- ✅ Security validated
- ✅ Tests passing

**Ready for**: Epic-02 (Repository Analysis)
```

---

## Acceptance Criteria

- [ ] All 3 test scenarios executed successfully
- [ ] CloudWatch logs captured and reviewed
- [ ] Data integrity verified in DynamoDB
- [ ] Security measures validated
- [ ] Test report documented
- [ ] Screenshots captured
- [ ] Performance metrics recorded
- [ ] No errors or warnings
- [ ] Epic-01 marked as complete

---

## Success Metrics

✅ **All Operations Working**
- Project creation: ✅
- Repository connection: ✅
- Branch listing: ✅
- Branch switching: ✅
- Credential management: ✅
- Access validation: ✅

✅ **Security Validated**
- KMS encryption: ✅
- IAM permissions: ✅
- No plaintext credentials: ✅

✅ **Performance Acceptable**
- Operations complete in reasonable time
- No timeouts or throttling
- Logs clean and informative

---

## Epic Completion

After successful test execution:

1. **Update Epic-01.md**:
   ```markdown
   **Status**: ✅ Complete
   **Completion Date**: [Date]
   ```

2. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: Complete Epic-01 - Git Integration Foundation"
   git push
   ```

3. **Tag Release**:
   ```bash
   git tag -a epic-01-complete -m "Epic 01: Project & Git Management Foundation"
   git push --tags
   ```

---

## Next Steps

With Epic-01 complete, the foundation is ready for:

- **Epic-02**: Repository Analysis (monorepo detection, workspace enumeration)
- **Epic-03**: Context Management (code analysis, context creation)
- **Epic-04**: Specification Generation (Bedrock integration)

---

## Notes

- Keep test GitHub token secure (do not commit)
- Test report serves as acceptance documentation
- Screenshots are valuable for future reference
- CloudWatch logs help with troubleshooting

---

## Troubleshooting Test Failures

### Test Fails at Step 1 (Create Project)

**Check**:
- Amplify sandbox is running
- `amplify_outputs.json` exists
- AppSync API is accessible

### Test Fails at Step 2 (Connect Repository)

**Check**:
- GitHub token is valid and has `repo` scope
- Repository URL is correct format
- Lambda has KMS permissions

### Test Fails at Step 4 (List Branches)

**Check**:
- Repository has branches
- GitHub API rate limits not exceeded
- Credentials decryption working

---

**Epic-01 Complete** ✅
