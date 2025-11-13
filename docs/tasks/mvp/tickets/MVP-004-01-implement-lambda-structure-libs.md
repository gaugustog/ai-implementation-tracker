# MVP-004-01: Implement Lambda Directory Structure and Core Libraries

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 2  
**Estimated Time**: 1.5 hours  
**Status**: Todo  
**Priority**: High  
**Depends On**: MVP-003-01

---

## Objective

Create the complete directory structure for the git-integration Lambda function and implement core supporting libraries (AppSync client, KMS encryption, types).

---

## Directory Structure

```
amplify/functions/git-integration/
├── handler.ts                 # Main Lambda handler (next ticket)
├── resource.ts               # Already exists from MVP-003-01
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── lib/
│   ├── appsync-client.ts     # AppSync GraphQL client
│   ├── kms-encryption.ts     # KMS encrypt/decrypt
│   ├── types.ts              # TypeScript types
│   └── git-providers/
│       ├── factory.ts        # Provider factory
│       ├── base.ts           # Base interface
│       ├── github.ts         # GitHub implementation (next ticket)
│       ├── gitlab.ts         # GitLab placeholder
│       └── bitbucket.ts      # Bitbucket placeholder
└── graphql/
    ├── queries.ts            # GraphQL queries
    └── mutations.ts          # GraphQL mutations
```

---

## Implementation

### 1. Create Directory Structure

```bash
# From project root
cd amplify/functions/git-integration

# Create directories
mkdir -p lib/git-providers graphql
```

### 2. Package.json

Create `amplify/functions/git-integration/package.json`:

```json
{
  "name": "git-integration",
  "version": "1.0.0",
  "description": "Git integration Lambda for SpecForge",
  "type": "module",
  "main": "handler.ts",
  "scripts": {
    "test": "echo \"No tests yet\" && exit 0"
  },
  "dependencies": {
    "@aws-sdk/client-kms": "^3.0.0",
    "@octokit/rest": "^20.0.0",
    "aws-amplify": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. TypeScript Config

Create `amplify/functions/git-integration/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Types Definition

Create `amplify/functions/git-integration/lib/types.ts`:

```typescript
// ============================================================================
// EVENT TYPES
// ============================================================================

export interface GitIntegrationEvent {
  arguments: {
    operation: GitOperation;
    data: any;
  };
}

export type GitOperation =
  | 'connectRepository'
  | 'listBranches'
  | 'switchBranch'
  | 'updateCredential'
  | 'validateAccess';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface GitIntegrationResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

// ============================================================================
// GIT PROVIDER TYPES
// ============================================================================

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

export interface GitProviderConfig {
  provider: GitProvider;
  repoUrl: string;
  token: string;
}

export interface GitBranch {
  name: string;
  commit: {
    sha: string;
    message?: string;
  };
  protected?: boolean;
}

export interface GitRepository {
  id: string;
  provider: GitProvider;
  repoUrl: string;
  currentBranch: string;
  branches?: string[];
  status: 'pending' | 'analyzing' | 'ready' | 'error';
}

export interface GitCredential {
  id: string;
  repositoryId: string;
  type: 'token' | 'ssh' | 'oauth';
  encryptedToken: string;
  username?: string;
}

// ============================================================================
// OPERATION DATA TYPES
// ============================================================================

export interface ConnectRepositoryData {
  projectId: string;
  provider: GitProvider;
  repoUrl: string;
  credentialType: 'token' | 'ssh' | 'oauth';
  token: string;
  username?: string;
}

export interface ListBranchesData {
  repositoryId: string;
}

export interface SwitchBranchData {
  repositoryId: string;
  branch: string;
}

export interface UpdateCredentialData {
  repositoryId: string;
  token: string;
  username?: string;
}

export interface ValidateAccessData {
  repositoryId: string;
}

// ============================================================================
// APPSYNC TYPES
// ============================================================================

export interface AppSyncCreateGitRepositoryInput {
  projectId: string;
  provider: GitProvider;
  repoUrl: string;
  currentBranch: string;
  status: 'pending' | 'analyzing' | 'ready' | 'error';
  branches?: string[];
  lastSyncedAt?: string;
}

export interface AppSyncUpdateGitRepositoryInput {
  id: string;
  currentBranch?: string;
  branches?: string[];
  status?: 'pending' | 'analyzing' | 'ready' | 'error';
  lastSyncedAt?: string;
}

export interface AppSyncCreateGitCredentialInput {
  repositoryId: string;
  type: 'token' | 'ssh' | 'oauth';
  encryptedToken: string;
  username?: string;
}

export interface AppSyncUpdateGitCredentialInput {
  repositoryId: string;
  encryptedToken: string;
  username?: string;
}
```

### 5. KMS Encryption Library

Create `amplify/functions/git-integration/lib/kms-encryption.ts`:

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

export class KMSEncryption {
  private client: KMSClient;
  private keyId: string;

