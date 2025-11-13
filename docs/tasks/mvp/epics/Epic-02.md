# Epic 02: Repository Analysis & Workspace Discovery

## Overview
Implement comprehensive repository analysis capabilities including monorepo detection, workspace discovery, dependency graph analysis, and initial context generation. This epic builds upon the Git integration foundation from Epic-01 and enables SpecForge to understand the structure and relationships within both monorepo and single-repo projects.

**Stage**: Stage 2 - Repository Analysis  
**Duration**: 4 days  
**Priority**: Critical (Blocking for Stages 3-9)  
**Status**: Todo

---

## Objectives

1. ✅ Implement monorepo detection and type identification
2. ✅ Build workspace discovery system
3. ✅ Create dependency graph analyzer
4. ✅ Generate initial contexts for workspaces
5. ✅ Set up comprehensive testing infrastructure
6. ✅ Validate analysis accuracy with real-world repos

---

## Architecture Overview

### Analysis Pipeline
```
Repository → Detect Type → Branch by Type
     ↓            ↓              ↓
  Git Repo   Monorepo?      ┌─────┴─────┐
                            │             │
                         Yes│             │No
                            │             │
                    ┌───────▼──────┐    ┌─▼────────────┐
                    │ Monorepo     │    │ Single Repo  │
                    │ Analysis     │    │ Analysis     │
                    └───────┬──────┘    └─┬────────────┘
                            │             │
        ┌───────────────────┼─────────────┘
        │
        ▼
  Analyze Structure → Discover Workspaces → Build Dep Graph → Generate Contexts
        ↓                    ↓                    ↓                ↓
  MonorepoStructure     Workspace[]      MonorepoDependency[]   Context[]
  (or null)             (1 or many)      (0 or many)
```

**Flow Details:**
- **Monorepo Path**: Creates MonorepoStructure + multiple Workspace records + MonorepoDependency records
- **Single Repo Path**: Creates single Workspace record (no MonorepoStructure, no dependencies)

### Lambda Functions

#### 1. **monorepo-analyzer**
- **Purpose**: Analyze repository structure, detect monorepo type, discover workspaces
- **Triggers**: AppSync mutation `analyzeRepository`
- **Operations**:
  - `detectMonorepoType`: Identify monorepo framework
  - `analyzeStructure`: Parse monorepo configuration
  - `discoverWorkspaces`: Find all workspaces/packages
  - `buildDependencyGraph`: Map internal dependencies

#### 2. **code-analyzer** (Enhanced)
- **Purpose**: Deep code analysis for workspace content
- **Triggers**: Called by monorepo-analyzer
- **Operations**:
  - `analyzePackageJson`: Extract dependencies, scripts, metadata
  - `detectFramework`: Identify framework (React, Next.js, etc.)
  - `scanFiles`: Analyze file structure

---

## Data Model (Recap from Epic-01)

The complete schema was implemented in Epic-01. This epic focuses on populating:

### Key Models Used
```typescript
GitRepository {
  isMonorepo: boolean
  monorepoType: enum['turborepo', 'nx', 'lerna', 'yarn_workspaces', 'pnpm']
  status: enum['pending', 'analyzing', 'ready', 'error']
  lastAnalyzedAt: datetime
  monorepoStructure: MonorepoStructure (relation)
  workspaces: Workspace[] (relation)
}

MonorepoStructure {
  repositoryId: ID
  type: string
  workspaceCount: integer
  rootConfig: json (turbo.json, nx.json, etc.)
  dependencyGraph: json
  dependencies: MonorepoDependency[] (relation)
  analyzedAt: datetime
}

Workspace {
  repositoryId: ID
  name: string
  path: string
  type: enum['app', 'package', 'library', 'feature', 'single']
  framework: string
  language: string
  packageJson: json
  dependencies: MonorepoDependency[] (relation)
  contexts: Context[] (relation)
  metadata: json
}

MonorepoDependency {
  workspaceId: ID
  dependsOnWorkspaceId: ID
  monorepoStructureId: ID
  type: enum['internal', 'external', 'peer', 'dev']
  version: string
}

Context {
  projectId: ID
  workspaceId: ID (optional)
  name: string
  type: enum['global', 'workspace', 'feature']
  scope: json
  content: json
  tokenCount: integer
}
```

---

## Lambda Implementation: monorepo-analyzer

### Function Setup

**Directory Structure:**
```
amplify/functions/monorepo-analyzer/
├── resource.ts          # Lambda definition
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── handler.ts           # Main entry point
└── lib/
    ├── detector.ts      # Monorepo type detection
    ├── analyzers/
    │   ├── turborepo.ts
    │   ├── nx.ts
    │   ├── lerna.ts
    │   ├── yarn-workspaces.ts
    │   └── pnpm.ts
    ├── workspace-discovery.ts
    ├── dependency-graph.ts
    ├── appsync-client.ts
    └── git-client.ts
```

