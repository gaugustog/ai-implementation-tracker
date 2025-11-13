import { MonorepoType } from '../detector';
import { analyzeTurborepo } from './turborepo';

/**
 * Result structure returned by all monorepo analyzers.
 * Used by handler to persist data to AppSync.
 */
export interface MonorepoAnalysisResult {
  structure: {
    type: string;                // Monorepo type ('turborepo', 'nx', etc.)
    workspaceCount: number;      // Total workspaces discovered
    rootConfig: any;             // Raw config (turbo.json, nx.json, etc.)
    dependencyGraph: any;        // Graph visualization (nodes + edges)
  };
  workspaces: Array<{
    name: string;                // Package name from package.json
    path: string;                // Relative path from repo root
    type: 'app' | 'package' | 'library' | 'feature' | 'single';
    framework?: string;          // 'nextjs', 'react', 'vue', etc.
    language?: string;           // 'typescript', 'javascript'
    packageJson: any;            // Full package.json content
    metadata: any;               // Additional workspace-specific data
  }>;
  dependencies: Array<{
    workspaceName: string;       // Source workspace name
    dependsOnWorkspaceName: string;  // Target workspace name
    type: 'internal' | 'external' | 'peer' | 'dev';
    version?: string;            // Version constraint (e.g., 'workspace:*')
  }>;
}

/**
 * Analyze a monorepo based on its type.
 * Dispatches to type-specific analyzer.
 *
 * @param repositoryId - Repository ID (for logging)
 * @param repoPath - Absolute path to cloned repository
 * @param type - Monorepo type from detector
 * @returns Analysis result with structure, workspaces, and dependencies
 *
 * @throws Error if monorepo type is unsupported or analysis fails
 */
export async function analyzeMonorepo(
  repositoryId: string,
  repoPath: string,
  type: MonorepoType
): Promise<MonorepoAnalysisResult> {
  console.log(`Analyzing ${type} monorepo at ${repoPath}`);

  switch (type) {
    case 'turborepo':
      return await analyzeTurborepo(repositoryId, repoPath);

    case 'nx':
      throw new Error('Nx analyzer not yet implemented (MVP-014-02)');

    case 'lerna':
      throw new Error('Lerna analyzer not yet implemented (MVP-015-02)');

    case 'yarn_workspaces':
      throw new Error('Yarn Workspaces analyzer not yet implemented (MVP-015-02)');

    case 'pnpm':
      throw new Error('PNPM analyzer not yet implemented (MVP-015-02)');

    default:
      throw new Error(`Unsupported monorepo type: ${type}`);
  }
}
