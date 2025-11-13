# Epic 01: Project & Git Management Foundation

## Overview
Establish the foundational infrastructure for SpecForge, including the complete data model in Amplify, Git integration capabilities, credential management, and testing infrastructure.

**Stage**: Stage 1 - Project & Git Management  
**Duration**: 3 days  
**Priority**: Critical (Blocking)  
**Status**: Todo

---

## Objectives

1. ✅ Deploy complete Amplify data model with all entities
2. ✅ Set up SSM Parameter Store for Lambda configuration
3. ✅ Implement git-integration Lambda function
4. ✅ Create secure credential encryption with KMS
5. ✅ Build testing infrastructure and scripts
6. ✅ Validate end-to-end Git operations

---

## Data Model Implementation

### Current State
The existing `amplify/data/resource.ts` has a simplified schema with only:
- Project (basic)
- Specification (simplified)
- Ticket (simplified)

### Target State
Full schema from MVP plan including:

#### Core Entities
- **Project**: Base project entity
- **GitRepository**: Git provider integration
- **GitCredential**: Encrypted credential storage

#### Workspace Entities
- **Workspace**: Monorepo/single-repo workspace
- **MonorepoStructure**: Monorepo configuration
- **MonorepoDependency**: Workspace dependencies

#### Context Entities
- **Context**: Code context for AI
- **SpecificationContext**: Link contexts to specifications

#### Specification Entities
- **SpecificationType**: Customizable spec templates
- **Specification**: Main specification entity
- **Epic**: High-level work breakdown
- **Ticket**: Atomic implementation tasks
- **TicketDependency**: Task dependencies

### Implementation Steps
1. Backup current schema
2. Replace with complete schema from MVP plan
3. Deploy with `npx ampx sandbox`
4. Verify all models are created
5. Test relationships with sample data

---

## SSM Parameter Store Configuration

### Overview

SSM parameters will be created and managed through Amplify's backend configuration in `amplify/backend.ts`. This ensures parameters are automatically created during deployment and properly scoped to the Amplify environment.

### Required Parameters

```typescript
// Parameter naming convention: /amplify/{appId}/{branchName}/{parameter}
// Amplify automatically prefixes parameters with /amplify/{appId}/{branchName}/

const SSM_PARAMETERS = {
  // AppSync Configuration (auto-populated by Amplify)
  // Access via: backend.data.resources.graphqlApi.apiId
  // Access via: backend.data.resources.graphqlApi.apiEndpoint
  
  // Lambda Configuration
  GIT_INTEGRATION_TIMEOUT: 300, // seconds
  MAX_REPO_SIZE_MB: 500,
  
  // Git Provider Configuration
  GITHUB_API_VERSION: '2022-11-28',
  GITLAB_API_VERSION: 'v4',
  BITBUCKET_API_VERSION: '2.0',
};
```

### Implementation in backend.ts

Update `amplify/backend.ts`:

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { Key } from 'aws-cdk-lib/aws-kms';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
});

// Grant Lambda permission to invoke AppSync
// This automatically injects the AppSync endpoint as an environment variable
// AND grants all necessary DynamoDB permissions via AppSync
backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.gitIntegration.resources.lambda);
```

### How Amplify Auto-Injection Works

**The Magic of `grant*` Methods:**

1. **Dependency-Safe Order**: 
   - CloudFormation creates the AppSync API first
   - Once complete, AWS provides the physical AppSync endpoint URL
   - The Lambda function is created second, with the URL injected automatically

2. **Automatic Environment Variables**:
   When you call `grantMutation()` or `grantQuery()`, Amplify automatically:
   - ✅ Injects `API_<APINAME>_GRAPHQLAPIENDPOINTOUTPUT` environment variable
   - ✅ Injects `API_<APINAME>_GRAPHQLAPIIDOUTPUT` environment variable
   - ✅ Creates IAM permissions for the Lambda to call AppSync
   - ✅ **Grants all necessary DynamoDB permissions** (Lambda accesses data through AppSync, not directly!)
   - ✅ Establishes CloudFormation dependency order

3. **No Manual Configuration Needed**:
   ```typescript
   // ❌ You DON'T need to do this:
   backend.gitIntegration.resources.lambda.addEnvironment(
     'APPSYNC_API_ENDPOINT',
     backend.data.resources.graphqlApi.graphqlUrl
   );
   
   // ✅ Amplify does it automatically via grant* methods!
   backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
   ```

4. **Accessing in Lambda**:
   The environment variable name follows the pattern `API_<APINAME>_GRAPHQLAPIENDPOINTOUTPUT`:
   ```typescript
   // In your Lambda handler (API name: specForgeDataAPI):
   const appsyncEndpoint = process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT;
   const appsyncApiId = process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT;
   ```

---

## KMS Key Setup

### Overview

KMS key will be created and managed through Amplify's backend configuration in `amplify/backend.ts`. This ensures the key is properly scoped, permissions are automatically configured, and the Lambda can access it.

### Implementation in backend.ts

Add to `amplify/backend.ts` (after DynamoDB IAM permissions):

```typescript
// NOTE: Import already added at top of file
// import { Key } from 'aws-cdk-lib/aws-kms';

