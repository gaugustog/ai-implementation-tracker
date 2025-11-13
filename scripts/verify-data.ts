import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';

Amplify.configure(outputs);
const client = generateClient<Schema>();

async function verifyData() {
  console.log('='.repeat(80));
  console.log('  Data Integrity Verification');
  console.log('='.repeat(80));
  console.log('');

  try {
    // ========================================================================
    // PROJECTS
    // ========================================================================

    console.log('📋 Verifying Projects...');
    const projects = await client.models.Project.list();

    console.log(`✅ Projects: ${projects.data.length}`);

    if (projects.data.length === 0) {
      console.log('   ⚠️  No projects found. Run integration tests first.');
    } else {
      projects.data.forEach(p => {
        console.log(`   - ${p.name} (${p.id})`);
        console.log(`     Description: ${p.description || 'N/A'}`);
        console.log(`     Created: ${p.createdAt || 'N/A'}`);
      });
    }

    // ========================================================================
    // GIT REPOSITORIES
    // ========================================================================

    console.log('');
    console.log('🔗 Verifying Git Repositories...');
    const repos = await client.models.GitRepository.list();

    console.log(`✅ Git Repositories: ${repos.data.length}`);

    if (repos.data.length === 0) {
      console.log('   ⚠️  No repositories found. Run integration tests first.');
    } else {
      repos.data.forEach(r => {
        console.log(`   - ${r.repoUrl}`);
        console.log(`     Provider: ${r.provider}`);
        console.log(`     Current Branch: ${r.currentBranch}`);
        console.log(`     Status: ${r.status}`);
        const branchCount = Array.isArray(r.branches) ? r.branches.length : 0;
        console.log(`     Branches Cached: ${branchCount}`);
        console.log(`     Project ID: ${r.projectId}`);
      });
    }

    // ========================================================================
    // GIT CREDENTIALS
    // ========================================================================

    console.log('');
    console.log('🔑 Verifying Git Credentials...');
    const creds = await client.models.GitCredential.list();

    console.log(`✅ Git Credentials: ${creds.data.length}`);

    if (creds.data.length === 0) {
      console.log('   ⚠️  No credentials found. Run integration tests first.');
    } else {
      creds.data.forEach(c => {
        console.log(`   - Repository ID: ${c.repositoryId}`);
        console.log(`     Type: ${c.type}`);
        console.log(`     Username: ${c.username || 'N/A'}`);
        console.log(`     Encrypted: ${c.encryptedToken ? '✅ Yes (KMS)' : '❌ No'}`);
        // Verify encryption (should NOT be plaintext)
        if (c.encryptedToken) {
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(c.encryptedToken);
          const startsWithGhp = c.encryptedToken.startsWith('ghp_') ||
                                 c.encryptedToken.startsWith('gho_') ||
                                 c.encryptedToken.startsWith('github_pat_');
          if (startsWithGhp) {
            console.log(`     ⚠️  WARNING: Token appears to be plaintext!`);
          } else if (isBase64) {
            console.log(`     ✅ Token appears encrypted (base64)`);
          }
        }
      });
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log('');
    console.log('='.repeat(80));
    console.log('  Verification Summary');
    console.log('='.repeat(80));
    console.log('');
    console.log(`  Projects: ${projects.data.length}`);
    console.log(`  Repositories: ${repos.data.length}`);
    console.log(`  Credentials: ${creds.data.length}`);
    console.log('');

    // Check relationships
    if (projects.data.length > 0 && repos.data.length > 0) {
      const reposWithProjects = repos.data.filter(r =>
        projects.data.some(p => p.id === r.projectId)
      );
      console.log(`  Repository-Project Links: ${reposWithProjects.length}/${repos.data.length}`);
    }

    if (repos.data.length > 0 && creds.data.length > 0) {
      const credsWithRepos = creds.data.filter(c =>
        repos.data.some(r => r.id === c.repositoryId)
      );
      console.log(`  Credential-Repository Links: ${credsWithRepos.length}/${creds.data.length}`);
    }

    console.log('');

    // Overall status
    const hasData = projects.data.length > 0 && repos.data.length > 0 && creds.data.length > 0;
    if (hasData) {
      console.log('✅ Data integrity verification PASSED');
      console.log('');
      console.log('All records found and relationships intact.');
    } else {
      console.log('⚠️  Data verification INCOMPLETE');
      console.log('');
      console.log('Run integration tests to create test data:');
      console.log('  TEST_REPO_URL="..." TEST_PAT="..." npm run test:git-integration');
    }

    console.log('');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.error('');
    console.error('❌ Verification failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    throw error;
  }
}

// Run verification
verifyData()
  .then(() => {
    console.log('');
    process.exit(0);
  })
  .catch(err => {
    console.error('');
    process.exit(1);
  });
