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
    } catch (error: any) {
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
    } catch (error: any) {
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
          branches.push(...data.map((b: any) => b.name));
          page++;

          // Limit to 500 branches to avoid excessive API calls
          if (branches.length >= 500) {
            hasMore = false;
          }
        }
      }

      console.log(`[GitHub] ✅ Found ${branches.length} branches`);
      return branches;
    } catch (error: any) {
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
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`[GitHub] ℹ️ Branch does not exist: ${branch}`);
          return false;
        }
        throw error;
      }
    } catch (error: any) {
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
    } catch (error: any) {
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