// Create KMS key for Git credential encryption
const gitCredentialKey = new Key(
  backend.gitIntegration.resources.lambda,
  'GitCredentialEncryptionKey',
  {
    description: 'SpecForge - Git credential encryption key',
    enableKeyRotation: true,
  }
);

// Grant Lambda permissions to use the KMS key
gitCredentialKey.grantEncryptDecrypt(backend.gitIntegration.resources.lambda);

// Add KMS key ID as environment variable for Lambda
backend.gitIntegration.resources.lambda.addEnvironment(
  'KMS_KEY_ID',
  gitCredentialKey.keyId
);
```

**Note**: This approach works because:
- KMS key is created AFTER `defineBackend()` completes
- We're using the L2 CDK construct which handles dependencies automatically
- No circular dependency since we're extending existing resources, not defining new ones

### Benefits of Amplify-Managed KMS

1. **Automatic Key Rotation**: Enabled by default for security
2. **Proper IAM Policies**: Lambda automatically gets encrypt/decrypt permissions
3. **Environment Variables**: Key ID is injected into Lambda environment
4. **No Manual Setup**: Key is created during Amplify deployment
5. **Cleanup**: Key is properly managed when environment is destroyed

---

## Lambda Function: git-integration

### Directory Structure

```
amplify/functions/git-integration/
├── handler.ts                 # Main Lambda handler
├── resource.ts               # Amplify function definition
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── lib/
│   ├── appsync-client.ts     # AppSync GraphQL client
│   ├── ssm-config.ts         # SSM parameter retrieval
│   ├── kms-encryption.ts     # KMS encrypt/decrypt
│   ├── git-providers/
│   │   ├── base.ts           # Base Git provider interface
│   │   ├── github.ts         # GitHub implementation
│   │   ├── gitlab.ts         # GitLab implementation
│   │   └── bitbucket.ts      # Bitbucket implementation
│   └── types.ts              # TypeScript types
└── graphql/
    ├── queries.ts            # GraphQL queries
    └── mutations.ts          # GraphQL mutations
```

### Function Definition

`amplify/functions/git-integration/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const gitIntegration = defineFunction({
  name: 'git-integration',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  environment: {
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  },
});
```

### Main Handler

`amplify/functions/git-integration/handler.ts`:

```typescript
import { AppSyncClient } from './lib/appsync-client';
import { KMSEncryption } from './lib/kms-encryption';
import { GitProviderFactory } from './lib/git-providers/factory';
import type { GitIntegrationEvent, GitIntegrationResponse } from './lib/types';

let appsyncClient: AppSyncClient;
let kmsEncryption: KMSEncryption;

async function initialize() {
  if (!appsyncClient) {
    // Environment variables automatically injected by Amplify via grant* methods
    // API name: specForgeDataAPI (from amplify/data/resource.ts)
    const appsyncEndpoint = process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!;
    
    // KMS key ID injected manually via addEnvironment in backend.ts
    const kmsKeyId = process.env.KMS_KEY_ID!;
    
    appsyncClient = new AppSyncClient(appsyncEndpoint);
    kmsEncryption = new KMSEncryption(kmsKeyId);
  }
}