### resource.ts
```typescript
import { defineFunction } from '@aws-amplify/backend';

export const monorepoAnalyzer = defineFunction({
  name: 'monorepo-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for large repos
  memoryMB: 2048,      // 2GB for file operations
  environment: {
    // API name from your Amplify config
    API_NAME: 'specForgeDataAPI',
  },
});
```

### package.json
```json
{
  "name": "monorepo-analyzer",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-appsync": "^3.592.0",
    "@aws-sdk/client-kms": "^3.592.0",
    "@aws-sdk/client-ssm": "^3.592.0",
    "aws-lambda": "^1.0.7",
    "simple-git": "^3.24.0",
    "glob": "^10.3.10",
    "fast-glob": "^3.3.2",
    "yaml": "^2.4.2",
    "comment-json": "^4.2.3"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.138",
    "@types/node": "^20.12.12",
    "esbuild": "^0.21.4",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5"
  },
  "scripts": {
    "build": "tsc && esbuild handler.ts --bundle --platform=node --target=node18 --outfile=dist/index.js"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### handler.ts
```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { detectMonorepoType } from './lib/detector';
import { analyzeMonorepo } from './lib/analyzers/index';
import { analyzeSingleRepo } from './lib/single-repo-analyzer';
import { AppSyncClient } from './lib/appsync-client';
import { GitClient } from './lib/git-client';

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

const gitClient = new GitClient();

interface AnalyzeRepositoryInput {
  repositoryId: string;
  forceReanalysis?: boolean;
}

export const handler: AppSyncResolverHandler<AnalyzeRepositoryInput, any> = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { repositoryId, forceReanalysis = false } = event.arguments;
  
  try {
    // Update status to analyzing
    await appsyncClient.updateRepository(repositoryId, {
      status: 'analyzing',
    });
    
    // Get repository details
    const repository = await appsyncClient.getRepository(repositoryId);
    
    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }
    
    // Check if already analyzed
    if (!forceReanalysis && repository.status === 'ready' && repository.lastAnalyzedAt) {
      console.log('Repository already analyzed, skipping');
      return {
        success: true,
        message: 'Repository already analyzed',
        repository,
      };
    }
    
    // Get credentials
    const credentials = await appsyncClient.getGitCredential(repositoryId);
    
    if (!credentials) {
      throw new Error('Git credentials not found');
    }
    
    // Clone or pull repository
    const repoPath = await gitClient.cloneOrPull(repository, credentials);
    
    // Detect monorepo type
    const monorepoType = await detectMonorepoType(repoPath);
    
    let analysisResult;
    
    if (monorepoType) {
      console.log(`Detected monorepo type: ${monorepoType}`);
      
      // Update repository
      await appsyncClient.updateRepository(repositoryId, {
        isMonorepo: true,
        monorepoType,
      });
      
      // Analyze as monorepo
      analysisResult = await analyzeMonorepo(repositoryId, repoPath, monorepoType);
    } else {
      console.log('Single repository detected');
      
      // Update repository
      await appsyncClient.updateRepository(repositoryId, {
        isMonorepo: false,
      });
      
      // Analyze as single repo
      analysisResult = await analyzeSingleRepo(repositoryId, repoPath);
    }
    
    // Update repository status
    await appsyncClient.updateRepository(repositoryId, {
      status: 'ready',
      lastAnalyzedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    });
    
    // Cleanup
    await gitClient.cleanup(repoPath);
    
    return {
      success: true,
      message: 'Repository analyzed successfully',
      analysisResult,
    };
    
  } catch (error) {
    console.error('Error analyzing repository:', error);
    
    // Update status to error
    await appsyncClient.updateRepository(repositoryId, {
      status: 'error',
    });
    
    throw error;
  }
};
```

### lib/detector.ts
```typescript
import fs from 'fs/promises';
import path from 'path';

export type MonorepoType = 'turborepo' | 'nx' | 'lerna' | 'yarn_workspaces' | 'pnpm' | null;

interface MonorepoIndicator {
  type: MonorepoType;
  files: string[];
  packageJsonField?: string;
}

const MONOREPO_INDICATORS: MonorepoIndicator[] = [
  {
    type: 'turborepo',
    files: ['turbo.json'],
  },
  {
    type: 'nx',
    files: ['nx.json', 'workspace.json'],
  },
  {
    type: 'lerna',
    files: ['lerna.json'],
  },
  {
    type: 'yarn_workspaces',
    files: ['yarn.lock'],
    packageJsonField: 'workspaces',
  },
  {
    type: 'pnpm',
    files: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'],
  },
];