  constructor(keyId: string) {
    this.keyId = keyId;
    this.client = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Encrypt plaintext using KMS
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      console.log('Encrypting credential with KMS...');
      
      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(plaintext, 'utf-8'),
      });

      const response = await this.client.send(command);
      
      if (!response.CiphertextBlob) {
        throw new Error('KMS encryption returned no ciphertext');
      }

      // Convert to base64 for storage
      const encrypted = Buffer.from(response.CiphertextBlob).toString('base64');
      console.log('✅ Credential encrypted successfully');
      
      return encrypted;
    } catch (error) {
      console.error('❌ KMS encryption failed:', error);
      throw new Error(`Failed to encrypt credential: ${error.message}`);
    }
  }

  /**
   * Decrypt ciphertext using KMS
   */
  async decrypt(ciphertext: string): Promise<string> {
    try {
      console.log('Decrypting credential with KMS...');
      
      // Convert from base64
      const ciphertextBlob = Buffer.from(ciphertext, 'base64');
      
      const command = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
        KeyId: this.keyId,
      });

      const response = await this.client.send(command);
      
      if (!response.Plaintext) {
        throw new Error('KMS decryption returned no plaintext');
      }

      const decrypted = Buffer.from(response.Plaintext).toString('utf-8');
      console.log('✅ Credential decrypted successfully');
      
      return decrypted;
    } catch (error) {
      console.error('❌ KMS decryption failed:', error);
      throw new Error(`Failed to decrypt credential: ${error.message}`);
    }
  }
}
```

### 6. AppSync Client Library

Create `amplify/functions/git-integration/lib/appsync-client.ts`:

```typescript
import type {
  AppSyncCreateGitRepositoryInput,
  AppSyncUpdateGitRepositoryInput,
  AppSyncCreateGitCredentialInput,
  AppSyncUpdateGitCredentialInput,
  GitRepository,
  GitCredential,
} from './types';

// Import GraphQL operations
import {
  GET_GIT_REPOSITORY,
  GET_GIT_CREDENTIAL,
} from '../graphql/queries';

import {
  CREATE_GIT_REPOSITORY,
  UPDATE_GIT_REPOSITORY,
  CREATE_GIT_CREDENTIAL,
  UPDATE_GIT_CREDENTIAL,
} from '../graphql/mutations';