export const handler = async (event: GitIntegrationEvent): Promise<GitIntegrationResponse> => {
  console.log('Git Integration Lambda invoked:', JSON.stringify(event, null, 2));

  try {
    await initialize();

    const { operation, data } = event.arguments;

    switch (operation) {
      case 'connectRepository':
        return await connectRepository(data);
      
      case 'listBranches':
        return await listBranches(data.repositoryId);
      
      case 'switchBranch':
        return await switchBranch(data.repositoryId, data.branch);
      
      case 'updateCredential':
        return await updateCredential(data);
      
      case 'validateAccess':
        return await validateAccess(data.repositoryId);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error in git-integration Lambda:', error);
    throw error;
  }
};

async function connectRepository(data: any): Promise<GitIntegrationResponse> {
  const { projectId, provider, repoUrl, credentialType, token, username } = data;

  console.log(`Connecting repository: ${repoUrl} (${provider})`);

  // Encrypt credential
  const encryptedToken = await kmsEncryption.encrypt(token);

  // Create GitRepository record
  const repository = await appsyncClient.createGitRepository({
    projectId,
    provider,
    repoUrl,
    currentBranch: 'main', // Will be detected later
    status: 'pending',
  });

  // Create GitCredential record
  await appsyncClient.createGitCredential({
    repositoryId: repository.id,
    type: credentialType,
    encryptedToken,
    username,
  });

  // Test connection
  const gitProvider = GitProviderFactory.create(provider);
  const decryptedToken = await kmsEncryption.decrypt(encryptedToken);
  
  try {
    const defaultBranch = await gitProvider.getDefaultBranch(repoUrl, decryptedToken);
    const branches = await gitProvider.listBranches(repoUrl, decryptedToken);

    // Update repository with branch info
    await appsyncClient.updateGitRepository({
      id: repository.id,
      currentBranch: defaultBranch,
      branches: branches.slice(0, 100), // Cache first 100
      status: 'ready',
      lastSyncedAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        repositoryId: repository.id,
        defaultBranch,
        branchCount: branches.length,
      },
    };
  } catch (error) {
    // Update status to error
    await appsyncClient.updateGitRepository({
      id: repository.id,
      status: 'error',
    });

    throw new Error(`Failed to connect to repository: ${error.message}`);
  }
}

async function listBranches(repositoryId: string): Promise<GitIntegrationResponse> {
  console.log(`Listing branches for repository: ${repositoryId}`);

  // Get repository
  const repository = await appsyncClient.getGitRepository(repositoryId);
  
  // Get credentials
  const credential = await appsyncClient.getGitCredential(repositoryId);
  const decryptedToken = await kmsEncryption.decrypt(credential.encryptedToken);

  // Get branches from provider
  const gitProvider = GitProviderFactory.create(repository.provider);
  const branches = await gitProvider.listBranches(repository.repoUrl, decryptedToken);

  // Update cached branches
  await appsyncClient.updateGitRepository({
    id: repositoryId,
    branches: branches.slice(0, 100),
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      branches,
      total: branches.length,
    },
  };
}

async function switchBranch(repositoryId: string, branch: string): Promise<GitIntegrationResponse> {
  console.log(`Switching to branch: ${branch} for repository: ${repositoryId}`);

  // Get repository
  const repository = await appsyncClient.getGitRepository(repositoryId);
  
  // Get credentials
  const credential = await appsyncClient.getGitCredential(repositoryId);
  const decryptedToken = await kmsEncryption.decrypt(credential.encryptedToken);

  // Verify branch exists
  const gitProvider = GitProviderFactory.create(repository.provider);
  const branchExists = await gitProvider.branchExists(repository.repoUrl, branch, decryptedToken);

  if (!branchExists) {
    throw new Error(`Branch '${branch}' does not exist`);
  }

  // Update current branch
  await appsyncClient.updateGitRepository({
    id: repositoryId,
    currentBranch: branch,
  });

  return {
    success: true,
    data: {
      repositoryId,
      currentBranch: branch,
    },
  };
}

async function updateCredential(data: any): Promise<GitIntegrationResponse> {
  const { repositoryId, token, username } = data;

  console.log(`Updating credentials for repository: ${repositoryId}`);

  // Encrypt new token
  const encryptedToken = await kmsEncryption.encrypt(token);

  // Update credential
  await appsyncClient.updateGitCredential({
    repositoryId,
    encryptedToken,
    username,
  });

  return {
    success: true,
    data: {
      repositoryId,
      message: 'Credentials updated successfully',
    },
  };
}

async function validateAccess(repositoryId: string): Promise<GitIntegrationResponse> {
  console.log(`Validating access for repository: ${repositoryId}`);

  // Get repository and credentials
  const repository = await appsyncClient.getGitRepository(repositoryId);
  const credential = await appsyncClient.getGitCredential(repositoryId);
  const decryptedToken = await kmsEncryption.decrypt(credential.encryptedToken);

  // Test access
  const gitProvider = GitProviderFactory.create(repository.provider);
  
  try {
    await gitProvider.validateAccess(repository.repoUrl, decryptedToken);
    
    return {
      success: true,
      data: {
        repositoryId,
        hasAccess: true,
        message: 'Access validated successfully',
      },
    };
  } catch (error) {
    return {
      success: false,
      data: {
        repositoryId,
        hasAccess: false,
        message: error.message,
      },
    };
  }
}
```

### Supporting Libraries

Key files to implement:

1. **`lib/appsync-client.ts`**: GraphQL client for AppSync operations
2. **`lib/kms-encryption.ts`**: KMS encrypt/decrypt utilities (uses env.KMS_KEY_ID)
3. **`lib/git-providers/github.ts`**: GitHub API integration
4. **`lib/git-providers/gitlab.ts`**: GitLab API integration
5. **`lib/git-providers/bitbucket.ts`**: Bitbucket API integration

**Note on Environment Variables:**
- `API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT` - Automatically injected by Amplify via `grant*` methods
- `API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT` - Automatically injected by Amplify via `grant*` methods  
- `KMS_KEY_ID` - Manually added via `backend.gitIntegration.resources.lambda.addEnvironment()` in backend.ts

---

## Testing Infrastructure

### Test Script

Create `scripts/test-git-integration.ts`:

```typescript
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';

Amplify.configure(outputs);
const client = generateClient<Schema>();

interface TestConfig {
  projectName: string;
  repoUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  pat: string;
  username?: string;
}

async function testGitIntegration(config: TestConfig) {
  console.log('🚀 Starting Git Integration Test\n');
  console.log('Configuration:', {
    projectName: config.projectName,
    repoUrl: config.repoUrl,
    provider: config.provider,
    username: config.username || 'N/A',
  });
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Step 1: Create Project
    console.log('📦 Step 1: Creating project...');
    const project = await client.models.Project.create({
      name: config.projectName,
      description: `Test project for ${config.repoUrl}`,
    });
    console.log(`✅ Project created: ${project.data?.id}`);
    console.log('');

    // Step 2: Connect Repository
    console.log('🔗 Step 2: Connecting repository...');
    const connectResult = await client.queries.gitIntegrationOperation({
      operation: 'connectRepository',
      data: {
        projectId: project.data!.id,
        provider: config.provider,
        repoUrl: config.repoUrl,
        credentialType: 'token',
        token: config.pat,
        username: config.username,
      },
    });
    
    console.log('✅ Repository connected:', connectResult.data);
    const repositoryId = connectResult.data?.repositoryId;
    console.log('');

    // Step 3: List Branches
    console.log('🌿 Step 3: Listing branches...');
    const branchesResult = await client.queries.gitIntegrationOperation({
      operation: 'listBranches',
      data: {
        repositoryId,
      },
    });
    
    console.log(`✅ Found ${branchesResult.data?.total} branches`);
    console.log('First 10 branches:', branchesResult.data?.branches.slice(0, 10));
    console.log('');

    // Step 4: Validate Access
    console.log('🔐 Step 4: Validating access...');
    const validateResult = await client.queries.gitIntegrationOperation({
      operation: 'validateAccess',
      data: {
        repositoryId,
      },
    });
    
    console.log('✅ Access validation:', validateResult.data);
    console.log('');

    // Step 5: Switch Branch (if multiple branches exist)
    if (branchesResult.data?.branches.length! > 1) {
      const targetBranch = branchesResult.data?.branches[1];
      console.log(`🔄 Step 5: Switching to branch: ${targetBranch}...`);
      
      const switchResult = await client.queries.gitIntegrationOperation({
        operation: 'switchBranch',
        data: {
          repositoryId,
          branch: targetBranch,
        },
      });
      
      console.log('✅ Branch switched:', switchResult.data);
      console.log('');
    }

    // Step 6: Verify Repository Record
    console.log('📊 Step 6: Verifying repository record...');
    const repository = await client.models.GitRepository.get({ id: repositoryId });
    console.log('Repository details:', {
      id: repository.data?.id,
      provider: repository.data?.provider,
      repoUrl: repository.data?.repoUrl,
      currentBranch: repository.data?.currentBranch,
      status: repository.data?.status,
      branchCount: repository.data?.branches?.length,
    });
    console.log('');

    console.log('='.repeat(60));
    console.log('🎉 All tests passed successfully!');
    console.log('='.repeat(60));

    return {
      success: true,
      projectId: project.data?.id,
      repositoryId,
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
const testConfig: TestConfig = {
  projectName: process.env.TEST_PROJECT_NAME || 'Test Project',
  repoUrl: process.env.TEST_REPO_URL!,
  provider: (process.env.TEST_PROVIDER as any) || 'github',
  pat: process.env.TEST_PAT!,
  username: process.env.TEST_USERNAME,
};

if (!testConfig.repoUrl || !testConfig.pat) {
  console.error('❌ Missing required environment variables:');
  console.error('  TEST_REPO_URL - Git repository URL');
  console.error('  TEST_PAT - Personal Access Token');
  console.error('  TEST_PROVIDER - git provider (github, gitlab, or bitbucket)');
  console.error('\nOptional:');
  console.error('  TEST_PROJECT_NAME - Project name');
  console.error('  TEST_USERNAME - Git username');
  process.exit(1);
}

testGitIntegration(testConfig)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

### Usage

```bash
# Run test
TEST_REPO_URL="https://github.com/user/repo" \
TEST_PAT="ghp_xxxxxxxxxxxx" \
TEST_PROVIDER="github" \
npm run test:git-integration
```

---

## Acceptance Criteria

### Data Model
- [ ] All 14 models from MVP plan are defined in schema
- [ ] All relationships are correctly configured
- [ ] Schema deploys without errors
- [ ] Can query and mutate all models via AppSync

### Backend Configuration
- [ ] KMS key is created via backend.ts
- [ ] Lambda is registered in backend.ts
- [ ] Lambda has AppSync permissions via grantMutation/grantQuery
- [ ] Lambda has environment variables auto-injected (AppSync endpoint, API ID)
- [ ] Lambda has KMS key ID environment variable
- [ ] All infrastructure deploys successfully with `npx ampx sandbox`

### Lambda Function
- [ ] Function deploys successfully
- [ ] All operations are implemented:
  - [ ] connectRepository
  - [ ] listBranches
  - [ ] switchBranch
  - [ ] updateCredential
  - [ ] validateAccess
- [ ] Credentials are encrypted/decrypted correctly
- [ ] AppSync client works properly
- [ ] Error handling is robust

### Git Providers
- [ ] GitHub integration works
- [ ] GitLab integration works (stretch)
- [ ] Bitbucket integration works (stretch)

### Testing
- [ ] Test script runs successfully
- [ ] All test steps pass
- [ ] Can connect to real repository
- [ ] Can list branches
- [ ] Can switch branches
- [ ] Can validate access

---

## Implementation Checklist

### Day 1: Data Model & Infrastructure
- [ ] Backup current schema
- [ ] Implement full schema from MVP plan
- [ ] Deploy schema with Amplify
- [ ] Update backend.ts with KMS key configuration
- [ ] Update backend.ts with Lambda registration and AppSync grants
- [ ] Deploy backend configuration
- [ ] Verify all infrastructure is in place
- [ ] Verify environment variables are auto-injected in Lambda

### Day 2: Lambda Implementation
- [ ] Create Lambda directory structure
- [ ] Implement resource.ts
- [ ] Implement main handler.ts
- [ ] Implement AppSync client library
- [ ] Implement KMS encryption library
- [ ] Implement GitHub provider
- [ ] Implement supporting types
- [ ] Add Lambda to backend.ts
- [ ] Deploy Lambda function
- [ ] Verify environment variables in Lambda console
- [ ] Test Lambda with sample events

### Day 3: Testing & Validation
- [ ] Create test script
- [ ] Test with GitHub repository
- [ ] Test all operations
- [ ] Document any issues
- [ ] Fix bugs
- [ ] Update documentation
- [ ] Create demo video/screenshots
- [ ] Mark Epic as complete

---

## Dependencies

### External
- AWS Amplify Gen 2
- AWS SDK (SSM, KMS)
- GitHub/GitLab/Bitbucket APIs
- TypeScript

### Internal
None (This is the foundation)

---

## Risks & Mitigations

### Risk 1: Schema Migration Issues
**Mitigation**: Keep backup of current schema, test in sandbox first

### Risk 2: KMS Permission Issues
**Mitigation**: Use Amplify's built-in KMS integration, grant explicit permissions

### Risk 3: Git Provider API Rate Limits
**Mitigation**: Implement caching, respect rate limit headers

### Risk 4: Token Encryption Overhead
**Mitigation**: Cache decrypted tokens per Lambda execution context

---

## Success Metrics

- ✅ Schema deploys successfully
- ✅ All 5 Lambda operations work end-to-end
- ✅ Test script passes with real repository
- ✅ Credentials are properly encrypted
- ✅ Can connect to GitHub repository
- ✅ Zero data model errors in logs

---

## Notes

- Focus on GitHub provider first; GitLab and Bitbucket are stretch goals
- Use Amplify sandbox for rapid iteration
- Keep Lambda function under 512MB memory
- Document all SSM parameters for team reference
- Consider Lambda layers for shared dependencies in future

---

## Related Documents

- [MVP Plan](../plan/mvp-plan.md)
- [Data Model Schema](../../../amplify/data/resource.ts)
- Lambda source: `amplify/functions/git-integration/`
- Test script: `scripts/test-git-integration.ts`