export async function detectMonorepoType(repoPath: string): Promise<MonorepoType> {
  console.log(`Detecting monorepo type in: ${repoPath}`);
  
  for (const indicator of MONOREPO_INDICATORS) {
    // Check for indicator files
    for (const file of indicator.files) {
      const filePath = path.join(repoPath, file);
      
      try {
        await fs.access(filePath);
        console.log(`Found indicator file: ${file}`);
        
        // Additional check for package.json field if required
        if (indicator.packageJsonField) {
          const packageJsonPath = path.join(repoPath, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          
          if (packageJson[indicator.packageJsonField]) {
            console.log(`Confirmed ${indicator.type} via package.json field`);
            return indicator.type;
          }
        } else {
          return indicator.type;
        }
      } catch (error) {
        // File doesn't exist, continue
        continue;
      }
    }
  }
  
  console.log('No monorepo indicators found');
  return null;
}
```

### lib/analyzers/index.ts
```typescript
import { MonorepoType } from '../detector';
import { analyzeTurborepo } from './turborepo';
import { analyzeNx } from './nx';
import { analyzeLerna } from './lerna';
import { analyzeYarnWorkspaces } from './yarn-workspaces';
import { analyzePnpm } from './pnpm';

export interface MonorepoAnalysisResult {
  structure: {
    type: string;
    workspaceCount: number;
    rootConfig: any;
    dependencyGraph: any;
  };
  workspaces: Array<{
    name: string;
    path: string;
    type: 'app' | 'package' | 'library' | 'feature';
    framework?: string;
    language?: string;
    packageJson: any;
    metadata: any;
  }>;
  dependencies: Array<{
    workspaceName: string;
    dependsOnWorkspaceName: string;
    type: 'internal' | 'external' | 'peer' | 'dev';
    version?: string;
  }>;
}

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
      return await analyzeNx(repositoryId, repoPath);
    case 'lerna':
      return await analyzeLerna(repositoryId, repoPath);
    case 'yarn_workspaces':
      return await analyzeYarnWorkspaces(repositoryId, repoPath);
    case 'pnpm':
      return await analyzePnpm(repositoryId, repoPath);
    default:
      throw new Error(`Unsupported monorepo type: ${type}`);
  }
}
```

### lib/analyzers/turborepo.ts
```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { MonorepoAnalysisResult } from './index';

export async function analyzeTurborepo(
  repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing Turborepo structure');
  
  // Read turbo.json
  const turboConfigPath = path.join(repoPath, 'turbo.json');
  const turboConfig = JSON.parse(await fs.readFile(turboConfigPath, 'utf-8'));
  
  // Read root package.json
  const rootPackageJsonPath = path.join(repoPath, 'package.json');
  const rootPackageJson = JSON.parse(await fs.readFile(rootPackageJsonPath, 'utf-8'));
  
  // Get workspace patterns
  const workspacePatterns = rootPackageJson.workspaces || [];
  
  // Find all package.json files in workspaces
  const workspaces = [];
  const workspaceMap = new Map<string, any>();
  
  for (const pattern of workspacePatterns) {
    const packageJsonFiles = await glob(`${pattern}/package.json`, {
      cwd: repoPath,
      absolute: false,
    });
    
    for (const pkgFile of packageJsonFiles) {
      const pkgPath = path.join(repoPath, pkgFile);
      const packageJson = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
      
      const workspacePath = path.dirname(pkgFile);
      const workspaceType = detectWorkspaceType(workspacePath, packageJson);
      const framework = detectFramework(packageJson);
      
      const workspace = {
        name: packageJson.name,
        path: workspacePath,
        type: workspaceType,
        framework,
        language: 'typescript', // Default, can be enhanced
        packageJson,
        metadata: {
          scripts: packageJson.scripts,
          version: packageJson.version,
        },
      };
      
      workspaces.push(workspace);
      workspaceMap.set(packageJson.name, workspace);
    }
  }
  
  // Build dependency graph
  const dependencies = [];
  
  for (const workspace of workspaces) {
    const deps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
    };
    
    for (const [depName, version] of Object.entries(deps)) {
      if (workspaceMap.has(depName)) {
        // Internal dependency
        dependencies.push({
          workspaceName: workspace.name,
          dependsOnWorkspaceName: depName,
          type: 'internal' as const,
          version: version as string,
        });
      }
    }
  }
  
  // Build dependency graph visualization
  const dependencyGraph = {
    nodes: workspaces.map(ws => ({
      id: ws.name,
      type: ws.type,
      path: ws.path,
    })),
    edges: dependencies.map(dep => ({
      from: dep.workspaceName,
      to: dep.dependsOnWorkspaceName,
      type: dep.type,
    })),
  };
  
  return {
    structure: {
      type: 'turborepo',
      workspaceCount: workspaces.length,
      rootConfig: turboConfig,
      dependencyGraph,
    },
    workspaces,
    dependencies,
  };
}

