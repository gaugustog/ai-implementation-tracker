import simpleGit from 'simple-git';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

/**
 * GitClient handles repository cloning, pulling, and cleanup operations.
 * Uses KMS to decrypt Git credentials and manages temporary directories.
 */
export class GitClient {
  /**
   * Clone or pull a repository based on whether it already exists locally.
   *
   * @param repository - Repository object with id, repoUrl, currentBranch
   * @param credentials - Encrypted credentials object with encryptedToken, username
   * @returns Path to the cloned/pulled repository
   */
  async cloneOrPull(repository: any, credentials: any): Promise<string> {
    const repoPath = await this.getRepoPath(repository.id);

    // Decrypt token
    const decryptedToken = await this.decryptToken(credentials.encryptedToken);

    // Build authenticated URL
    const authUrl = this.buildAuthUrl(repository.repoUrl, credentials.username, decryptedToken);

    // Check if repo already exists
    const exists = await this.directoryExists(repoPath);

    if (exists) {
      console.log(`Pulling latest changes for ${repository.repoUrl}`);
      const git = simpleGit(repoPath);

      try {
        // Checkout the specified branch
        await git.checkout(repository.currentBranch || 'main');
        // Pull latest changes
        await git.pull('origin', repository.currentBranch || 'main');
      } catch (error) {
        console.warn(`Pull failed, will re-clone: ${error}`);
        // If pull fails, remove and re-clone
        await this.cleanup(repoPath);
        return this.cloneRepository(authUrl, repoPath, repository.currentBranch);
      }
    } else {
      console.log(`Cloning ${repository.repoUrl}`);
      return this.cloneRepository(authUrl, repoPath, repository.currentBranch);
    }

    return repoPath;
  }

  /**
   * Clone a repository to the specified path.
   * Uses shallow clone (--depth 1) to minimize storage and transfer time.
   *
   * @param authUrl - Authenticated Git URL with credentials
   * @param repoPath - Destination path for clone
   * @param branch - Branch to clone (defaults to 'main')
   * @returns Path to cloned repository
   */
  private async cloneRepository(authUrl: string, repoPath: string, branch?: string): Promise<string> {
    const git = simpleGit();

    const cloneOptions = [
      '--depth', '1', // Shallow clone to save space and time
      '--single-branch', // Only clone the specified branch
      '--branch', branch || 'main', // Default to main if no branch specified
    ];

    try {
      await git.clone(authUrl, repoPath, cloneOptions);
      console.log(`Successfully cloned to ${repoPath}`);
    } catch (error: any) {
      console.error(`Clone failed: ${error.message}`);

      // If branch doesn't exist, try without branch specification
      if (error.message.includes('Remote branch') || error.message.includes('not found')) {
        console.log('Retrying clone without branch specification...');
        await git.clone(authUrl, repoPath, ['--depth', '1']);
      } else {
        throw error;
      }
    }

    return repoPath;
  }

  /**
   * Remove repository directory and all contents.
   * Used for cleanup after analysis or to re-clone on errors.
   *
   * @param repoPath - Path to repository directory
   */
  async cleanup(repoPath: string): Promise<void> {
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
      console.log(`Cleaned up ${repoPath}`);
    } catch (error) {
      console.error(`Error cleaning up ${repoPath}:`, error);
      // Don't throw - cleanup is best-effort
    }
  }

  /**
   * Get the local path for a repository.
   * Creates a consistent directory structure in Lambda's /tmp storage.
   *
   * @param repositoryId - Unique repository ID
   * @returns Absolute path to repository directory
   */
  private async getRepoPath(repositoryId: string): Promise<string> {
    const tmpDir = os.tmpdir();
    const repoPath = path.join(tmpDir, 'specforge-repos', repositoryId);

    // Ensure parent directory exists
    const parentDir = path.dirname(repoPath);
    await fs.mkdir(parentDir, { recursive: true });

    return repoPath;
  }

  /**
   * Decrypt an encrypted token using AWS KMS.
   * Tokens are encrypted in Epic-01 git-integration Lambda.
   *
   * @param encryptedToken - Base64-encoded encrypted token
   * @returns Decrypted token as plain text
   */
  private async decryptToken(encryptedToken: string): Promise<string> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedToken, 'base64'),
    });

    try {
      const response = await kmsClient.send(command);

      if (!response.Plaintext) {
        throw new Error('KMS decrypt returned no plaintext');
      }

      return Buffer.from(response.Plaintext).toString('utf-8');
    } catch (error: any) {
      console.error('KMS decryption failed:', error);
      throw new Error(`Failed to decrypt credentials: ${error.message}`);
    }
  }

  /**
   * Build an authenticated Git URL with credentials embedded.
   * Supports multiple authentication patterns for different Git providers.
   *
   * @param repoUrl - Original repository URL (https://github.com/...)
   * @param username - Git username (or token for GitHub)
   * @param token - Git token/password
   * @returns Authenticated URL with credentials embedded
   */
  private buildAuthUrl(repoUrl: string, username: string, token: string): string {
    try {
      const url = new URL(repoUrl);

      // GitHub: Use token as username, leave password empty
      // GitLab/Bitbucket: Use username and token
      if (url.hostname.includes('github.com')) {
        url.username = token;
        url.password = ''; // GitHub doesn't need password when using PAT
      } else if (username && token) {
        url.username = username;
        url.password = token;
      } else if (token) {
        // Fallback: use token as username
        url.username = token;
      }

      return url.toString();
    } catch (error: any) {
      console.error('Failed to build auth URL:', error);
      throw new Error(`Invalid repository URL: ${repoUrl}`);
    }
  }

  /**
   * Check if a directory exists.
   *
   * @param path - Path to check
   * @returns true if directory exists, false otherwise
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch of a repository.
   * Useful for verification after clone/pull.
   *
   * @param repoPath - Path to repository
   * @returns Current branch name
   */
  async getCurrentBranch(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath);
    const status = await git.status();
    return status.current || 'unknown';
  }

  /**
   * Get the latest commit hash.
   * Useful for tracking which version was analyzed.
   *
   * @param repoPath - Path to repository
   * @returns Latest commit hash
   */
  async getLatestCommit(repoPath: string): Promise<string> {
    const git = simpleGit(repoPath);
    const log = await git.log({ maxCount: 1 });
    return log.latest?.hash || 'unknown';
  }
}
