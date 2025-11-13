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

// AWS SDK imports for IAM authentication
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Hash } from '@smithy/hash-node';

export class AppSyncClient {
  private apiEndpoint: string;
  private region: string;
  private signer: SignatureV4;

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;

    // Extract region from AppSync endpoint
    // Format: https://{api-id}.appsync-api.{region}.amazonaws.com/graphql
    const match = apiEndpoint.match(/\.appsync-api\.([^.]+)\.amazonaws\.com/);
    this.region = match ? match[1] : 'us-east-1';

    // Initialize AWS Signature V4 signer
    this.signer = new SignatureV4({
      service: 'appsync',
      region: this.region,
      credentials: defaultProvider(),
      sha256: Hash.bind(null, 'sha256'),
    });
  }

  /**
   * Execute GraphQL query/mutation with AWS IAM authentication
   */
  private async execute(query: string, variables: any): Promise<any> {
    try {
      console.log('Executing GraphQL operation...');
      console.log('Variables:', JSON.stringify(variables, null, 2));

      // Prepare request body
      const body = JSON.stringify({ query, variables });

      // Parse endpoint URL
      const url = new URL(this.apiEndpoint);

      // Create HTTP request for signing
      const httpRequest = new HttpRequest({
        method: 'POST',
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          host: url.hostname,
        },
        body,
      });

      // Sign the request with AWS Signature V4
      console.log('Signing request with AWS IAM credentials...');
      const signedRequest = await this.signer.sign(httpRequest);

      // Execute signed request
      const response = await fetch(this.apiEndpoint, {
        method: signedRequest.method,
        headers: signedRequest.headers as Record<string, string>,
        body: signedRequest.body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}. ${errorText}`);
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
    // Query uses listGitCredentials, so get first item
    const items = data.listGitCredentials?.items || [];
    if (items.length === 0) {
      throw new Error(`No credential found for repository: ${repositoryId}`);
    }
    return items[0];
  }

  async updateGitCredential(input: AppSyncUpdateGitCredentialInput): Promise<GitCredential> {
    const data = await this.execute(UPDATE_GIT_CREDENTIAL, { input });
    return data.updateGitCredential;
  }
}