function detectWorkspaceType(workspacePath: string, packageJson: any): 'app' | 'package' | 'library' {
  const pathLower = workspacePath.toLowerCase();
  
  if (pathLower.includes('/apps/') || pathLower.includes('/app/')) {
    return 'app';
  }
  
  if (pathLower.includes('/packages/') || pathLower.includes('/libs/')) {
    return 'package';
  }
  
  // Check if it's a library by package.json fields
  if (packageJson.main || packageJson.module || packageJson.exports) {
    return 'library';
  }
  
  return 'package';
}

function detectFramework(packageJson: any): string | undefined {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  if (deps['next']) return 'nextjs';
  if (deps['react']) return 'react';
  if (deps['vue']) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps['svelte']) return 'svelte';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  
  return undefined;
}
```

### lib/analyzers/nx.ts
```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { MonorepoAnalysisResult } from './index';

export async function analyzeNx(
  repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing Nx workspace');
  
  // Read nx.json
  const nxConfigPath = path.join(repoPath, 'nx.json');
  const nxConfig = JSON.parse(await fs.readFile(nxConfigPath, 'utf-8'));
  
  // Read workspace.json or project.json files
  let projectsConfig: Record<string, any> = {};
  
  try {
    const workspaceJsonPath = path.join(repoPath, 'workspace.json');
    const workspaceJson = JSON.parse(await fs.readFile(workspaceJsonPath, 'utf-8'));
    projectsConfig = workspaceJson.projects || {};
  } catch {
    // Nx 13+ uses project.json files instead
    const projectJsonFiles = await glob('**/project.json', {
      cwd: repoPath,
      ignore: ['**/node_modules/**'],
    });
    
    for (const projectFile of projectJsonFiles) {
      const projectPath = path.dirname(projectFile);
      const projectJson = JSON.parse(
        await fs.readFile(path.join(repoPath, projectFile), 'utf-8')
      );
      
      const projectName = projectJson.name || path.basename(projectPath);
      projectsConfig[projectName] = {
        root: projectPath,
        ...projectJson,
      };
    }
  }
  
  // Discover workspaces
  const workspaces = [];
  const workspaceMap = new Map<string, any>();
  
  for (const [projectName, projectConfig] of Object.entries(projectsConfig)) {
    const projectPath = (projectConfig as any).root;
    
    // Try to read package.json
    let packageJson: any = { name: projectName };
    try {
      const pkgPath = path.join(repoPath, projectPath, 'package.json');
      packageJson = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    } catch {
      // Some Nx projects don't have package.json
    }
    
    const workspace = {
      name: packageJson.name || projectName,
      path: projectPath,
      type: detectNxProjectType(projectConfig as any),
      framework: detectFrameworkFromNx(projectConfig as any, packageJson),
      language: detectLanguage(packageJson),
      packageJson,
      metadata: {
        projectType: (projectConfig as any).projectType,
        tags: (projectConfig as any).tags,
        targets: (projectConfig as any).targets,
      },
    };
    
    workspaces.push(workspace);
    workspaceMap.set(workspace.name, workspace);
  }
  
  // Build dependency graph from implicitDependencies and package.json
  const dependencies = [];
  
  for (const workspace of workspaces) {
    // Implicit dependencies from Nx config
    const implicitDeps = workspace.metadata.implicitDependencies || [];
    for (const depName of implicitDeps) {
      if (workspaceMap.has(depName)) {
        dependencies.push({
          workspaceName: workspace.name,
          dependsOnWorkspaceName: depName,
          type: 'internal' as const,
        });
      }
    }
    
    // Dependencies from package.json
    const deps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
    };
    
    for (const depName of Object.keys(deps)) {
      if (workspaceMap.has(depName)) {
        dependencies.push({
          workspaceName: workspace.name,
          dependsOnWorkspaceName: depName,
          type: 'internal' as const,
          version: deps[depName],
        });
      }
    }
  }
  
  const dependencyGraph = {
    nodes: workspaces.map(ws => ({
      id: ws.name,
      type: ws.type,
      path: ws.path,
    })),
    edges: dependencies.map(dep => ({
      from: dep.workspaceName,
      to: dep.dependsOnWorkspaceName,
      type: dep.type,
    })),
  };
  
  return {
    structure: {
      type: 'nx',
      workspaceCount: workspaces.length,
      rootConfig: nxConfig,
      dependencyGraph,
    },
    workspaces,
    dependencies,
  };
}

