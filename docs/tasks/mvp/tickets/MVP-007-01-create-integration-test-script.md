# MVP-007-01: Create Integration Test Script

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 3  
**Estimated Time**: 1 hour  
**Status**: Todo  
**Priority**: High  
**Depends On**: MVP-006-01

---

## Objective

Create a comprehensive integration test script that validates the entire Git integration flow end-to-end, from project creation through repository connection, branch operations, and credential management.

---

## Implementation

### 1. Create Scripts Directory

```bash
# From project root
mkdir -p scripts
```

### 2. Create Test Script

Create `scripts/test-git-integration.ts`:

```typescript
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';

Amplify.configure(outputs);
const client = generateClient<Schema>();

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestConfig {
  projectName: string;
  repoUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  pat: string;
  username?: string;
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

function logStep(step: number, description: string) {
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`📋 Step ${step}: ${description}`);
  console.log('━'.repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.error(`❌ ${message}`);
}

function logInfo(key: string, value: any) {
  console.log(`   ${key}: ${JSON.stringify(value)}`);
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function testGitIntegration(config: TestConfig) {
  logSection('🚀 SpecForge Git Integration Test');
  
  console.log('Configuration:');
  logInfo('Project Name', config.projectName);
  logInfo('Repository URL', config.repoUrl);
  logInfo('Provider', config.provider);
  logInfo('Username', config.username || 'N/A');
  
  let projectId: string | undefined;
  let repositoryId: string | undefined;

  try {
    // ========================================================================
    // STEP 1: Create Project
    // ========================================================================
    
    logStep(1, 'Create Project');
    
    const projectResult = await client.models.Project.create({
      name: config.projectName,
      description: `Integration test for ${config.repoUrl}`,
    });

    if (!projectResult.data) {
      throw new Error('Failed to create project - no data returned');
    }

    projectId = projectResult.data.id;
    logSuccess(`Project created successfully`);
    logInfo('Project ID', projectId);

    // ========================================================================
    // STEP 2: Connect Repository
    // ========================================================================
    
    logStep(2, 'Connect Git Repository');
    
    console.log('Invoking connectRepository operation...');
    
    // Note: This assumes you have a custom query defined in your schema
    // You may need to add this to your schema's custom queries
    const connectResult = await fetch(outputs.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': outputs.data.api_key,
      },
      body: JSON.stringify({
        query: `
          query ConnectRepository($operation: String!, $data: AWSJSON!) {
            gitIntegrationOperation(operation: $operation, data: $data)
          }
        `,
        variables: {
          operation: 'connectRepository',
          data: JSON.stringify({
            projectId,
            provider: config.provider,
            repoUrl: config.repoUrl,
            credentialType: 'token',
            token: config.pat,
            username: config.username,
          }),
        },
      }),
    });

    const connectData = await connectResult.json();
    
    if (connectData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(connectData.errors)}`);
    }

    const connectResponse = JSON.parse(connectData.data.gitIntegrationOperation);
    
    if (!connectResponse.success) {
      throw new Error(`Connect failed: ${connectResponse.error?.message}`);
    }

    repositoryId = connectResponse.data.repositoryId;
    logSuccess('Repository connected successfully');
    logInfo('Repository ID', repositoryId);
    logInfo('Default Branch', connectResponse.data.defaultBranch);
    logInfo('Branch Count', connectResponse.data.branchCount);

    // ========================================================================
    // STEP 3: Verify Repository Record
    // ========================================================================
    
    logStep(3, 'Verify Repository Record');
    
    const repoResult = await client.models.GitRepository.get({ id: repositoryId });
    
    if (!repoResult.data) {
      throw new Error('Repository not found in database');
    }

    logSuccess('Repository record verified');
    logInfo('Provider', repoResult.data.provider);
    logInfo('Current Branch', repoResult.data.currentBranch);
    logInfo('Status', repoResult.data.status);
    logInfo('Cached Branches', repoResult.data.branches?.length || 0);

    // ========================================================================
    // STEP 4: List Branches
    // ========================================================================
    
    logStep(4, 'List Branches');
    
    const branchesResult = await fetch(outputs.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': outputs.data.api_key,
      },
      body: JSON.stringify({
        query: `
          query ListBranches($operation: String!, $data: AWSJSON!) {
            gitIntegrationOperation(operation: $operation, data: $data)
          }
        `,
        variables: {
          operation: 'listBranches',
          data: JSON.stringify({ repositoryId }),
        },
      }),
    });

    const branchesData = await branchesResult.json();
    
    if (branchesData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(branchesData.errors)}`);
    }

    const branchesResponse = JSON.parse(branchesData.data.gitIntegrationOperation);
    
    if (!branchesResponse.success) {
      throw new Error(`List branches failed: ${branchesResponse.error?.message}`);
    }

    logSuccess(`Found ${branchesResponse.data.total} branches`);
    logInfo('Current Branch', branchesResponse.data.currentBranch);
    
    if (branchesResponse.data.branches.length > 0) {
      console.log('\n   First 10 branches:');
      branchesResponse.data.branches.slice(0, 10).forEach((branch: string, i: number) => {
        console.log(`      ${i + 1}. ${branch}`);
      });
    }

    // ========================================================================
    // STEP 5: Switch Branch (if multiple branches exist)
    // ========================================================================
    
    if (branchesResponse.data.branches.length > 1) {
      logStep(5, 'Switch Branch');
      
      const targetBranch = branchesResponse.data.branches.find(
        (b: string) => b !== branchesResponse.data.currentBranch
      );

      if (targetBranch) {
        console.log(`Switching from '${branchesResponse.data.currentBranch}' to '${targetBranch}'...`);

        const switchResult = await fetch(outputs.data.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': outputs.data.api_key,
          },
          body: JSON.stringify({
            query: `
              query SwitchBranch($operation: String!, $data: AWSJSON!) {
                gitIntegrationOperation(operation: $operation, data: $data)
              }
            `,
            variables: {
              operation: 'switchBranch',
              data: JSON.stringify({
                repositoryId,
                branch: targetBranch,
              }),
            },
          }),
        });

        const switchData = await switchResult.json();
        
        if (switchData.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(switchData.errors)}`);
        }

        const switchResponse = JSON.parse(switchData.data.gitIntegrationOperation);
        
        if (!switchResponse.success) {
          throw new Error(`Switch branch failed: ${switchResponse.error?.message}`);
        }

        logSuccess(`Switched to branch: ${targetBranch}`);
        logInfo('Repository ID', switchResponse.data.repositoryId);
        logInfo('Current Branch', switchResponse.data.currentBranch);
      }
    } else {
      console.log('\n⏭️  Skipping branch switch (only one branch available)');
    }

    // ========================================================================
    // STEP 6: Validate Access
    // ========================================================================
    
    logStep(6, 'Validate Repository Access');
    
    const validateResult = await fetch(outputs.data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': outputs.data.api_key,
      },
      body: JSON.stringify({
        query: `
          query ValidateAccess($operation: String!, $data: AWSJSON!) {
            gitIntegrationOperation(operation: $operation, data: $data)
          }
        `,
        variables: {
          operation: 'validateAccess',
          data: JSON.stringify({ repositoryId }),
        },
      }),
    });

    const validateData = await validateResult.json();
    
    if (validateData.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(validateData.errors)}`);
    }

    const validateResponse = JSON.parse(validateData.data.gitIntegrationOperation);

    logSuccess('Access validation completed');
    logInfo('Has Access', validateResponse.data.hasAccess);
    logInfo('Message', validateResponse.data.message);
    logInfo('Provider', validateResponse.data.provider);

    // ========================================================================
    // TEST SUMMARY
    // ========================================================================
    
    logSection('🎉 All Tests Passed Successfully!');
    
    console.log('Test Summary:');
    logInfo('✅ Project Created', projectId);
    logInfo('✅ Repository Connected', repositoryId);
    logInfo('✅ Branches Listed', branchesResponse.data.total);
    logInfo('✅ Branch Switch', branchesResponse.data.branches.length > 1 ? 'Success' : 'Skipped');
    logInfo('✅ Access Validated', validateResponse.data.hasAccess);

    return {
      success: true,
      projectId,
      repositoryId,
      branchCount: branchesResponse.data.total,
    };

  } catch (error) {
    logSection('❌ Test Failed');
    
    logError(error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.log('\nTest Context:');
    if (projectId) logInfo('Project ID', projectId);
    if (repositoryId) logInfo('Repository ID', repositoryId);

    throw error;
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

const testConfig: TestConfig = {
  projectName: process.env.TEST_PROJECT_NAME || 'Git Integration Test',
  repoUrl: process.env.TEST_REPO_URL!,
  provider: (process.env.TEST_PROVIDER as any) || 'github',
  pat: process.env.TEST_PAT!,
  username: process.env.TEST_USERNAME,
};

// Validate required environment variables
if (!testConfig.repoUrl || !testConfig.pat) {
  console.error('❌ Missing required environment variables:\n');
  console.error('Required:');
  console.error('  TEST_REPO_URL     - Git repository URL (e.g., https://github.com/owner/repo)');
  console.error('  TEST_PAT          - Personal Access Token\n');
  console.error('Optional:');
  console.error('  TEST_PROVIDER     - Git provider (github, gitlab, bitbucket) [default: github]');
  console.error('  TEST_PROJECT_NAME - Project name [default: "Git Integration Test"]');
  console.error('  TEST_USERNAME     - Git username\n');
  console.error('Example:');
  console.error('  TEST_REPO_URL="https://github.com/user/repo" TEST_PAT="ghp_xxx" npm run test:git-integration');
  process.exit(1);
}

// Run tests
console.log('Starting SpecForge Git Integration Tests...\n');

testGitIntegration(testConfig)
  .then((result) => {
    console.log('\n✅ Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed!');
    process.exit(1);
  });
```

