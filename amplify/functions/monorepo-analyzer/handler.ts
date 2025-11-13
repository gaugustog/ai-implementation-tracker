import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { AppSyncResolverHandler } from 'aws-lambda';
import { AppSyncClient } from './lib/appsync-client';
import { GitClient } from './lib/git-client';
import { detectMonorepoType } from './lib/detector';
import { analyzeMonorepo } from './lib/analyzers/index';
import { analyzeSingleRepo } from './lib/single-repo-analyzer';

// SSM client for parameter retrieval
const ssmClient = new SSMClient({});

// Singleton instances (reused across warm Lambda invocations)
let appsyncClient: AppSyncClient | null = null;
let gitClient: GitClient | null = null;

/**
 * Input for analyzeRepository operation.
 */
interface AnalyzeRepositoryInput {
  repositoryId: string;
  forceReanalysis?: boolean;
}

/**
 * Output for analyzeRepository operation.
 */
interface AnalyzeRepositoryOutput {
  success: boolean;
  message: string;
  analysisResult?: {
    repositoryId: string;
    isMonorepo: boolean;
    monorepoType?: string;
    workspaceCount: number;
    dependencyCount: number;
  };
}

/**
 * Initialize Lambda dependencies.
 * Retrieves AppSync endpoint from SSM Parameter Store.
 */
async function initialize(): Promise<void> {
  if (appsyncClient && gitClient) {
    console.log('Using cached clients');
    return;
  }

  console.log('Initializing monorepo-analyzer Lambda...');

  // Get AppSync endpoint from SSM Parameter Store
  const appsyncUrlParameterName = process.env.APPSYNC_URL_PARAMETER;
  if (!appsyncUrlParameterName) {
    throw new Error('Missing APPSYNC_URL_PARAMETER environment variable');
  }

  console.log(`Retrieving AppSync endpoint from SSM: ${appsyncUrlParameterName}`);

  const appsyncUrlCommand = new GetParameterCommand({
    Name: appsyncUrlParameterName,
  });

  const appsyncUrlResponse = await ssmClient.send(appsyncUrlCommand);
  const appsyncEndpoint = appsyncUrlResponse.Parameter?.Value;

  if (!appsyncEndpoint) {
    throw new Error('Failed to retrieve AppSync endpoint from SSM Parameter Store');
  }

  console.log('AppSync endpoint retrieved from SSM');

  // Initialize clients
  appsyncClient = new AppSyncClient({ apiEndpoint: appsyncEndpoint });
  gitClient = new GitClient();

  console.log('✅ Lambda initialized successfully');
}

/**
 * Main Lambda handler for repository analysis.
 *
 * Process:
 * 1. Initialize clients (AppSync, Git)
 * 2. Update repository status to 'analyzing'
 * 3. Get repository and credentials from AppSync
 * 4. Clone/pull repository using Git client
 * 5. Detect monorepo type
 * 6. Branch logic:
 *    - Monorepo: Run monorepo analyzer → create MonorepoStructure + Workspaces + Dependencies
 *    - Single: Run single repo analyzer → create single Workspace
 * 7. Persist analysis results to AppSync
 * 8. Update repository status to 'ready'
 * 9. Clean up cloned repository
 *
 * Error Handling:
 * - Sets repository status to 'error' on any failure
 * - Logs detailed error information
 * - Cleans up cloned repository on error
 */
export const handler: AppSyncResolverHandler<
  AnalyzeRepositoryInput,
  AnalyzeRepositoryOutput