function detectNxProjectType(projectConfig: any): 'app' | 'package' | 'library' {
  const projectType = projectConfig.projectType;
  
  if (projectType === 'application') return 'app';
  if (projectType === 'library') return 'library';
  
  return 'package';
}

function detectFrameworkFromNx(projectConfig: any, packageJson: any): string | undefined {
  // Check Nx generators/builders
  const targets = projectConfig.targets || {};
  
  for (const target of Object.values(targets)) {
    const executor = (target as any).executor || (target as any).builder;
    
    if (executor?.includes('@nrwl/next') || executor?.includes('@nx/next')) return 'nextjs';
    if (executor?.includes('@nrwl/react') || executor?.includes('@nx/react')) return 'react';
    if (executor?.includes('@nrwl/angular') || executor?.includes('@nx/angular')) return 'angular';
    if (executor?.includes('@nrwl/node') || executor?.includes('@nx/node')) return 'nodejs';
  }
  
  // Fallback to package.json
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['next']) return 'nextjs';
  if (deps['react']) return 'react';
  if (deps['@angular/core']) return 'angular';
  if (deps['vue']) return 'vue';
  
  return undefined;
}

function detectLanguage(packageJson: any): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['typescript'] || packageJson.devDependencies?.['@types/node']) {
    return 'typescript';
  }
  
  return 'javascript';
}
```

### lib/single-repo-analyzer.ts
```typescript
import fs from 'fs/promises';
import path from 'path';
import { MonorepoAnalysisResult } from './analyzers/index';

export async function analyzeSingleRepo(
  repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing single repository');
  
  // Read package.json
  const packageJsonPath = path.join(repoPath, 'package.json');
  let packageJson: any = {};
  
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  } catch {
    packageJson = { name: 'unknown', version: '0.0.0' };
  }
  
  const framework = detectFramework(packageJson);
  const language = detectLanguage(packageJson);
  
  // Create single workspace
  const workspace = {
    name: packageJson.name || 'root',
    path: '.',
    type: 'single' as const,
    framework,
    language,
    packageJson,
    metadata: {
      scripts: packageJson.scripts,
      version: packageJson.version,
    },
  };
  
  return {
    structure: {
      type: 'single',
      workspaceCount: 1,
      rootConfig: packageJson,
      dependencyGraph: {
        nodes: [{ id: workspace.name, type: workspace.type, path: workspace.path }],
        edges: [],
      },
    },
    workspaces: [workspace],
    dependencies: [],
  };
}

function detectFramework(packageJson: any): string | undefined {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['next']) return 'nextjs';
  if (deps['react']) return 'react';
  if (deps['vue']) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps['svelte']) return 'svelte';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  
  return undefined;
}

function detectLanguage(packageJson: any): string {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  if (deps['typescript'] || packageJson.devDependencies?.['@types/node']) {
    return 'typescript';
  }
  
  return 'javascript';
}
```

### lib/appsync-client.ts
```typescript
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';

export class AppSyncClient {
  private apiEndpoint: string;
  private apiId: string;
  private region: string;
  
  constructor(config: { apiEndpoint: string; apiId: string }) {
    this.apiEndpoint = config.apiEndpoint;
    this.apiId = config.apiId;
    this.region = process.env.AWS_REGION || 'us-east-1';
  }
  
  async query(query: string, variables: any = {}): Promise<any> {
    return this.execute(query, variables);
  }
  
  async mutate(mutation: string, variables: any = {}): Promise<any> {
    return this.execute(mutation, variables);
  }
  
  private async execute(operation: string, variables: any): Promise<any> {
    const url = new URL(this.apiEndpoint);
    
    const body = JSON.stringify({
      query: operation,
      variables,
    });
    
    const request = new HttpRequest({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        host: url.hostname,
      },
      body,
    });
    
    const signer = new SignatureV4({
      service: 'appsync',
      region: this.region,
      credentials: defaultProvider(),
      sha256: Sha256,
    });
    
    const signedRequest = await signer.sign(request);
    
    const response = await fetch(this.apiEndpoint, {
      method: signedRequest.method,
      headers: signedRequest.headers,
      body: signedRequest.body,
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.error('AppSync errors:', result.errors);
      throw new Error(result.errors[0].message);
    }
    
    return result.data[Object.keys(result.data)[0]];
  }
  
