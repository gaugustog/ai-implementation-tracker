import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { Octokit } from '@octokit/rest';
import simpleGit from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});
const kmsClient = new KMSClient({});

const TABLE_NAME = process.env.TABLE_NAME || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';

interface GitSyncEvent {
  operation: 'sync' | 'connect' | 'disconnect';
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
  console.log('Git Integration Event:', JSON.stringify(event, null, 2));

  try {
    const request: GitSyncEvent = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event.body || event;

    switch (request.operation) {
      case 'connect':
        return await handleConnect(request);
      case 'sync':
        return await handleSync(request);
      case 'disconnect':
        return await handleDisconnect(request);
      default:
        return createResponse(400, { error: 'Invalid operation' });
    }
  } catch (error) {
    console.error('Error in git integration:', error);
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
  const { projectId, repoUrl, accessToken, branch } = request;

  if (!projectId || !repoUrl || !accessToken) {
    return createResponse(400, { error: 'Missing required fields' });
  }

  try {
    // Parse GitHub URL
    const repoInfo = parseGitHubUrl(repoUrl);
    
    // Validate access token with GitHub API
    const octokit = new Octokit({ auth: accessToken });
    const { data: repo } = await octokit.repos.get({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
    });

    // Encrypt the access token
    const encryptedToken = await encryptToken(accessToken);

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

    await dynamoClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: gitRepository,
    }));

    // Trigger initial sync
    await triggerSync(repositoryId);

    return createResponse(200, {
      repositoryId,
      message: 'Repository connected successfully',
      branch: gitRepository.branch,
    });
  } catch (error) {
    console.error('Error connecting repository:', error);
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
  const { repositoryId } = request;

  if (!repositoryId) {
    return createResponse(400, { error: 'Missing repositoryId' });
  }

  try {
    // Get repository record
    const { Item: repository } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
    }));

    if (!repository) {
      return createResponse(404, { error: 'Repository not found' });
    }

    // Update status to syncing
    await updateSyncStatus(repositoryId, 'syncing');

    // Decrypt access token
    const accessToken = await decryptToken(repository.accessTokenHash);

    // Parse repository info
    const repoInfo = parseGitHubUrl(repository.repoUrl);

    // Clone or pull repository
    const tempDir = `/tmp/repo-${repositoryId}`;
    await cloneRepository(repoInfo, accessToken, tempDir, repository.branch);

    // Get latest commit
    const git = simpleGit(tempDir);
    const log = await git.log({ maxCount: 1 });
    const latestCommit = log.latest?.hash || '';

    // Read file structure
    const fileTree = await buildFileTree(tempDir);

    // Store file tree in S3
    const fileTreeKey = `git/${repositoryId}/file-tree-${Date.now()}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileTreeKey,
      Body: JSON.stringify(fileTree),
      ContentType: 'application/json',
    }));

    // Create snapshot record
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

    // Update repository with latest commit and sync status
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

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return createResponse(200, {
      message: 'Repository synced successfully',
      snapshotId,
      commitHash: latestCommit,
    });
  } catch (error) {
    console.error('Error syncing repository:', error);
    
    // Update status to failed
    if (repositoryId) {
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

async function cloneRepository(
  repoInfo: GitHubRepoInfo,
  accessToken: string,
  targetDir: string,
  branch: string
): Promise<void> {
  const repoUrl = `https://${accessToken}@github.com/${repoInfo.owner}/${repoInfo.repo}.git`;
  
  await fs.mkdir(targetDir, { recursive: true });
  const git = simpleGit();
  
  await git.clone(repoUrl, targetDir, ['--depth', '1', '--branch', branch]);
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

async function buildFileTree(dirPath: string, basePath: string = ''): Promise<FileNode[]> {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  const tree: FileNode[] = [];

  // Directories to exclude
  const excludeDirs = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', 
    'coverage', '.amplify', 'out', 'vendor', '__pycache__',
    '.venv', 'venv', 'target', '.gradle', '.idea', '.vscode'
  ]);

  for (const item of items) {
    // Skip excluded directories
    if (item.isDirectory() && excludeDirs.has(item.name)) {
      continue;
    }

    const itemPath = path.join(dirPath, item.name);
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;

    if (item.isDirectory()) {
      const children = await buildFileTree(itemPath, relativePath);
      tree.push({
        name: item.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      const stats = await fs.stat(itemPath);
      tree.push({
        name: item.name,
        path: relativePath,
        type: 'file',
        size: stats.size,
      });
    }
  }

  return tree;
}

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
