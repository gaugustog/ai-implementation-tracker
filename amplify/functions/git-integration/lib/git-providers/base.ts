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
