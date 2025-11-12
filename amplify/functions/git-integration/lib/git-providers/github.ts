import type { IGitProvider } from './base';

// GitHub provider implementation will be added in MVP-005-01
export class GitHubProvider implements IGitProvider {
  async getDefaultBranch(repoUrl: string, token: string): Promise<string> {
    throw new Error('GitHub provider not yet implemented');
  }

  async listBranches(repoUrl: string, token: string): Promise<string[]> {
    throw new Error('GitHub provider not yet implemented');
  }

  async branchExists(repoUrl: string, branch: string, token: string): Promise<boolean> {
    throw new Error('GitHub provider not yet implemented');
  }

  async validateAccess(repoUrl: string, token: string): Promise<void> {
    throw new Error('GitHub provider not yet implemented');
  }
}
