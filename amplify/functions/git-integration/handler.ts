import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { Octokit } from '@octokit/rest';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const kmsClient = new KMSClient({});

const TABLE_NAME = process.env.TABLE_NAME || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const DEBUG = process.env.DEBUG_GIT_INTEGRATION === 'true';

const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[GitLambda]', ...args);
  }
};

interface GitSyncEvent {
  operation: 'sync' | 'connect' | 'disconnect' | 'changeBranch' | 'getByProject' | 'getBranches';
  repositoryId?: string;
  projectId?: string;
  repoUrl?: string;
  accessToken?: string;
  branch?: string;
}

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

/**
 * Main handler for git integration operations
 */
export const handler = async (event: any) => {
  debugLog('=== Git Integration Handler Invoked ===');
  debugLog('Environment:', {
    TABLE_NAME,
    BUCKET_NAME,
    hasKmsKey: !!KMS_KEY_ID,
    DEBUG
  });
  console.log('Git Integration Event:', JSON.stringify(event, null, 2));

  try {
    const request: GitSyncEvent = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body || event;

    debugLog('Parsed request:', {
      operation: request.operation,
      repositoryId: request.repositoryId,
      projectId: request.projectId,
      repoUrl: request.repoUrl,
      branch: request.branch,
      hasAccessToken: !!request.accessToken
    });

    switch (request.operation) {
      case 'connect':
        debugLog('Routing to handleConnect');
        return await handleConnect(request);
      case 'sync':
        debugLog('Routing to handleSync');
        return await handleSync(request);
      case 'disconnect':
        debugLog('Routing to handleDisconnect');
        return await handleDisconnect(request);
      case 'changeBranch':
        debugLog('Routing to handleChangeBranch');
        return await handleChangeBranch(request);
      case 'getByProject':
        debugLog('Routing to handleGetByProject');
        return await handleGetByProject(request);
      case 'getBranches':
        debugLog('Routing to handleGetBranches');
        return await handleGetBranches(request);
      default:
        debugLog('Invalid operation:', request.operation);
        return createResponse(400, { error: 'Invalid operation' });
    }
  } catch (error) {
    console.error('Error in git integration:', error);
    debugLog('Handler error:', error);
    return createResponse(500, {
      error: 'Failed to process git operation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Handle repository connection
 */
async function handleConnect(request: GitSyncEvent) {
  debugLog('handleConnect() called');
  const { projectId, repoUrl, accessToken, branch } = request;

  debugLog('handleConnect() params:', {
    projectId,
    repoUrl,
    branch,
    hasAccessToken: !!accessToken,
    tokenLength: accessToken?.length
  });

  if (!projectId || !repoUrl || !accessToken) {
    debugLog('handleConnect() - Missing required fields');
    return createResponse(400, { error: 'Missing required fields' });
  }

  try {
    // Parse GitHub URL
    debugLog('handleConnect() - Step 1: Parsing GitHub URL');
    const repoInfo = parseGitHubUrl(repoUrl);
    debugLog('handleConnect() - Parsed repo info:', repoInfo);

    // Validate access token with GitHub API
    debugLog('handleConnect() - Step 2: Validating access token with GitHub');
    const octokit = new Octokit({ auth: accessToken });
    const { data: repo } = await octokit.repos.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
    });

    debugLog('handleConnect() - GitHub repo validated:', {
      name: repo.name,
      private: repo.private,
      defaultBranch: repo.default_branch
    });

    // Encrypt the access token
    debugLog('handleConnect() - Step 3: Encrypting access token');
    const encryptedToken = await encryptToken(accessToken);
    debugLog('handleConnect() - Token encrypted successfully');

    // Create repository record
    const repositoryId = `repo-${Date.now()}`;
    const gitRepository = {
      id: repositoryId,
      projectId,
      provider: 'github',
      repoUrl,
      branch: branch || repo.default_branch,
      accessTokenHash: encryptedToken,
      syncStatus: 'pending',
      lastCommitHash: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    debugLog('handleConnect() - Step 4: Saving to DynamoDB', {
      repositoryId,
      tableName: TABLE_NAME,
      branch: gitRepository.branch
    });

    await dynamoClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: gitRepository,
    }));

    debugLog('handleConnect() - Repository saved to DynamoDB');

    // Trigger initial sync
    debugLog('handleConnect() - Step 5: Triggering initial sync');
    await triggerSync(repositoryId);
    debugLog('handleConnect() - Initial sync triggered');

    const response = createResponse(200, {
      repositoryId,
      message: 'Repository connected successfully',
      branch: gitRepository.branch,
    });

    debugLog('handleConnect() - Success, returning:', response);
    return response;
  } catch (error) {
    console.error('Error connecting repository:', error);
    debugLog('handleConnect() - Error occurred:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return createResponse(500, {
      error: 'Failed to connect repository',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle repository sync
 */
async function handleSync(request: GitSyncEvent) {
  debugLog('handleSync() called');
  const { repositoryId } = request;

  debugLog('handleSync() - repositoryId:', repositoryId);

  if (!repositoryId) {
    debugLog('handleSync() - Missing repositoryId');
    return createResponse(400, { error: 'Missing repositoryId' });
  }

  try {
    // Get repository record
    debugLog('handleSync() - Step 1: Fetching repository from DynamoDB');
    const { Item: repository } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
    }));

    if (!repository) {
      debugLog('handleSync() - Repository not found in DynamoDB');
      return createResponse(404, { error: 'Repository not found' });
    }

    debugLog('handleSync() - Repository found:', {
      repoUrl: repository.repoUrl,
      branch: repository.branch,
      syncStatus: repository.syncStatus
    });

    // Update status to syncing
    debugLog('handleSync() - Step 2: Updating status to syncing');
    await updateSyncStatus(repositoryId, 'syncing');

    // Decrypt access token
    debugLog('handleSync() - Step 3: Decrypting access token');
    const accessToken = await decryptToken(repository.accessTokenHash);
    debugLog('handleSync() - Token decrypted successfully');

    // Parse repository info
    debugLog('handleSync() - Step 4: Parsing repository URL');
    const repoInfo = parseGitHubUrl(repository.repoUrl);
    debugLog('handleSync() - Parsed repo info:', repoInfo);

    // Fetch repository data using GitHub API (no git binary required)
    debugLog('handleSync() - Step 5: Fetching repository data via GitHub API');
    const octokit = new Octokit({ auth: accessToken });

    // Get latest commit
    debugLog('handleSync() - Step 6: Getting latest commit from branch:', repository.branch);
    const { data: branchData } = await octokit.repos.getBranch({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: repository.branch,
    });
    const latestCommit = branchData.commit.sha;
    debugLog('handleSync() - Latest commit:', latestCommit);

    // Read file structure using GitHub API
    debugLog('handleSync() - Step 7: Fetching repository tree from GitHub');
    const fileTree = await fetchRepositoryTree(octokit, repoInfo, latestCommit);
    debugLog('handleSync() - File tree built, total items:', fileTree.length);

    // Store file tree in S3
    debugLog('handleSync() - Step 8: Storing file tree in S3');
    const fileTreeKey = `git/${repositoryId}/file-tree-${Date.now()}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileTreeKey,
      Body: JSON.stringify(fileTree),
      ContentType: 'application/json',
    }));
    debugLog('handleSync() - File tree stored at:', fileTreeKey);

    // Create snapshot record
    debugLog('handleSync() - Step 9: Creating snapshot record');
    const snapshotId = `snapshot-${Date.now()}`;
    const snapshot = {
      id: snapshotId,
      repositoryId,
      commitHash: latestCommit,
      fileTreeKey,
      analysisComplete: false,
      createdAt: new Date().toISOString(),
    };

    await dynamoClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: snapshot,
    }));
    debugLog('handleSync() - Snapshot created:', snapshotId);

    // Update repository with latest commit and sync status
    debugLog('handleSync() - Step 10: Updating repository with sync results');
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
      UpdateExpression: 'SET lastCommitHash = :commit, syncStatus = :status, lastSyncedAt = :syncedAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':commit': latestCommit,
        ':status': 'synced',
        ':syncedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      },
    }));
    debugLog('handleSync() - Repository updated successfully');

    const response = createResponse(200, {
      message: 'Repository synced successfully',
      snapshotId,
      commitHash: latestCommit,
    });

    debugLog('handleSync() - Success, returning:', response);
    return response;
  } catch (error) {
    console.error('Error syncing repository:', error);
    debugLog('handleSync() - Error occurred:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update status to failed
    if (repositoryId) {
      debugLog('handleSync() - Updating status to failed');
      await updateSyncStatus(repositoryId, 'failed');
    }

    return createResponse(500, {
      error: 'Failed to sync repository',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle repository disconnection
 */
async function handleDisconnect(request: GitSyncEvent) {
  const { repositoryId } = request;

  if (!repositoryId) {
    return createResponse(400, { error: 'Missing repositoryId' });
  }

  try {
    // In a real implementation, you'd delete or mark as inactive
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
      UpdateExpression: 'SET syncStatus = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': 'disconnected',
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return createResponse(200, { message: 'Repository disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting repository:', error);
    return createResponse(500, {
      error: 'Failed to disconnect repository',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle branch change
 */
async function handleChangeBranch(request: GitSyncEvent) {
  const { repositoryId, branch } = request;

  if (!repositoryId || !branch) {
    return createResponse(400, { error: 'Missing repositoryId or branch' });
  }

  try {
    // Update the branch in DynamoDB
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
      UpdateExpression: 'SET branch = :branch, syncStatus = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':branch': branch,
        ':status': 'pending', // Will need to sync with new branch
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return createResponse(200, {
      message: 'Branch changed successfully',
      branch,
    });
  } catch (error) {
    console.error('Error changing branch:', error);
    return createResponse(500, {
      error: 'Failed to change branch',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle get repository by project ID
 */
async function handleGetByProject(request: GitSyncEvent) {
  debugLog('handleGetByProject() called');
  const { projectId } = request;

  debugLog('handleGetByProject() - projectId:', projectId);

  if (!projectId) {
    debugLog('handleGetByProject() - Missing projectId');
    return createResponse(400, { error: 'Missing projectId' });
  }

  try {
    // Query DynamoDB for repository by projectId using GSI
    debugLog('handleGetByProject() - Querying DynamoDB using ProjectIdIndex');

    const { Items } = await dynamoClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'ProjectIdIndex',
      KeyConditionExpression: 'projectId = :projectId',
      FilterExpression: 'attribute_exists(repoUrl)',
      ExpressionAttributeValues: {
        ':projectId': projectId,
      },
      Limit: 1,
    }));

    debugLog('handleGetByProject() - Query results:', Items?.length || 0, 'items');

    if (!Items || Items.length === 0) {
      debugLog('handleGetByProject() - No repository found');
      return createResponse(404, { error: 'Repository not found' });
    }

    const repository = Items[0];
    debugLog('handleGetByProject() - Repository found:', {
      id: repository.id,
      repoUrl: repository.repoUrl,
      branch: repository.branch,
      syncStatus: repository.syncStatus
    });

    return createResponse(200, {
      repository: {
        id: repository.id,
        projectId: repository.projectId,
        repoUrl: repository.repoUrl,
        branch: repository.branch,
        syncStatus: repository.syncStatus,
        lastSyncedAt: repository.lastSyncedAt,
        lastCommitHash: repository.lastCommitHash,
        createdAt: repository.createdAt,
        updatedAt: repository.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting repository by project:', error);
    debugLog('handleGetByProject() - Error:', error);
    return createResponse(500, {
      error: 'Failed to get repository',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle get branches for repository
 */
async function handleGetBranches(request: GitSyncEvent) {
  debugLog('handleGetBranches() called');
  const { repositoryId } = request;

  debugLog('handleGetBranches() - repositoryId:', repositoryId);

  if (!repositoryId) {
    debugLog('handleGetBranches() - Missing repositoryId');
    return createResponse(400, { error: 'Missing repositoryId' });
  }

  try {
    // Get repository record
    debugLog('handleGetBranches() - Fetching repository from DynamoDB');
    const { Item: repository } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
    }));

    if (!repository) {
      debugLog('handleGetBranches() - Repository not found');
      return createResponse(404, { error: 'Repository not found' });
    }

    debugLog('handleGetBranches() - Repository found:', repository.repoUrl);

    // Decrypt access token
    debugLog('handleGetBranches() - Decrypting access token');
    const accessToken = await decryptToken(repository.accessTokenHash);
    debugLog('handleGetBranches() - Token decrypted successfully');

    // Parse repository URL
    debugLog('handleGetBranches() - Parsing repository URL');
    const repoInfo = parseGitHubUrl(repository.repoUrl);
    debugLog('handleGetBranches() - Parsed repo:', repoInfo);

    // Fetch branches from GitHub API
    debugLog('handleGetBranches() - Fetching branches from GitHub');
    const octokit = new Octokit({ auth: accessToken });

    let allBranches: string[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const { data: branches } = await octokit.repos.listBranches({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        per_page: 100,
        page,
      });

      debugLog('handleGetBranches() - Page', page, 'returned', branches.length, 'branches');
      allBranches = allBranches.concat(branches.map(b => b.name));

      if (branches.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    debugLog('handleGetBranches() - Total branches fetched:', allBranches.length);

    return createResponse(200, {
      branches: allBranches,
      currentBranch: repository.branch,
    });

  } catch (error) {
    console.error('Error fetching branches:', error);
    debugLog('handleGetBranches() - Error:', error);
    return createResponse(500, {
      error: 'Failed to fetch branches',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Helper functions
 */

function parseGitHubUrl(url: string): GitHubRepoInfo {
  // Support formats: https://github.com/owner/repo or git@github.com:owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
  
  const match = httpsMatch || sshMatch;
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }

  return {
    owner: match[1],
    repo: match[2],
    branch: 'main',
  };
}

async function encryptToken(token: string): Promise<string> {
  if (!KMS_KEY_ID) {
    // For development, just base64 encode (NOT SECURE)
    return Buffer.from(token).toString('base64');
  }

  const { CiphertextBlob } = await kmsClient.send(new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(token),
  }));

  return Buffer.from(CiphertextBlob!).toString('base64');
}

async function decryptToken(encryptedToken: string): Promise<string> {
  if (!KMS_KEY_ID) {
    // For development, just base64 decode (NOT SECURE)
    return Buffer.from(encryptedToken, 'base64').toString();
  }

  const { Plaintext } = await kmsClient.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedToken, 'base64'),
  }));

  return Buffer.from(Plaintext!).toString();
}

/**
 * Fetch repository tree using GitHub API (no git binary required)
 */
async function fetchRepositoryTree(
  octokit: Octokit,
  repoInfo: GitHubRepoInfo,
  commitSha: string
): Promise<FileNode[]> {
  debugLog('fetchRepositoryTree() - Fetching tree for commit:', commitSha);

  // Directories to exclude
  const excludeDirs = new Set([
    'node_modules', '.git', '.next', 'dist', 'build',
    'coverage', '.amplify', 'out', 'vendor', '__pycache__',
    '.venv', 'venv', 'target', '.gradle', '.idea', '.vscode'
  ]);

  // Get the tree recursively from GitHub
  const { data: treeData } = await octokit.git.getTree({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    tree_sha: commitSha,
    recursive: 'true', // Get full tree recursively
  });

  debugLog('fetchRepositoryTree() - Total items in tree:', treeData.tree.length);

  // Filter and transform the tree
  const fileTree: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  for (const item of treeData.tree) {
    if (!item.path) continue;

    // Skip excluded directories
    const pathParts = item.path.split('/');
    if (pathParts.some(part => excludeDirs.has(part))) {
      continue;
    }

    // Skip binary files and large files
    if (item.size && item.size > 1000000) { // Skip files > 1MB
      continue;
    }

    const node: FileNode = {
      name: pathParts[pathParts.length - 1],
      path: item.path,
      type: item.type === 'tree' ? 'directory' : 'file',
      size: item.size,
    };

    pathMap.set(item.path, node);

    // If it's a top-level item, add to root
    if (pathParts.length === 1) {
      fileTree.push(node);
    }
  }

  // Build hierarchical structure
  for (const [path, node] of pathMap) {
    const pathParts = path.split('/');
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join('/');
      const parent = pathMap.get(parentPath);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      }
    }
  }

  debugLog('fetchRepositoryTree() - File tree built with', fileTree.length, 'root items');
  return fileTree;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

// Removed: buildFileTree function - replaced with GitHub API-based fetchRepositoryTree

async function updateSyncStatus(repositoryId: string, status: string): Promise<void> {
  await dynamoClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { id: repositoryId },
    UpdateExpression: 'SET syncStatus = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    },
  }));
}

async function triggerSync(repositoryId: string): Promise<void> {
  // In a real implementation, this would invoke the same Lambda or use Step Functions
  console.log(`Triggering sync for repository ${repositoryId}`);
  // For now, we'll just update the status
  await updateSyncStatus(repositoryId, 'pending');
}

function createResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
