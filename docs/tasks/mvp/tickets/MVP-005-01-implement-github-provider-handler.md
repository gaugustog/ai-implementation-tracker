# MVP-005-01: Implement GitHub Provider and Main Handler

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 2  
**Estimated Time**: 2.5 hours  
**Status**: Todo  
**Priority**: High  
**Depends On**: MVP-004-01

---

## Objective

Implement the GitHub provider with all Git operations (list branches, validate access, etc.) and create the main Lambda handler that orchestrates all operations.

---

## Implementation

### 1. GitHub Provider Implementation

Create `amplify/functions/git-integration/lib/git-providers/github.ts`:

```typescript
import { Octokit } from '@octokit/rest';
import type { IGitProvider } from './base';

export class GitHubProvider implements IGitProvider {
  /**
   * Parse GitHub repository URL to extract owner and repo
   */
  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    try {
      // Handle different URL formats:
      // - https://github.com/owner/repo
      // - https://github.com/owner/repo.git
      // - git@github.com:owner/repo.git
      
      let url = repoUrl;
      
      // Convert SSH to HTTPS format for parsing
      if (url.startsWith('git@github.com:')) {
        url = url.replace('git@github.com:', 'https://github.com/');
      }
      
      // Remove .git suffix
      url = url.replace(/\.git$/, '');
      
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      
      if (pathParts.length < 2) {
        throw new Error('Invalid GitHub repository URL format');
      }
      
      return {
        owner: pathParts[0],
        repo: pathParts[1],
      };
    } catch (error) {
      throw new Error(`Failed to parse GitHub URL: ${repoUrl}. Error: ${error.message}`);
    }
  }

  /**
   * Create authenticated Octokit client
   */
  private createClient(token: string): Octokit {
    return new Octokit({
      auth: token,
      userAgent: 'SpecForge/1.0',
      baseUrl: 'https://api.github.com',
    });
  }

  /**
   * Get default branch for repository
   */
  async getDefaultBranch(repoUrl: string, token: string): Promise<string> {
    try {
      console.log(`[GitHub] Getting default branch for: ${repoUrl}`);
      
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      const octokit = this.createClient(token);
      
      const { data } = await octokit.repos.get({
        owner,
        repo,
      });
      
      const defaultBranch = data.default_branch;
      console.log(`[GitHub] ✅ Default branch: ${defaultBranch}`);
      
      return defaultBranch;
    } catch (error) {
      console.error('[GitHub] ❌ Failed to get default branch:', error);
      
      if (error.status === 404) {
        throw new Error('Repository not found or access denied');
      }
      
      if (error.status === 401) {
        throw new Error('Invalid GitHub token or insufficient permissions');
      }
      
      throw new Error(`Failed to get default branch: ${error.message}`);
    }
  }

  /**
   * List all branches
   */
  async listBranches(repoUrl: string, token: string): Promise<string[]> {
    try {
      console.log(`[GitHub] Listing branches for: ${repoUrl}`);
      
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      const octokit = this.createClient(token);
      
      // GitHub API paginates results, fetch all pages
      const branches: string[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data } = await octokit.repos.listBranches({
          owner,
          repo,
          per_page: 100,
          page,
        });
        
        if (data.length === 0) {
          hasMore = false;
        } else {
          branches.push(...data.map(b => b.name));
          page++;
          
          // Limit to 500 branches to avoid excessive API calls
          if (branches.length >= 500) {
            hasMore = false;
          }
        }
      }
      
      console.log(`[GitHub] ✅ Found ${branches.length} branches`);
      return branches;
    } catch (error) {
      console.error('[GitHub] ❌ Failed to list branches:', error);
      
      if (error.status === 404) {
        throw new Error('Repository not found or access denied');
      }
      
      if (error.status === 401) {
        throw new Error('Invalid GitHub token or insufficient permissions');
      }
      
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }

  /**
   * Check if branch exists
   */
  async branchExists(repoUrl: string, branch: string, token: string): Promise<boolean> {
    try {
      console.log(`[GitHub] Checking if branch exists: ${branch} in ${repoUrl}`);
      
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      const octokit = this.createClient(token);
      
      try {
        await octokit.repos.getBranch({
          owner,
          repo,
          branch,
        });
        
        console.log(`[GitHub] ✅ Branch exists: ${branch}`);
        return true;
      } catch (error) {
        if (error.status === 404) {
          console.log(`[GitHub] ℹ️ Branch does not exist: ${branch}`);
          return false;
        }
        throw error;
      }
    } catch (error) {
      console.error('[GitHub] ❌ Failed to check branch:', error);
      
      if (error.status === 401) {
        throw new Error('Invalid GitHub token or insufficient permissions');
      }
      
      throw new Error(`Failed to check branch: ${error.message}`);
    }
  }

  /**
   * Validate repository access
   */
  async validateAccess(repoUrl: string, token: string): Promise<void> {
    try {
      console.log(`[GitHub] Validating access for: ${repoUrl}`);
      
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      const octokit = this.createClient(token);
      
      // Try to get repository info - this validates both URL and access
      await octokit.repos.get({
        owner,
        repo,
      });
      
      console.log('[GitHub] ✅ Access validated successfully');
    } catch (error) {
      console.error('[GitHub] ❌ Access validation failed:', error);
      
      if (error.status === 404) {
        throw new Error('Repository not found or access denied');
      }
      
      if (error.status === 401) {
        throw new Error('Invalid GitHub token');
      }
      
      if (error.status === 403) {
        throw new Error('GitHub token does not have required permissions');
      }
      
      throw new Error(`Access validation failed: ${error.message}`);
    }
  }
}
```