### 3. Add npm Script

Add to `package.json`:

```json
{
  "scripts": {
    "test:git-integration": "tsx scripts/test-git-integration.ts"
  }
}
```

### 4. Install tsx (TypeScript Executor)

```bash
npm install --save-dev tsx
```

---

## Usage

### Run Test

```bash
# Set environment variables and run
TEST_REPO_URL="https://github.com/your-username/your-repo" \
TEST_PAT="ghp_your_github_token" \
TEST_PROVIDER="github" \
TEST_PROJECT_NAME="My Test Project" \
npm run test:git-integration
```

### GitHub Personal Access Token

To get a GitHub PAT:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control)
4. Copy the token

---

## Acceptance Criteria

- [ ] Test script created and executable
- [ ] All 6 test steps implemented
- [ ] Environment variable validation
- [ ] Clear logging with emojis and formatting
- [ ] Error handling with stack traces
- [ ] Test summary at the end
- [ ] npm script added to package.json
- [ ] Documentation includes usage examples

---

## Expected Test Output

```
🚀 SpecForge Git Integration Test
================================================================================

Configuration:
   Project Name: "My Test Project"
   Repository URL: "https://github.com/user/repo"
   Provider: "github"
   Username: "N/A"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Step 1: Create Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Project created successfully
   Project ID: "abc123..."

... (more steps)

🎉 All Tests Passed Successfully!
================================================================================

Test Summary:
   ✅ Project Created: "abc123..."
   ✅ Repository Connected: "xyz789..."
   ✅ Branches Listed: 15
   ✅ Branch Switch: "Success"
   ✅ Access Validated: true
```

---

## Troubleshooting

### Issue: Cannot find module 'amplify_outputs.json'

**Solution**: Ensure Amplify sandbox is running and has generated the outputs file:
```bash
npx ampx sandbox
```

### Issue: GraphQL Operation Not Found

**Solution**: You need to add a custom query to your schema. Add to `amplify/data/resource.ts`:

```typescript
const schema = a.schema({
  // ... existing models ...
  
}).authorization(allow => [allow.publicApiKey()]);

// Add custom query for Lambda invocation
const gitIntegrationOperation = a
  .query()
  .arguments({
    operation: a.string().required(),
    data: a.json().required(),
  })
  .returns(a.json())
  .handler(
    a.handler.function('gitIntegration')
  )
  .authorization(allow => [allow.publicApiKey()]);
```

### Issue: Authentication Failed

**Solution**: Verify your GitHub token has `repo` scope:
```bash
# Test token manually
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

---

## Next Ticket

MVP-008-01: Execute End-to-End Integration Tests
