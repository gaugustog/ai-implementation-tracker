import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

/**
 * AppSyncClient provides a typed interface for GraphQL operations.
 * All database operations in monorepo-analyzer MUST use this client.
 *
 * Architecture: AppSync-First
 * - No direct DynamoDB access
 * - IAM authentication via Lambda role
 * - Automatic request signing with SigV4
 */
export class AppSyncClient {
  private apiEndpoint: string;
  private region: string;

  /**
   * Initialize AppSync client with endpoint and API ID.
   * These are injected by Amplify as environment variables.
   *
   * @param config - Configuration with apiEndpoint
   */
  constructor(config: { apiEndpoint: string }) {
    this.apiEndpoint = config.apiEndpoint;
    this.region = process.env.AWS_REGION || 'us-east-1';
  }

  /**
   * Execute a GraphQL query.
   *
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @returns Query result data
   */
  async query(query: string, variables: any = {}): Promise<any> {
    return this.execute(query, variables);
  }

  /**
   * Execute a GraphQL mutation.
   *
   * @param mutation - GraphQL mutation string
   * @param variables - Mutation variables
   * @returns Mutation result data
   */
  async mutate(mutation: string, variables: any = {}): Promise<any> {
    return this.execute(mutation, variables);
  }

  /**
   * Execute a GraphQL operation (query or mutation).
   * Handles IAM authentication, request signing, and error handling.
   *
   * @param operation - GraphQL operation string
   * @param variables - Operation variables
   * @returns Operation result
   */
  private async execute(operation: string, variables: any): Promise<any> {
    const url = new URL(this.apiEndpoint);

    const body = JSON.stringify({
      query: operation,
      variables,
    });

    // Create HTTP request
    const request = new HttpRequest({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'host': url.hostname,
      },
      body,
    });

    // Sign request with IAM credentials (Lambda role)
    const signer = new SignatureV4({
      service: 'appsync',
      region: this.region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });

    const signedRequest = await signer.sign(request);