### 2. Main Lambda Handler

Replace `amplify/functions/git-integration/handler.ts` with:

```typescript
import { AppSyncClient } from './lib/appsync-client';
import { KMSEncryption } from './lib/kms-encryption';
import { GitProviderFactory } from './lib/git-providers/factory';
import type {
  GitIntegrationEvent,
  GitIntegrationResponse,
  ConnectRepositoryData,
  ListBranchesData,
  SwitchBranchData,
  UpdateCredentialData,
  ValidateAccessData,
} from './lib/types';

// Singleton instances (reused across warm Lambda invocations)
let appsyncClient: AppSyncClient | null = null;
let kmsEncryption: KMSEncryption | null = null;

/**
 * Initialize Lambda dependencies
 */
async function initialize(): Promise<void> {
  if (appsyncClient && kmsEncryption) {
    console.log('Using cached clients');
    return;
  }

  console.log('Initializing Lambda...');

  // Get environment variables (auto-injected by Amplify)
  const appsyncEndpoint = process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT;
  const kmsKeyId = process.env.KMS_KEY_ID;

  if (!appsyncEndpoint) {
    throw new Error('Missing required environment variable: API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT');
  }

  if (!kmsKeyId) {
    throw new Error('Missing required environment variable: KMS_KEY_ID');
  }

  console.log('AppSync Endpoint:', appsyncEndpoint);
  console.log('KMS Key ID:', kmsKeyId);

  appsyncClient = new AppSyncClient(appsyncEndpoint);
  kmsEncryption = new KMSEncryption(kmsKeyId);

  console.log('✅ Lambda initialized successfully');
}

/**
 * Main Lambda handler
 */
export const handler = async (event: GitIntegrationEvent): Promise<GitIntegrationResponse> => {
  console.log('='.repeat(80));
  console.log('Git Integration Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('='.repeat(80));

  try {
    // Initialize dependencies
    await initialize();

    const { operation, data } = event.arguments;

    console.log(`\n📋 Operation: ${operation}`);

    // Route to appropriate operation handler
    switch (operation) {
      case 'connectRepository':
        return await connectRepository(data as ConnectRepositoryData);

      case 'listBranches':
        return await listBranches(data as ListBranchesData);

      case 'switchBranch':
        return await switchBranch(data as SwitchBranchData);

      case 'updateCredential':
        return await updateCredential(data as UpdateCredentialData);

      case 'validateAccess':
        return await validateAccess(data as ValidateAccessData);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('='.repeat(80));
    console.error('❌ Error in git-integration Lambda:');
    console.error(error);
    console.error('='.repeat(80));

    return {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        code: error.code,
        details: error.stack,
      },
    };
  }
};

// ============================================================================
// OPERATION HANDLERS
// ============================================================================

/**
 * Connect a Git repository to a project
 */
async function connectRepository(data: ConnectRepositoryData): Promise<GitIntegrationResponse> {
  console.log('\n🔗 Connecting repository...');
  console.log('Provider:', data.provider);
  console.log('Repo URL:', data.repoUrl);
  console.log('Project ID:', data.projectId);

  // Encrypt credential
  console.log('\n🔐 Encrypting credential...');
  const encryptedToken = await kmsEncryption!.encrypt(data.token);

  // Create GitRepository record
  console.log('\n📝 Creating GitRepository record...');
  const repository = await appsyncClient!.createGitRepository({
    projectId: data.projectId,
    provider: data.provider,
    repoUrl: data.repoUrl,
    currentBranch: 'main', // Temporary, will be updated
    status: 'pending',
  });

  console.log('✅ GitRepository created:', repository.id);

  // Create GitCredential record
  console.log('\n🔑 Creating GitCredential record...');
  await appsyncClient!.createGitCredential({
    repositoryId: repository.id,
    type: data.credentialType,
    encryptedToken,
    username: data.username,
  });

  console.log('✅ GitCredential created');

  // Test connection and get branch info
  console.log('\n🧪 Testing Git connection...');
  const gitProvider = GitProviderFactory.create(data.provider);
  const decryptedToken = await kmsEncryption!.decrypt(encryptedToken);

  try {
    const defaultBranch = await gitProvider.getDefaultBranch(data.repoUrl, decryptedToken);
    const branches = await gitProvider.listBranches(data.repoUrl, decryptedToken);

    console.log(`\n✅ Connection successful!`);
    console.log(`Default branch: ${defaultBranch}`);
    console.log(`Total branches: ${branches.length}`);

    // Update repository with branch info
    console.log('\n📝 Updating repository with branch info...');
    await appsyncClient!.updateGitRepository({
      id: repository.id,
      currentBranch: defaultBranch,
      branches: branches.slice(0, 100), // Cache first 100 branches
      status: 'ready',
      lastSyncedAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        repositoryId: repository.id,
        defaultBranch,
        branchCount: branches.length,
        status: 'ready',
      },
    };
  } catch (error) {
    console.error('\n❌ Connection test failed:', error);

    // Update status to error
    await appsyncClient!.updateGitRepository({
      id: repository.id,
      status: 'error',
    });

    throw new Error(`Failed to connect to repository: ${error.message}`);
  }
}

/**
 * List branches for a repository
 */
async function listBranches(data: ListBranchesData): Promise<GitIntegrationResponse> {
  console.log('\n🌿 Listing branches...');
  console.log('Repository ID:', data.repositoryId);

  // Get repository
  const repository = await appsyncClient!.getGitRepository(data.repositoryId);
  console.log('Repository URL:', repository.repoUrl);
  console.log('Provider:', repository.provider);

  // Get credentials
  const credential = await appsyncClient!.getGitCredential(data.repositoryId);
  const decryptedToken = await kmsEncryption!.decrypt(credential.encryptedToken);

  // Get branches from provider
  const gitProvider = GitProviderFactory.create(repository.provider);
  const branches = await gitProvider.listBranches(repository.repoUrl, decryptedToken);

  // Update cached branches
  await appsyncClient!.updateGitRepository({
    id: data.repositoryId,
    branches: branches.slice(0, 100),
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      branches,
      total: branches.length,
      currentBranch: repository.currentBranch,
    },
  };
}

/**
 * Switch to a different branch
 */
async function switchBranch(data: SwitchBranchData): Promise<GitIntegrationResponse> {
  console.log('\n🔄 Switching branch...');
  console.log('Repository ID:', data.repositoryId);
  console.log('Target branch:', data.branch);

  // Get repository
  const repository = await appsyncClient!.getGitRepository(data.repositoryId);

  // Get credentials
  const credential = await appsyncClient!.getGitCredential(data.repositoryId);
  const decryptedToken = await kmsEncryption!.decrypt(credential.encryptedToken);

  // Verify branch exists
  const gitProvider = GitProviderFactory.create(repository.provider);
  const branchExists = await gitProvider.branchExists(
    repository.repoUrl,
    data.branch,
    decryptedToken
  );

  if (!branchExists) {
    throw new Error(`Branch '${data.branch}' does not exist in repository`);
  }

  // Update current branch
  await appsyncClient!.updateGitRepository({
    id: data.repositoryId,
    currentBranch: data.branch,
  });

  console.log(`✅ Switched to branch: ${data.branch}`);

  return {
    success: true,
    data: {
      repositoryId: data.repositoryId,
      currentBranch: data.branch,
    },
  };
}

/**
 * Update repository credentials
 */
async function updateCredential(data: UpdateCredentialData): Promise<GitIntegrationResponse> {
  console.log('\n🔑 Updating credentials...');
  console.log('Repository ID:', data.repositoryId);

  // Encrypt new token
  const encryptedToken = await kmsEncryption!.encrypt(data.token);

  // Update credential
  await appsyncClient!.updateGitCredential({
    repositoryId: data.repositoryId,
    encryptedToken,
    username: data.username,
  });

  console.log('✅ Credentials updated successfully');

  return {
    success: true,
    data: {
      repositoryId: data.repositoryId,
      message: 'Credentials updated successfully',
    },
  };
}

/**
 * Validate repository access
 */
async function validateAccess(data: ValidateAccessData): Promise<GitIntegrationResponse> {
  console.log('\n🔐 Validating access...');
  console.log('Repository ID:', data.repositoryId);

  // Get repository and credentials
  const repository = await appsyncClient!.getGitRepository(data.repositoryId);
  const credential = await appsyncClient!.getGitCredential(data.repositoryId);
  const decryptedToken = await kmsEncryption!.decrypt(credential.encryptedToken);

  // Test access
  const gitProvider = GitProviderFactory.create(repository.provider);

  try {
    await gitProvider.validateAccess(repository.repoUrl, decryptedToken);

    console.log('✅ Access validated successfully');

    return {
      success: true,
      data: {
        repositoryId: data.repositoryId,
        hasAccess: true,
        message: 'Access validated successfully',
        provider: repository.provider,
        repoUrl: repository.repoUrl,
      },
    };
  } catch (error) {
    console.error('❌ Access validation failed:', error);

    return {
      success: false,
      data: {
        repositoryId: data.repositoryId,
        hasAccess: false,
        message: error.message,
        provider: repository.provider,
        repoUrl: repository.repoUrl,
      },
    };
  }
}
```

---

## Acceptance Criteria

- [ ] GitHub provider fully implemented
- [ ] All GitHub operations work (list branches, validate, etc.)
- [ ] Main handler orchestrates all operations
- [ ] Error handling is comprehensive
- [ ] Logging provides detailed execution traces
- [ ] TypeScript compiles without errors
- [ ] Singleton pattern for clients (Lambda warm starts)

---

## Verification Steps

```bash
# Navigate to Lambda directory
cd amplify/functions/git-integration

# Check TypeScript compilation
npx tsc --noEmit

# Expected: No errors
```

---

## Next Ticket

MVP-006-01: Deploy Lambda and Verify Infrastructure