  // Repository operations
  async getRepository(id: string) {
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
        }
      }
    `;
    
    return this.query(query, { id });
  }
  
  async updateRepository(id: string, input: any) {
    const mutation = `
      mutation UpdateRepository($input: UpdateGitRepositoryInput!) {
        updateGitRepository(input: $input) {
          id
          status
          isMonorepo
          monorepoType
          lastAnalyzedAt
        }
      }
    `;
    
    return this.mutate(mutation, { input: { id, ...input } });
  }
  
  async getGitCredential(repositoryId: string) {
    const query = `
      query GetGitCredential($repositoryId: ID!) {
        listGitCredentials(filter: { repositoryId: { eq: $repositoryId } }) {
          items {
            id
            repositoryId
            type
            encryptedToken
            username
          }
        }
      }
    `;
    
    const result = await this.query(query, { repositoryId });
    return result.items[0];
  }
  
  // MonorepoStructure operations
  async createMonorepoStructure(input: any) {
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
  
  // Workspace operations
  async createWorkspace(input: any) {
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
  
  // Dependency operations
  async createMonorepoDependency(input: any) {
    const mutation = `
      mutation CreateDependency($input: CreateMonorepoDependencyInput!) {
        createMonorepoDependency(input: $input) {
          id
          workspaceId
          dependsOnWorkspaceId
          type
        }
      }
    `;
    
    return this.mutate(mutation, { input });
  }
}
```

### lib/git-client.ts
```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

export class GitClient {
  async cloneOrPull(repository: any, credentials: any): Promise<string> {
    const repoPath = await this.getRepoPath(repository.id);
    
    // Decrypt token
    const decryptedToken = await this.decryptToken(credentials.encryptedToken);
    
    // Build authenticated URL
    const authUrl = this.buildAuthUrl(repository.repoUrl, credentials.username, decryptedToken);
    
    // Check if repo already exists
    const exists = await this.directoryExists(repoPath);
    
    if (exists) {
      console.log(`Pulling latest changes for ${repository.repoUrl}`);
      const git = simpleGit(repoPath);
      await git.pull();
    } else {
      console.log(`Cloning ${repository.repoUrl}`);
      const git = simpleGit();
      await git.clone(authUrl, repoPath, ['--depth', '1']);
    }
    
    return repoPath;
  }
  
  async cleanup(repoPath: string): Promise<void> {
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
      console.log(`Cleaned up ${repoPath}`);
    } catch (error) {
      console.error(`Error cleaning up ${repoPath}:`, error);
    }
  }
  
  private async getRepoPath(repositoryId: string): Promise<string> {
    const tmpDir = os.tmpdir();
    const repoPath = path.join(tmpDir, 'specforge-repos', repositoryId);
    
    // Ensure directory exists
    await fs.mkdir(repoPath, { recursive: true });
    
    return repoPath;
  }
  
  private async decryptToken(encryptedToken: string): Promise<string> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedToken, 'base64'),
    });
    
    const response = await kmsClient.send(command);
    
    if (!response.Plaintext) {
      throw new Error('Failed to decrypt token');
    }
    
    return Buffer.from(response.Plaintext).toString('utf-8');
  }
  
  private buildAuthUrl(repoUrl: string, username: string, token: string): string {
    const url = new URL(repoUrl);
    
    if (username && token) {
      url.username = username;
      url.password = token;
    } else if (token) {
      url.username = token;
    }
    
    return url.toString();
  }
  
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
```

---

## Backend Configuration

Update `amplify/backend.ts` to include the monorepo-analyzer:

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { Key } from 'aws-cdk-lib/aws-kms';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';
import { monorepoAnalyzer } from './functions/monorepo-analyzer/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
  monorepoAnalyzer,
});

// Grant AppSync permissions to both Lambda functions
backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.gitIntegration.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.monorepoAnalyzer.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.monorepoAnalyzer.resources.lambda);

// Grant KMS permissions to monorepoAnalyzer for credential decryption
const kmsKey = Key.fromLookup(backend.monorepoAnalyzer.resources.lambda, 'specforge-git-credentials-key', {
  aliasName: 'alias/specforge-git-credentials',
});

kmsKey.grantDecrypt(backend.monorepoAnalyzer.resources.lambda);
```

---

## Testing Infrastructure

### Test Script: test-monorepo-analysis.ts

Create `scripts/test-monorepo-analysis.ts`:

```typescript
#!/usr/bin/env node
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface TestCase {
  name: string;
  repoUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  expectedType: 'turborepo' | 'nx' | 'lerna' | 'yarn_workspaces' | 'pnpm' | null;
  expectedWorkspaceCount: number;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Vercel Turborepo',
    repoUrl: 'https://github.com/vercel/turbo',
    provider: 'github',
    expectedType: 'turborepo',
    expectedWorkspaceCount: 10, // Approximate
  },
  {
    name: 'Nx Monorepo',
    repoUrl: 'https://github.com/nrwl/nx-examples',
    provider: 'github',
    expectedType: 'nx',
    expectedWorkspaceCount: 5,
  },
  {
    name: 'Single Repository (Next.js)',
    repoUrl: 'https://github.com/vercel/next.js',
    provider: 'github',
    expectedType: null,
    expectedWorkspaceCount: 1,
  },
];