    // Execute request
    const response = await fetch(this.apiEndpoint, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
    });

    const result = (await response.json()) as any;

    // Handle GraphQL errors
    if (result.errors) {
      console.error('AppSync errors:', JSON.stringify(result.errors, null, 2));
      throw new Error(result.errors[0].message);
    }

    // Return first data field (assumes single operation)
    return result.data[Object.keys(result.data)[0]];
  }

  // ===================================================================
  // GitRepository Operations
  // ===================================================================

  /**
   * Get a GitRepository by ID.
   *
   * @param id - Repository ID
   * @returns Repository object
   */
  async getRepository(id: string): Promise<any> {
    const query = `
      query GetRepository($id: ID!) {
        getGitRepository(id: $id) {
          id
          projectId
          provider
          repoUrl
          currentBranch
          branches
          isMonorepo
          monorepoType
          status
          lastAnalyzedAt
          lastSyncedAt
        }
      }
    `;

    return this.query(query, { id });
  }

  /**
   * Update a GitRepository.
   * Used to set status, monorepo type, and analysis timestamps.
   *
   * @param id - Repository ID
   * @param input - Fields to update
   * @returns Updated repository
   */
  async updateRepository(id: string, input: any): Promise<any> {
    const mutation = `
      mutation UpdateRepository($input: UpdateGitRepositoryInput!) {
        updateGitRepository(input: $input) {
          id
          status
          isMonorepo
          monorepoType
          lastAnalyzedAt
          lastSyncedAt
        }
      }
    `;

    return this.mutate(mutation, { input: { id, ...input } });
  }

  // ===================================================================
  // GitCredential Operations
  // ===================================================================

  /**
   * Get GitCredential for a repository.
   * Credentials are encrypted with KMS and must be decrypted by GitClient.
   *
   * @param repositoryId - Repository ID
   * @returns Credential object with encryptedToken
   */
  async getGitCredential(repositoryId: string): Promise<any> {
    const query = `
      query GetGitCredential($repositoryId: ID!) {
        listGitCredentials(filter: { repositoryId: { eq: $repositoryId } }) {
          items {
            id
            repositoryId
            type
            encryptedToken
            username
            createdAt
          }
        }
      }
    `;

    const result = await this.query(query, { repositoryId });

    // Return first credential (should only be one per repository)
    if (!result.items || result.items.length === 0) {
      return null;
    }

    return result.items[0];
  }

  // ===================================================================
  // MonorepoStructure Operations
  // ===================================================================

  /**
   * Create a MonorepoStructure record.
   * Only called for monorepo repositories (not single repos).
   *
   * @param input - MonorepoStructure data
   * @returns Created structure
   */
  async createMonorepoStructure(input: {
    repositoryId: string;
    type: string;
    workspaceCount: number;
    rootConfig: any;
    dependencyGraph: any;
    analyzedAt: string;
  }): Promise<any> {
    const mutation = `
      mutation CreateMonorepoStructure($input: CreateMonorepoStructureInput!) {
        createMonorepoStructure(input: $input) {
          id
          repositoryId
          type
          workspaceCount
          analyzedAt
        }
      }
    `;

    return this.mutate(mutation, { input });
  }

  /**
   * Get MonorepoStructure by repository ID.
   *
   * @param repositoryId - Repository ID
   * @returns MonorepoStructure or null
   */
  async getMonorepoStructure(repositoryId: string): Promise<any> {
    const query = `
      query GetMonorepoStructure($repositoryId: ID!) {
        listMonorepoStructures(filter: { repositoryId: { eq: $repositoryId } }) {
          items {
            id
            repositoryId
            type
            workspaceCount
            rootConfig
            dependencyGraph
            analyzedAt
          }
        }
      }
    `;

    const result = await this.query(query, { repositoryId });
    return result.items?.[0] || null;
  }

  // ===================================================================
  // Workspace Operations
  // ===================================================================

  /**
   * Create a Workspace record.
   * Called for each workspace/package in a monorepo, or once for single repos.
   *
   * @param input - Workspace data
   * @returns Created workspace
   */
  async createWorkspace(input: {
    repositoryId: string;
    name: string;
    path: string;
    type: 'app' | 'package' | 'library' | 'feature' | 'single';
    framework?: string;
    language?: string;
    packageJson: any;
    metadata: any;
  }): Promise<any> {
    const mutation = `
      mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) {
          id
          repositoryId
          name
          path
          type
          framework
          language
        }
      }
    `;

    return this.mutate(mutation, { input });
  }

  /**
   * List all workspaces for a repository.
   *
   * @param repositoryId - Repository ID
   * @returns Array of workspaces
   */
  async listWorkspaces(repositoryId: string): Promise<any[]> {
    const query = `
      query ListWorkspaces($repositoryId: ID!) {
        listWorkspaces(filter: { repositoryId: { eq: $repositoryId } }) {
          items {
            id
            repositoryId
            name
            path
            type
            framework
            language
            packageJson
            metadata
          }
        }
      }
    `;

    const result = await this.query(query, { repositoryId });
    return result.items || [];
  }

  /**
   * Delete all workspaces for a repository.
   * Used when re-analyzing to ensure clean state.
   *
   * @param repositoryId - Repository ID
   */
  async deleteWorkspaces(repositoryId: string): Promise<void> {
    const workspaces = await this.listWorkspaces(repositoryId);

    for (const workspace of workspaces) {
      const mutation = `
        mutation DeleteWorkspace($input: DeleteWorkspaceInput!) {
          deleteWorkspace(input: $input) {
            id
          }
        }
      `;

      await this.mutate(mutation, { input: { id: workspace.id } });
    }
  }

  // ===================================================================
  // MonorepoDependency Operations
  // ===================================================================

  /**
   * Create a MonorepoDependency record.
   * Represents an internal dependency between workspaces.
   *
   * @param input - Dependency data
   * @returns Created dependency
   */
  async createMonorepoDependency(input: {
    workspaceId: string;
    dependsOnWorkspaceId: string;
    monorepoStructureId: string;
    type: 'internal' | 'external' | 'peer' | 'dev';
    version?: string;
  }): Promise<any> {
    const mutation = `
      mutation CreateDependency($input: CreateMonorepoDependencyInput!) {
        createMonorepoDependency(input: $input) {
          id
          workspaceId
          dependsOnWorkspaceId
          monorepoStructureId
          type
          version
        }
      }
    `;

    return this.mutate(mutation, { input });
  }

  /**
   * List all dependencies for a monorepo structure.
   *
   * @param monorepoStructureId - MonorepoStructure ID
   * @returns Array of dependencies
   */
  async listDependencies(monorepoStructureId: string): Promise<any[]> {
    const query = `
      query ListDependencies($monorepoStructureId: ID!) {
        listMonorepoDependencies(
          filter: { monorepoStructureId: { eq: $monorepoStructureId } }
        ) {
          items {
            id
            workspaceId
            dependsOnWorkspaceId
            monorepoStructureId
            type
            version
          }
        }
      }
    `;

    const result = await this.query(query, { monorepoStructureId });
    return result.items || [];
  }

  /**
   * Delete all dependencies for a monorepo structure.
   * Used when re-analyzing to ensure clean state.
   *
   * @param monorepoStructureId - MonorepoStructure ID
   */
  async deleteDependencies(monorepoStructureId: string): Promise<void> {
    const dependencies = await this.listDependencies(monorepoStructureId);

    for (const dependency of dependencies) {
      const mutation = `
        mutation DeleteDependency($input: DeleteMonorepoDependencyInput!) {
          deleteMonorepoDependency(input: $input) {
            id
          }
        }
      `;

      await this.mutate(mutation, { input: { id: dependency.id } });
    }
  }

  // ===================================================================
  // Batch Operations
  // ===================================================================

  /**
   * Batch create workspaces.
   * More efficient than creating one at a time.
   *
   * @param workspaces - Array of workspace data
   * @returns Array of created workspaces
   */
  async batchCreateWorkspaces(workspaces: any[]): Promise<any[]> {
    const results = [];

    // AppSync doesn't support batch mutations natively
    // So we execute them sequentially but with Promise.all for parallelism
    const promises = workspaces.map(workspace =>
      this.createWorkspace(workspace)
    );

    try {
      const created = await Promise.all(promises);
      results.push(...created);
    } catch (error) {
      console.error('Error in batch create workspaces:', error);
      throw error;
    }

    return results;
  }

  /**
   * Batch create dependencies.
   * More efficient than creating one at a time.
   *
   * @param dependencies - Array of dependency data
   * @returns Array of created dependencies
   */
  async batchCreateDependencies(dependencies: any[]): Promise<any[]> {
    const results = [];

    const promises = dependencies.map(dependency =>
      this.createMonorepoDependency(dependency)
    );

    try {
      const created = await Promise.all(promises);
      results.push(...created);
    } catch (error) {
      console.error('Error in batch create dependencies:', error);
      throw error;
    }

    return results;
  }
}