> = async (event) => {
  console.log('='.repeat(80));
  console.log('monorepo-analyzer Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('='.repeat(80));

  const { repositoryId, forceReanalysis = false } = event.arguments;

  let repoPath: string | null = null;

  try {
    // Initialize dependencies
    await initialize();

    // Update repository status to analyzing
    console.log('\n📝 Updating repository status to analyzing...');
    await appsyncClient!.updateRepository(repositoryId, {
      status: 'analyzing',
    });

    // Get repository details
    console.log('\n📋 Fetching repository details...');
    const repository = await appsyncClient!.getRepository(repositoryId);

    console.log('Repository:', {
      id: repository.id,
      repoUrl: repository.repoUrl,
      provider: repository.provider,
      currentBranch: repository.currentBranch,
    });

    // Get credentials
    console.log('\n🔑 Fetching Git credentials...');
    const credentials = await appsyncClient!.getGitCredential(repositoryId);

    if (!credentials) {
      throw new Error('No credentials found for repository');
    }

    // Clone or pull repository
    console.log('\n📦 Cloning/pulling repository...');
    repoPath = await gitClient!.cloneOrPull(repository, credentials);

    console.log(`Repository cloned to: ${repoPath}`);

    // Detect monorepo type
    console.log('\n🔍 Detecting monorepo type...');
    const monorepoType = await detectMonorepoType(repoPath);

    console.log(`Detected type: ${monorepoType || 'single repository'}`);

    // Clean up existing analysis data if forceReanalysis
    if (forceReanalysis) {
      console.log('\n🧹 Force reanalysis: cleaning up existing data...');

      // Delete existing workspaces
      await appsyncClient!.deleteWorkspaces(repositoryId);

      // If there was a monorepo structure, delete dependencies
      const existingStructure = await appsyncClient!.getMonorepoStructure(repositoryId);
      if (existingStructure) {
        await appsyncClient!.deleteDependencies(existingStructure.id);
      }
    }

    // Branch based on monorepo type
    let analysisResult;

    if (monorepoType) {
      // Monorepo analysis
      console.log(`\n🏗️  Analyzing ${monorepoType} monorepo...`);

      analysisResult = await analyzeMonorepo(repositoryId, repoPath, monorepoType);

      console.log('\n✅ Monorepo analysis complete:');
      console.log(`   - Workspaces: ${analysisResult.workspaces.length}`);
      console.log(`   - Dependencies: ${analysisResult.dependencies.length}`);

      // Create MonorepoStructure
      console.log('\n💾 Creating MonorepoStructure record...');
      const monorepoStructure = await appsyncClient!.createMonorepoStructure({
        repositoryId,
        type: analysisResult.structure.type,
        workspaceCount: analysisResult.structure.workspaceCount,
        rootConfig: analysisResult.structure.rootConfig,
        dependencyGraph: analysisResult.structure.dependencyGraph,
        analyzedAt: new Date().toISOString(),
      });

      console.log(`MonorepoStructure created: ${monorepoStructure.id}`);

      // Create all workspaces (batch operation)
      console.log('\n💾 Creating workspace records...');
      const createdWorkspaces = await appsyncClient!.batchCreateWorkspaces(
        analysisResult.workspaces.map(ws => ({
          repositoryId,
          name: ws.name,
          path: ws.path,
          type: ws.type,
          framework: ws.framework,
          language: ws.language,
          packageJson: ws.packageJson,
          metadata: ws.metadata,
        }))
      );

      console.log(`Created ${createdWorkspaces.length} workspaces`);

      // Build workspace name → ID mapping
      const workspaceIdMap = new Map<string, string>();
      for (const workspace of createdWorkspaces) {
        workspaceIdMap.set(workspace.name, workspace.id);
      }

      // Create dependencies
      if (analysisResult.dependencies.length > 0) {
        console.log('\n💾 Creating dependency records...');

        const dependenciesToCreate = analysisResult.dependencies
          .map(dep => {
            const workspaceId = workspaceIdMap.get(dep.workspaceName);
            const dependsOnWorkspaceId = workspaceIdMap.get(dep.dependsOnWorkspaceName);

            if (!workspaceId || !dependsOnWorkspaceId) {
              console.warn(
                `Skipping dependency: ${dep.workspaceName} → ${dep.dependsOnWorkspaceName} (workspace not found)`
              );
              return null;
            }

            return {
              workspaceId,
              dependsOnWorkspaceId,
              monorepoStructureId: monorepoStructure.id,
              type: dep.type,
              version: dep.version,
            };
          })
          .filter((dep): dep is NonNullable<typeof dep> => dep !== null);

        const createdDependencies = await appsyncClient!.batchCreateDependencies(
          dependenciesToCreate
        );

        console.log(`Created ${createdDependencies.length} dependencies`);
      }

      // Update repository with monorepo info
      console.log('\n💾 Updating repository record...');
      await appsyncClient!.updateRepository(repositoryId, {
        isMonorepo: true,
        monorepoType: monorepoType,
        status: 'ready',
        lastAnalyzedAt: new Date().toISOString(),
      });
    } else {
      // Single repository analysis
      console.log('\n📄 Analyzing single repository...');

      analysisResult = await analyzeSingleRepo(repositoryId, repoPath);

      console.log('\n✅ Single repository analysis complete');

      // Create single workspace
      console.log('\n💾 Creating workspace record...');
      const workspace = analysisResult.workspaces[0];

      await appsyncClient!.createWorkspace({
        repositoryId,
        name: workspace.name,
        path: workspace.path,
        type: workspace.type,
        framework: workspace.framework,
        language: workspace.language,
        packageJson: workspace.packageJson,
        metadata: workspace.metadata,
      });

      console.log(`Created workspace: ${workspace.name}`);

      // Update repository (single repo, no monorepo type)
      console.log('\n💾 Updating repository record...');
      await appsyncClient!.updateRepository(repositoryId, {
        isMonorepo: false,
        monorepoType: null,
        status: 'ready',
        lastAnalyzedAt: new Date().toISOString(),
      });
    }

    // Clean up cloned repository
    console.log('\n🧹 Cleaning up cloned repository...');
    await gitClient!.cleanup(repoPath);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Repository analysis completed successfully');
    console.log('='.repeat(80));

    return {
      success: true,
      message: 'Repository analyzed successfully',
      analysisResult: {
        repositoryId,
        isMonorepo: !!monorepoType,
        monorepoType: monorepoType || undefined,
        workspaceCount: analysisResult.workspaces.length,
        dependencyCount: analysisResult.dependencies.length,
      },
    };
  } catch (error: any) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Error during repository analysis:');
    console.error(error);
    console.error('='.repeat(80));

    // Update repository status to error
    try {
      if (appsyncClient) {
        await appsyncClient.updateRepository(repositoryId, {
          status: 'error',
        });
      }
    } catch (updateError) {
      console.error('Failed to update repository status to error:', updateError);
    }

    // Clean up cloned repository on error
    if (repoPath && gitClient) {
      try {
        await gitClient.cleanup(repoPath);
      } catch (cleanupError) {
        console.error('Failed to cleanup repository:', cleanupError);
      }
    }

    return {
      success: false,
      message: `Analysis failed: ${error.message}`,
    };
  }
};