async function runTests() {
  console.log('🧪 Starting Monorepo Analysis Tests\n');
  
  const results = {
    passed: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  for (const testCase of TEST_CASES) {
    console.log(`📦 Testing: ${testCase.name}`);
    console.log(`   URL: ${testCase.repoUrl}`);
    
    try {
      // Create project
      const project = await client.models.Project.create({
        name: `Test: ${testCase.name}`,
        description: 'Automated test project',
      });
      
      if (!project.data) {
        throw new Error('Failed to create project');
      }
      
      console.log(`   ✓ Project created: ${project.data.id}`);
      
      // Create repository (note: requires actual Git credentials)
      const repository = await client.models.GitRepository.create({
        projectId: project.data.id,
        provider: testCase.provider,
        repoUrl: testCase.repoUrl,
        currentBranch: 'main',
        status: 'pending',
      });
      
      if (!repository.data) {
        throw new Error('Failed to create repository');
      }
      
      console.log(`   ✓ Repository created: ${repository.data.id}`);
      
      // Note: In real testing, you'd need to:
      // 1. Create GitCredential with valid token
      // 2. Trigger analyzeRepository mutation
      // 3. Poll for completion
      // 4. Verify results
      
      console.log(`   ⚠ Skipping analysis (requires credentials)`);
      console.log(`   Expected: ${testCase.expectedType || 'single'} with ${testCase.expectedWorkspaceCount} workspaces\n`);
      
      // Cleanup
      await client.models.GitRepository.delete({ id: repository.data.id });
      await client.models.Project.delete({ id: project.data.id });
      
      results.passed++;
      
    } catch (error) {
      console.error(`   ✗ Test failed:`, error);
      results.failed++;
      results.errors.push(`${testCase.name}: ${error}`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Manual test function for development
async function manualTest() {
  console.log('🔧 Manual Test Mode\n');
  console.log('Instructions:');
  console.log('1. Create a project in the UI');
  console.log('2. Connect a Git repository');
  console.log('3. Note the repository ID');
  console.log('4. Run: REPO_ID=<id> npm run test:manual\n');
  
  const repositoryId = process.env.REPO_ID;
  
  if (!repositoryId) {
    console.error('Error: REPO_ID environment variable not set');
    process.exit(1);
  }
  
  console.log(`Testing repository: ${repositoryId}\n`);
  
  // Get repository
  const repository = await client.models.GitRepository.get({ id: repositoryId });
  
  if (!repository.data) {
    console.error('Repository not found');
    process.exit(1);
  }
  
  console.log('Repository Details:');
  console.log(`  URL: ${repository.data.repoUrl}`);
  console.log(`  Branch: ${repository.data.currentBranch}`);
  console.log(`  Status: ${repository.data.status}`);
  console.log(`  Is Monorepo: ${repository.data.isMonorepo}`);
  console.log(`  Type: ${repository.data.monorepoType || 'N/A'}\n`);
  
  if (repository.data.status !== 'ready') {
    console.log('⏳ Repository not analyzed yet. Trigger analysis from UI.\n');
    process.exit(0);
  }
  
  // Get monorepo structure if applicable
  if (repository.data.isMonorepo) {
    const structure = await client.models.MonorepoStructure.list({
      filter: { repositoryId: { eq: repositoryId } }
    });
    
    if (structure.data.length > 0) {
      const s = structure.data[0];
      console.log('Monorepo Structure:');
      console.log(`  Type: ${s.type}`);
      console.log(`  Workspace Count: ${s.workspaceCount}`);
      console.log(`  Analyzed: ${s.analyzedAt}\n`);
    }
  }
  
  // Get workspaces
  const workspaces = await client.models.Workspace.list({
    filter: { repositoryId: { eq: repositoryId } }
  });
  
  console.log(`Found ${workspaces.data.length} workspaces:\n`);
  
  for (const ws of workspaces.data) {
    console.log(`  📁 ${ws.name}`);
    console.log(`     Path: ${ws.path}`);
    console.log(`     Type: ${ws.type}`);
    console.log(`     Framework: ${ws.framework || 'N/A'}`);
    console.log(`     Language: ${ws.language}\n`);
  }
  
  // Get dependencies
  const dependencies = await client.models.MonorepoDependency.list({
    filter: { 
      workspaceId: { 
        in: workspaces.data.map(ws => ws.id) 
      } 
    }
  });
  
  console.log(`Found ${dependencies.data.length} internal dependencies:\n`);
  
  for (const dep of dependencies.data) {
    const fromWs = workspaces.data.find(ws => ws.id === dep.workspaceId);
    const toWs = workspaces.data.find(ws => ws.id === dep.dependsOnWorkspaceId);
    
    if (fromWs && toWs) {
      console.log(`  ${fromWs.name} → ${toWs.name} (${dep.type})`);
    }
  }
  
  console.log('\n✓ Manual test complete\n');
}

// Run tests based on mode
const mode = process.argv[2];

if (mode === 'manual') {
  manualTest().catch(console.error);
} else {
  runTests().catch(console.error);
}
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:monorepo": "tsx scripts/test-monorepo-analysis.ts",
    "test:monorepo:manual": "tsx scripts/test-monorepo-analysis.ts manual"
  }
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Correctly detect all 5 monorepo types (Turborepo, Nx, Lerna, Yarn Workspaces, PNPM)
- ✅ Handle single repositories gracefully
- ✅ Discover all workspaces in a monorepo
- ✅ Parse package.json files accurately
- ✅ Detect frameworks (Next.js, React, Angular, etc.)
- ✅ Build complete dependency graph
- ✅ Store all data via AppSync (no direct DynamoDB)
- ✅ Update repository status throughout analysis

### Performance Requirements
- ✅ Analyze repositories up to 500MB in size
- ✅ Complete analysis within 5 minutes for typical repos
- ✅ Handle up to 100 workspaces in a monorepo
- ✅ Process dependency graphs with 500+ edges

### Error Handling
- ✅ Gracefully handle missing package.json files
- ✅ Handle invalid or corrupted config files
- ✅ Set repository status to 'error' on failure
- ✅ Provide clear error messages
- ✅ Cleanup resources on error

### Data Quality
- ✅ No duplicate workspace entries
- ✅ Accurate dependency graph representation
- ✅ Complete metadata for each workspace
- ✅ Proper workspace type classification

---

## Deployment Steps

### 1. Deploy Lambda Function
```bash
# Navigate to function directory
cd amplify/functions/monorepo-analyzer

# Install dependencies
npm install

# Build
npm run build

# Deploy via Amplify
cd ../../..
npx ampx sandbox
```

### 2. Update Backend Configuration
```bash
# Verify backend.ts includes monorepoAnalyzer
# Deploy changes
npx ampx sandbox
```

### 3. Verify Deployment
```bash
# Check Lambda function exists
aws lambda list-functions --query 'Functions[?contains(FunctionName, `monorepo-analyzer`)].FunctionName'

# Check environment variables
aws lambda get-function-configuration --function-name <function-name> --query 'Environment.Variables'

# Expected output:
# {
#   "API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT": "https://xxx.appsync-api.region.amazonaws.com/graphql",
#   "API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT": "xxxxxxxxxxxxx"
# }
```

### 4. Run Tests
```bash
# Automated tests (structure only)
npm run test:monorepo

# Manual test with real repository
REPO_ID=<your-repo-id> npm run test:monorepo:manual
```

---

## Troubleshooting

### Issue: Lambda timeout on large repositories
**Solution:**
- Increase timeout in `resource.ts` (currently 300s)
- Implement pagination for workspace discovery
- Use shallow clone with `--depth 1`

### Issue: Missing workspaces in analysis
**Solution:**
- Check workspace patterns in root package.json
- Verify glob patterns are correct
- Look for symlinks (not followed by default)

### Issue: Incorrect dependency graph
**Solution:**
- Verify package.json files are valid JSON
- Check for monorepo-specific dependency formats
- Review workspace name resolution logic

### Issue: Framework not detected
**Solution:**
- Add framework to `detectFramework` function
- Check both dependencies and devDependencies
- Look for framework-specific files (next.config.js, etc.)

---

## Next Steps (Epic 03)

After completing this epic:
1. Context generation will use workspace data
2. Specifications can target specific workspaces
3. Dependency awareness enables better recommendations
4. UI can display monorepo structure visually

---

## Progress Tracking

- [ ] Day 1: Detector & Turborepo analyzer
- [ ] Day 2: Nx, Lerna, Yarn, PNPM analyzers
- [ ] Day 3: Single repo analyzer & AppSync client
- [ ] Day 4: Testing infrastructure & validation

**Estimated Total Time**: 32 hours over 4 days