export class AppSyncClient {
  private apiEndpoint: string;

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Execute GraphQL query/mutation
   */
  private async execute(query: string, variables: any): Promise<any> {
    try {
      console.log('Executing GraphQL operation...');
      console.log('Variables:', JSON.stringify(variables, null, 2));

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // IAM authentication handled automatically by Lambda execution role
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.error('GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      console.log('✅ GraphQL operation successful');
      return result.data;
    } catch (error) {
      console.error('❌ GraphQL operation failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // GIT REPOSITORY OPERATIONS
  // ============================================================================

  async createGitRepository(input: AppSyncCreateGitRepositoryInput): Promise<GitRepository> {
    const data = await this.execute(CREATE_GIT_REPOSITORY, { input });
    return data.createGitRepository;
  }

  async getGitRepository(id: string): Promise<GitRepository> {
    const data = await this.execute(GET_GIT_REPOSITORY, { id });
    return data.getGitRepository;
  }

  async updateGitRepository(input: AppSyncUpdateGitRepositoryInput): Promise<GitRepository> {
    const data = await this.execute(UPDATE_GIT_REPOSITORY, { input });
    return data.updateGitRepository;
  }

  // ============================================================================
  // GIT CREDENTIAL OPERATIONS
  // ============================================================================

  async createGitCredential(input: AppSyncCreateGitCredentialInput): Promise<GitCredential> {
    const data = await this.execute(CREATE_GIT_CREDENTIAL, { input });
    return data.createGitCredential;
  }

  async getGitCredential(repositoryId: string): Promise<GitCredential> {
    const data = await this.execute(GET_GIT_CREDENTIAL, { repositoryId });
    return data.getGitCredential;
  }

  async updateGitCredential(input: AppSyncUpdateGitCredentialInput): Promise<GitCredential> {
    const data = await this.execute(UPDATE_GIT_CREDENTIAL, { input });
    return data.updateGitCredential;
  }
}
```

### 7. GraphQL Queries

Create `amplify/functions/git-integration/graphql/queries.ts`:

```typescript
export const GET_GIT_REPOSITORY = `
  query GetGitRepository($id: ID!) {
    getGitRepository(id: $id) {
      id
      projectId
      provider
      repoUrl
      currentBranch
      branches
      status
      lastSyncedAt
      createdAt
      updatedAt
    }
  }
`;

export const GET_GIT_CREDENTIAL = `
  query GetGitCredential($repositoryId: ID!) {
    listGitCredentials(filter: { repositoryId: { eq: $repositoryId } }) {
      items {
        id
        repositoryId
        type
        encryptedToken
        username
        createdAt
        updatedAt
      }
    }
  }
`;
```

### 8. GraphQL Mutations

Create `amplify/functions/git-integration/graphql/mutations.ts`:

```typescript
export const CREATE_GIT_REPOSITORY = `
  mutation CreateGitRepository($input: CreateGitRepositoryInput!) {
    createGitRepository(input: $input) {
      id
      projectId
      provider
      repoUrl
      currentBranch
      branches
      status
      lastSyncedAt
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_GIT_REPOSITORY = `
  mutation UpdateGitRepository($input: UpdateGitRepositoryInput!) {
    updateGitRepository(input: $input) {
      id
      currentBranch
      branches
      status
      lastSyncedAt
      updatedAt
    }
  }
`;

export const CREATE_GIT_CREDENTIAL = `
  mutation CreateGitCredential($input: CreateGitCredentialInput!) {
    createGitCredential(input: $input) {
      id
      repositoryId
      type
      encryptedToken
      username
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_GIT_CREDENTIAL = `
  mutation UpdateGitCredential($input: UpdateGitCredentialInput!) {
    updateGitCredential(input: $input) {
      id
      repositoryId
      encryptedToken
      username
      updatedAt
    }
  }
`;
```

### 9. Git Provider Base Interface

Create `amplify/functions/git-integration/lib/git-providers/base.ts`:

```typescript
import type { GitBranch } from '../types';

/**
 * Base interface for Git providers
 */
export interface IGitProvider {
  /**
   * Get default branch for repository
   */
  getDefaultBranch(repoUrl: string, token: string): Promise<string>;

  /**
   * List all branches
   */
  listBranches(repoUrl: string, token: string): Promise<string[]>;

  /**
   * Check if branch exists
   */
  branchExists(repoUrl: string, branch: string, token: string): Promise<boolean>;

  /**
   * Validate repository access
   */
  validateAccess(repoUrl: string, token: string): Promise<void>;
}
```

### 10. Git Provider Factory

Create `amplify/functions/git-integration/lib/git-providers/factory.ts`:

```typescript
import type { GitProvider } from '../types';
import type { IGitProvider } from './base';
import { GitHubProvider } from './github';
import { GitLabProvider } from './gitlab';
import { BitbucketProvider } from './bitbucket';

export class GitProviderFactory {
  static create(provider: GitProvider): IGitProvider {
    switch (provider) {
      case 'github':
        return new GitHubProvider();
      
      case 'gitlab':
        return new GitLabProvider();
      
      case 'bitbucket':
        return new BitbucketProvider();
      
      default:
        throw new Error(`Unsupported Git provider: ${provider}`);
    }
  }
}
```

### 11. GitLab Placeholder

Create `amplify/functions/git-integration/lib/git-providers/gitlab.ts`:

```typescript
import type { IGitProvider } from './base';

export class GitLabProvider implements IGitProvider {
  async getDefaultBranch(repoUrl: string, token: string): Promise<string> {
    throw new Error('GitLab provider not yet implemented');
  }

  async listBranches(repoUrl: string, token: string): Promise<string[]> {
    throw new Error('GitLab provider not yet implemented');
  }

  async branchExists(repoUrl: string, branch: string, token: string): Promise<boolean> {
    throw new Error('GitLab provider not yet implemented');
  }

  async validateAccess(repoUrl: string, token: string): Promise<void> {
    throw new Error('GitLab provider not yet implemented');
  }
}
```

### 12. Bitbucket Placeholder

Create `amplify/functions/git-integration/lib/git-providers/bitbucket.ts`:

```typescript
import type { IGitProvider } from './base';

export class BitbucketProvider implements IGitProvider {
  async getDefaultBranch(repoUrl: string, token: string): Promise<string> {
    throw new Error('Bitbucket provider not yet implemented');
  }

  async listBranches(repoUrl: string, token: string): Promise<string[]> {
    throw new Error('Bitbucket provider not yet implemented');
  }

  async branchExists(repoUrl: string, branch: string, token: string): Promise<boolean> {
    throw new Error('Bitbucket provider not yet implemented');
  }

  async validateAccess(repoUrl: string, token: string): Promise<void> {
    throw new Error('Bitbucket provider not yet implemented');
  }
}
```

---

## Acceptance Criteria

- [ ] All directories created
- [ ] `package.json` with correct dependencies
- [ ] `tsconfig.json` configured
- [ ] Type definitions complete in `lib/types.ts`
- [ ] KMS encryption library implemented
- [ ] AppSync client library implemented
- [ ] GraphQL queries defined
- [ ] GraphQL mutations defined
- [ ] Git provider base interface defined
- [ ] Git provider factory implemented
- [ ] GitLab and Bitbucket placeholders created
- [ ] All TypeScript files compile without errors

---

## Verification Steps

```bash
# Navigate to Lambda directory
cd amplify/functions/git-integration

# Install dependencies
npm install

# Check TypeScript compilation
npx tsc --noEmit

# Expected: No errors
```

---

## Next Ticket

MVP-005-01: Implement GitHub Provider and Main Handler
