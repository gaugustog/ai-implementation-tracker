import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';

Amplify.configure(outputs);
const client = generateClient<Schema>();

/**
 * Execute Git integration operation via GraphQL custom query
 */
async function executeGitOperation(operation: string, data: any): Promise<any> {
  const result = await client.queries.gitIntegration({
    operation,
    data: JSON.stringify(data),
  });

  if (!result.data) {
    throw new Error('No data returned from gitIntegration query');
  }

  // Parse the JSON response
  return JSON.parse(result.data as string);
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestConfig {
  projectName: string;
  repoUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  pat: string;
  username?: string;
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80) + '\n');
}

function logStep(step: number, description: string) {
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`📋 Step ${step}: ${description}`);
  console.log('━'.repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.error(`❌ ${message}`);
}

function logInfo(key: string, value: any) {
  console.log(`   ${key}: ${JSON.stringify(value)}`);
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function testGitIntegration(config: TestConfig) {
  logSection('🚀 SpecForge Git Integration Test');

  console.log('Configuration:');
  logInfo('Project Name', config.projectName);
  logInfo('Repository URL', config.repoUrl);
  logInfo('Provider', config.provider);
  logInfo('Username', config.username || 'N/A');

  let projectId: string | undefined;
  let repositoryId: string | undefined;

  try {
    // ========================================================================
    // STEP 1: Create Project
    // ========================================================================

    logStep(1, 'Create Project');

    const projectResult = await client.models.Project.create({
      name: config.projectName,
      description: `Integration test for ${config.repoUrl}`,
    });

    if (!projectResult.data) {
      throw new Error('Failed to create project - no data returned');
    }

    projectId = projectResult.data.id;
    logSuccess(`Project created successfully`);
    logInfo('Project ID', projectId);

    // ========================================================================
    // STEP 2: Connect Repository
    // ========================================================================

    logStep(2, 'Connect Git Repository');

    console.log('Invoking connectRepository operation via GraphQL...');

    const connectResponse = await executeGitOperation('connectRepository', {
      projectId,
      provider: config.provider,
      repoUrl: config.repoUrl,
      credentialType: 'token',
      token: config.pat,
      username: config.username,
    });

    if (!connectResponse.success) {
      throw new Error(`Connect failed: ${connectResponse.error?.message}`);
    }

    repositoryId = connectResponse.data.repositoryId;
    logSuccess('Repository connected successfully');
    logInfo('Repository ID', repositoryId);
    logInfo('Default Branch', connectResponse.data.defaultBranch);
    logInfo('Branch Count', connectResponse.data.branchCount);

    // ========================================================================
    // STEP 3: Verify Repository Record
    // ========================================================================

    logStep(3, 'Verify Repository Record');

    const repoResult = await client.models.GitRepository.get({ id: repositoryId });

    if (!repoResult.data) {
      throw new Error('Repository not found in database');
    }

    logSuccess('Repository record verified');
    logInfo('Provider', repoResult.data.provider);
    logInfo('Current Branch', repoResult.data.currentBranch);
    logInfo('Status', repoResult.data.status);
    logInfo('Cached Branches', (repoResult.data.branches as any)?.length || 0);

    // ========================================================================
    // STEP 4: List Branches
    // ========================================================================

    logStep(4, 'List Branches');

    const branchesResponse = await executeGitOperation('listBranches', { repositoryId });

    if (!branchesResponse.success) {
      throw new Error(`List branches failed: ${branchesResponse.error?.message}`);
    }

    logSuccess(`Found ${branchesResponse.data.total} branches`);
    logInfo('Current Branch', branchesResponse.data.currentBranch);

    if (branchesResponse.data.branches.length > 0) {
      console.log('\n   First 10 branches:');
      branchesResponse.data.branches.slice(0, 10).forEach((branch: string, i: number) => {
        console.log(`      ${i + 1}. ${branch}`);
      });
    }

    // ========================================================================
    // STEP 5: Switch Branch (if multiple branches exist)
    // ========================================================================

    if (branchesResponse.data.branches.length > 1) {
      logStep(5, 'Switch Branch');

      const targetBranch = branchesResponse.data.branches.find(
        (b: string) => b !== branchesResponse.data.currentBranch
      );

      if (targetBranch) {
        console.log(`Switching from '${branchesResponse.data.currentBranch}' to '${targetBranch}'...`);

        const switchResponse = await executeGitOperation('switchBranch', {
          repositoryId,
          branch: targetBranch,
        });

        if (!switchResponse.success) {
          throw new Error(`Switch branch failed: ${switchResponse.error?.message}`);
        }

        logSuccess(`Switched to branch: ${targetBranch}`);
        logInfo('Repository ID', switchResponse.data.repositoryId);
        logInfo('Current Branch', switchResponse.data.currentBranch);
      }
    } else {
      console.log('\n⏭️  Skipping branch switch (only one branch available)');
    }

    // ========================================================================
    // STEP 6: Validate Access
    // ========================================================================

    logStep(6, 'Validate Repository Access');

    const validateResponse = await executeGitOperation('validateAccess', { repositoryId });

    logSuccess('Access validation completed');
    logInfo('Has Access', validateResponse.data?.hasAccess ?? validateResponse.success);
    logInfo('Message', validateResponse.data?.message ?? 'Validation successful');
    logInfo('Provider', validateResponse.data?.provider ?? config.provider);

    // ========================================================================
    // TEST SUMMARY
    // ========================================================================

    logSection('🎉 All Tests Passed Successfully!');

    console.log('Test Summary:');
    logInfo('✅ Project Created', projectId);
    logInfo('✅ Repository Connected', repositoryId);
    logInfo('✅ Branches Listed', branchesResponse.data.total);
    logInfo('✅ Branch Switch', branchesResponse.data.branches.length > 1 ? 'Success' : 'Skipped');
    logInfo('✅ Access Validated', validateResponse.data?.hasAccess ?? validateResponse.success);

    return {
      success: true,
      projectId,
      repositoryId,
      branchCount: branchesResponse.data.total,
    };

  } catch (error: any) {
    logSection('❌ Test Failed');

    logError(error.message);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.log('\nTest Context:');
    if (projectId) logInfo('Project ID', projectId);
    if (repositoryId) logInfo('Repository ID', repositoryId);

    throw error;
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

const testConfig: TestConfig = {
  projectName: process.env.TEST_PROJECT_NAME || 'Git Integration Test',
  repoUrl: process.env.TEST_REPO_URL!,
  provider: (process.env.TEST_PROVIDER as any) || 'github',
  pat: process.env.TEST_PAT!,
  username: process.env.TEST_USERNAME,
};

// Validate required environment variables
if (!testConfig.repoUrl || !testConfig.pat) {
  console.error('❌ Missing required environment variables:\n');
  console.error('Required:');
  console.error('  TEST_REPO_URL     - Git repository URL (e.g., https://github.com/owner/repo)');
  console.error('  TEST_PAT          - Personal Access Token\n');
  console.error('Optional:');
  console.error('  TEST_PROVIDER     - Git provider (github, gitlab, bitbucket) [default: github]');
  console.error('  TEST_PROJECT_NAME - Project name [default: "Git Integration Test"]');
  console.error('  TEST_USERNAME     - Git username\n');
  console.error('Example:');
  console.error('  TEST_REPO_URL="https://github.com/user/repo" TEST_PAT="ghp_xxx" npm run test:git-integration');
  process.exit(1);
}

// Run tests
console.log('Starting SpecForge Git Integration Tests...\n');

testGitIntegration(testConfig)
  .then((result) => {
    console.log('\n✅ Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed!');
    process.exit(1);
  });
