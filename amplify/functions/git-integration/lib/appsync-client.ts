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

      const result = await response.json() as any;

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
