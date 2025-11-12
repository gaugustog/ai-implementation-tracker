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
