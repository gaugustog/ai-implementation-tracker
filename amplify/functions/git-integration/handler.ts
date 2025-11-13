import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
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

// Generate Amplify Data client (uses auto-injected AppSync config)
const client = generateClient<Schema>();

// Singleton instance for KMS (reused across warm Lambda invocations)
let kmsEncryption: KMSEncryption | null = null;

/**
 * Initialize Lambda dependencies
 */
async function initialize(): Promise<void> {
  if (kmsEncryption) {
    console.log('Using cached KMS client');
    return;
  }

  console.log('Initializing Lambda...');

  // Get KMS key ID from environment variable (injected by backend.ts)
  const kmsKeyId = process.env.KMS_KEY_ID;

  if (!kmsKeyId) {
    throw new Error('Missing required environment variable: KMS_KEY_ID');
  }

  console.log('KMS Key ID:', kmsKeyId);

  kmsEncryption = new KMSEncryption(kmsKeyId);

  console.log('✅ Lambda initialized successfully');
}

/**
 * Main Lambda handler
 */
export const handler = async (event: GitIntegrationEvent): Promise<any> => {
  console.log('='.repeat(80));
  console.log('Git Integration Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('='.repeat(80));

  try {
    // Initialize dependencies
    await initialize();

    const { operation, data } = event.arguments;

    // Parse data if it's a JSON string (when called from AppSync custom query)
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

    console.log(`\n📋 Operation: ${operation}`);

    // Route to appropriate operation handler
    let result: GitIntegrationResponse;
    switch (operation) {
      case 'connectRepository':
        result = await connectRepository(parsedData as ConnectRepositoryData);
        break;

      case 'listBranches':
        result = await listBranches(parsedData as ListBranchesData);
        break;

      case 'switchBranch':
        result = await switchBranch(parsedData as SwitchBranchData);
        break;

      case 'updateCredential':
        result = await updateCredential(parsedData as UpdateCredentialData);
        break;

      case 'validateAccess':
        result = await validateAccess(parsedData as ValidateAccessData);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Return as JSON string for AppSync custom query (schema expects a.json())
    return JSON.stringify(result);
  } catch (error: any) {
    console.error('='.repeat(80));
    console.error('❌ Error in git-integration Lambda:');
    console.error(error);
    console.error('='.repeat(80));

    const errorResponse = {
      success: false,
      error: {
        message: error.message || 'Unknown error occurred',
        code: error.code,
        details: error.stack,
      },
    };

    // Return error as JSON string for AppSync custom query
    return JSON.stringify(errorResponse);
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
  const repoResult = await client.models.GitRepository.create({
    projectId: data.projectId,
    provider: data.provider,
    repoUrl: data.repoUrl,
    currentBranch: 'main', // Temporary, will be updated
    status: 'pending',
  });

  if (!repoResult.data) {
    throw new Error('Failed to create GitRepository');
  }

  const repository = repoResult.data;
  console.log('✅ GitRepository created:', repository.id);

  // Create GitCredential record
  console.log('\n🔑 Creating GitCredential record...');
  await client.models.GitCredential.create({
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
    await client.models.GitRepository.update({
      id: repository.id,
      currentBranch: defaultBranch,
      branches: JSON.stringify(branches.slice(0, 100)), // Cache first 100 branches as JSON string
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
  } catch (error: any) {
    console.error('\n❌ Connection test failed:', error);

    // Update status to error
    await client.models.GitRepository.update({
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
  const repoResult = await client.models.GitRepository.get({ id: data.repositoryId });
  if (!repoResult.data) {
    throw new Error(`Repository not found: ${data.repositoryId}`);
  }
  const repository = repoResult.data;
  console.log('Repository URL:', repository.repoUrl);
  console.log('Provider:', repository.provider);

  // Get credentials
  const credResult = await client.models.GitCredential.list({
    filter: { repositoryId: { eq: data.repositoryId } },
  });
  const credentials = credResult.data || [];
  if (credentials.length === 0) {
    throw new Error(`No credential found for repository: ${data.repositoryId}`);
  }
  const credential = credentials[0];
  const decryptedToken = await kmsEncryption!.decrypt(credential.encryptedToken);

  // Get branches from provider
  const gitProvider = GitProviderFactory.create(repository.provider);
  const branches = await gitProvider.listBranches(repository.repoUrl, decryptedToken);

  // Update cached branches
  await client.models.GitRepository.update({
    id: data.repositoryId,
    branches: JSON.stringify(branches.slice(0, 100)), // Cache as JSON string
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
  const repoResult = await client.models.GitRepository.get({ id: data.repositoryId });
  if (!repoResult.data) {
    throw new Error(`Repository not found: ${data.repositoryId}`);
  }
  const repository = repoResult.data;

  // Get credentials
  const credResult = await client.models.GitCredential.list({
    filter: { repositoryId: { eq: data.repositoryId } },
  });
  const credentials = credResult.data || [];
  if (credentials.length === 0) {
    throw new Error(`No credential found for repository: ${data.repositoryId}`);
  }
  const credential = credentials[0];
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
  await client.models.GitRepository.update({
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

  // Get existing credential to get its ID
  const credResult = await client.models.GitCredential.list({
    filter: { repositoryId: { eq: data.repositoryId } },
  });
  const credentials = credResult.data || [];
  if (credentials.length === 0) {
    throw new Error(`No credential found for repository: ${data.repositoryId}`);
  }
  const credential = credentials[0];

  // Encrypt new token
  const encryptedToken = await kmsEncryption!.encrypt(data.token);

  // Update credential
  await client.models.GitCredential.update({
    id: credential.id,
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

  // Get repository
  const repoResult = await client.models.GitRepository.get({ id: data.repositoryId });
  if (!repoResult.data) {
    throw new Error(`Repository not found: ${data.repositoryId}`);
  }
  const repository = repoResult.data;

  // Get credentials
  const credResult = await client.models.GitCredential.list({
    filter: { repositoryId: { eq: data.repositoryId } },
  });
  const credentials = credResult.data || [];
  if (credentials.length === 0) {
    throw new Error(`No credential found for repository: ${data.repositoryId}`);
  }
  const credential = credentials[0];
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
  } catch (error: any) {
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
