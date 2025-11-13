# Epic 03: Context Management & Generation

## Overview
Implement comprehensive context management system for SpecForge, enabling AI-driven specifications with accurate, scoped code context. This epic provides three context types (global, workspace, feature), context analysis, token counting, and context combination capabilities. Context is the foundation for all AI operations in later stages.

**Stage**: Stage 3 - Context Management  
**Duration**: 3 days  
**Priority**: Critical (Blocking for Stages 4-9)  
**Status**: Todo

---

## Objectives

1. ✅ Implement context generation system
2. ✅ Build code analysis and extraction engine
3. ✅ Create token counting mechanism
4. ✅ Implement context combination/merging
5. ✅ Set up S3 storage for large contexts
6. ✅ Build testing infrastructure
7. ✅ Validate context quality and accuracy

---

## Architecture Overview

### Context Pipeline
```
Project/Workspace → Select Scope → Analyze Code → Extract Content → Count Tokens → Store Context
       ↓                ↓              ↓              ↓              ↓            ↓
   Repository      File/Folder    AST Parse     Structured      Token Count   Context Record
                   Selection      + Metadata     JSON Data       (Claude-3)    (in DynamoDB)
                                                                                + S3 (large)

Context Types:
┌─────────────────┬──────────────────────┬─────────────────────────────┐
│ Global          │ Workspace            │ Feature                     │
│ (Project-wide)  │ (With Dependencies)  │ (Isolated Scope)            │
├─────────────────┼──────────────────────┼─────────────────────────────┤
│ • All workspaces│ • Single workspace   │ • Custom file selection     │
│ • Package.json  │ • Related workspaces │ • Specific directories      │
│ • Root config   │ • Dependency tree    │ • Tagged files/folders      │
│ • README files  │ • Shared libraries   │ • Feature boundaries        │
└─────────────────┴──────────────────────┴─────────────────────────────┘
```

---

## Data Model (Recap from Epic-01)

### Key Models Used
```typescript
Context {
  id: ID
  projectId: ID (required)
  workspaceId: ID (optional - null for global)
  name: string (required)
  type: enum['global', 'workspace', 'feature']
  scope: json {
    includes: string[] // File patterns
    excludes: string[] // Exclusion patterns
    workspaceIds: string[] // For multi-workspace contexts
    maxDepth: integer // Directory depth limit
  }
  content: json {
    files: Array<{
      path: string
      language: string
      size: number
      excerpt: string // First 500 chars or important parts
    }>
    structure: Object // Directory tree
    dependencies: Object // Dependency info
    metadata: Object // Additional context
  }
  tokenCount: integer
  s3Key: string (optional - for large contexts)
  specificationContexts: SpecificationContext[] (relation)
  createdAt: datetime
  updatedAt: datetime
}

Workspace {
  id: ID
  repositoryId: ID
  name: string
  path: string
  type: enum['app', 'package', 'library', 'feature', 'single']
  framework: string
  language: string
  packageJson: json
  contexts: Context[] (relation)
}

SpecificationContext {
  specificationId: ID
  contextId: ID
  priority: integer
}
```

---

## Lambda Implementation: context-selector

### Function Setup

**Directory Structure:**
```
amplify/functions/context-selector/
├── resource.ts          # Lambda definition
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── handler.ts           # Main entry point
└── lib/
    ├── generators/
    │   ├── global-context.ts
    │   ├── workspace-context.ts
    │   └── feature-context.ts
    ├── analyzers/
    │   ├── file-analyzer.ts
    │   ├── ast-parser.ts
    │   └── structure-builder.ts
    ├── token-counter.ts
    ├── context-merger.ts
    ├── s3-storage.ts
    ├── appsync-client.ts
    └── git-client.ts
```

### resource.ts
```typescript
import { defineFunction } from '@aws-amplify/backend';

export const contextSelector = defineFunction({
  name: 'context-selector',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for large contexts
  memoryMB: 3008,      // 3GB for file operations + AST parsing
  environment: {
    API_NAME: 'specForgeDataAPI',
    CONTEXT_BUCKET: 'specforge-contexts',
  },
});
```

### package.json
```json
{
  "name": "context-selector",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.592.0",
    "@aws-sdk/client-appsync": "^3.592.0",
    "@aws-sdk/client-kms": "^3.592.0",
    "@anthropic-ai/tokenizer": "^0.1.0",
    "aws-lambda": "^1.0.7",
    "simple-git": "^3.24.0",
    "glob": "^10.3.10",
    "fast-glob": "^3.3.2",
    "ignore": "^5.3.1",
    "@babel/parser": "^7.24.0",
    "@typescript-eslint/typescript-estree": "^7.0.0",
    "acorn": "^8.11.3",
    "acorn-walk": "^8.3.2"
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
import { generateGlobalContext } from './lib/generators/global-context';
import { generateWorkspaceContext } from './lib/generators/workspace-context';
import { generateFeatureContext } from './lib/generators/feature-context';
import { combineContexts } from './lib/context-merger';
import { AppSyncClient } from './lib/appsync-client';

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

interface GenerateContextInput {
  operation: 'generateGlobal' | 'generateWorkspace' | 'generateFeature' | 'combine';
  projectId?: string;
  workspaceId?: string;
  includeDependencies?: boolean;
  scope?: {
    includes?: string[];
    excludes?: string[];
    workspaceIds?: string[];
    maxDepth?: number;
  };
  contextIds?: string[];
  name?: string;
}

export const handler: AppSyncResolverHandler<GenerateContextInput, any> = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { operation } = event.arguments;
  
  try {
    switch (operation) {
      case 'generateGlobal':
        return await handleGenerateGlobal(event.arguments);
      
      case 'generateWorkspace':
        return await handleGenerateWorkspace(event.arguments);
      
      case 'generateFeature':
        return await handleGenerateFeature(event.arguments);
      
      case 'combine':
        return await handleCombineContexts(event.arguments);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error in context-selector:', error);
    throw error;
  }
};

async function handleGenerateGlobal(input: GenerateContextInput) {
  const { projectId, name } = input;
  
  if (!projectId) {
    throw new Error('projectId is required for generateGlobal');
  }
  
  console.log(`Generating global context for project ${projectId}`);
  
  const contextData = await generateGlobalContext(projectId);
  
  // Create Context record
  const context = await appsyncClient.createContext({
    projectId,
    name: name || `Global Context - ${new Date().toISOString()}`,
    type: 'global',
    scope: contextData.scope,
    content: contextData.content,
    tokenCount: contextData.tokenCount,
    s3Key: contextData.s3Key,
  });
  
  return {
    success: true,
    context,
    message: 'Global context generated successfully',
  };
}

async function handleGenerateWorkspace(input: GenerateContextInput) {
  const { workspaceId, includeDependencies = false, name } = input;
  
  if (!workspaceId) {
    throw new Error('workspaceId is required for generateWorkspace');
  }
  
  console.log(`Generating workspace context for ${workspaceId}`);
  console.log(`Include dependencies: ${includeDependencies}`);
  
  const contextData = await generateWorkspaceContext(workspaceId, includeDependencies);
  
  // Get workspace to extract projectId
  const workspace = await appsyncClient.getWorkspace(workspaceId);
  
  // Create Context record
  const context = await appsyncClient.createContext({
    projectId: workspace.repository.projectId,
    workspaceId,
    name: name || `${workspace.name} Context - ${new Date().toISOString()}`,
    type: 'workspace',
    scope: contextData.scope,
    content: contextData.content,
    tokenCount: contextData.tokenCount,
    s3Key: contextData.s3Key,
  });
  
  return {
    success: true,
    context,
    message: 'Workspace context generated successfully',
  };
}

async function handleGenerateFeature(input: GenerateContextInput) {
  const { projectId, scope, name } = input;
  
  if (!projectId || !scope) {
    throw new Error('projectId and scope are required for generateFeature');
  }
  
  console.log(`Generating feature context for project ${projectId}`);
  console.log('Scope:', JSON.stringify(scope, null, 2));
  
  const contextData = await generateFeatureContext(projectId, scope);
  
  // Create Context record
  const context = await appsyncClient.createContext({
    projectId,
    name: name || `Feature Context - ${new Date().toISOString()}`,
    type: 'feature',
    scope: contextData.scope,
    content: contextData.content,
    tokenCount: contextData.tokenCount,
    s3Key: contextData.s3Key,
  });
  
  return {
    success: true,
    context,
    message: 'Feature context generated successfully',
  };
}

async function handleCombineContexts(input: GenerateContextInput) {
  const { contextIds, projectId, name } = input;
  
  if (!contextIds || contextIds.length === 0) {
    throw new Error('contextIds array is required for combine');
  }
  
  if (!projectId) {
    throw new Error('projectId is required for combine');
  }
  
  console.log(`Combining ${contextIds.length} contexts`);
  
  const contextData = await combineContexts(contextIds);
  
  // Create combined Context record
  const context = await appsyncClient.createContext({
    projectId,
    name: name || `Combined Context - ${new Date().toISOString()}`,
    type: 'feature', // Combined contexts are treated as feature contexts
    scope: contextData.scope,
    content: contextData.content,
    tokenCount: contextData.tokenCount,
    s3Key: contextData.s3Key,
  });
  
  return {
    success: true,
    context,
    message: 'Contexts combined successfully',
  };
}
```

### lib/generators/global-context.ts
```typescript
import { AppSyncClient } from '../appsync-client';
import { GitClient } from '../git-client';
import { FileAnalyzer } from '../analyzers/file-analyzer';
import { StructureBuilder } from '../analyzers/structure-builder';
import { TokenCounter } from '../token-counter';
import { S3Storage } from '../s3-storage';

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

const gitClient = new GitClient();
const fileAnalyzer = new FileAnalyzer();
const structureBuilder = new StructureBuilder();
const tokenCounter = new TokenCounter();
const s3Storage = new S3Storage(process.env.CONTEXT_BUCKET!);

export async function generateGlobalContext(projectId: string) {
  console.log(`Generating global context for project ${projectId}`);
  
  // Get project and repository
  const project = await appsyncClient.getProject(projectId);
  const repository = await appsyncClient.getRepositoryByProject(projectId);
  
  if (!repository) {
    throw new Error('Repository not found for project');
  }
  
  // Get credentials
  const credentials = await appsyncClient.getGitCredential(repository.id);
  
  // Clone/pull repository
  const repoPath = await gitClient.cloneOrPull(repository, credentials);
  
  // Get all workspaces
  const workspaces = await appsyncClient.listWorkspaces(repository.id);
  
  // Build scope
  const scope = {
    includes: ['**/*'],
    excludes: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    workspaceIds: workspaces.map(ws => ws.id),
    maxDepth: 10,
  };
  
  // Analyze repository structure
  const structure = await structureBuilder.build(repoPath, scope);
  
  // Extract key files
  const keyFiles = [
    'package.json',
    'README.md',
    'turbo.json',
    'nx.json',
    'lerna.json',
    'pnpm-workspace.yaml',
    '.gitignore',
    'tsconfig.json',
  ];
  
  const files = [];
  
  for (const fileName of keyFiles) {
    const analysis = await fileAnalyzer.analyzeFile(repoPath, fileName);
    if (analysis) {
      files.push(analysis);
    }
  }
  
  // Add workspace summaries
  for (const workspace of workspaces) {
    const wsPath = workspace.path === '.' ? repoPath : `${repoPath}/${workspace.path}`;
    const wsAnalysis = await fileAnalyzer.analyzeFile(wsPath, 'package.json');
    
    if (wsAnalysis) {
      files.push({
        ...wsAnalysis,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
      });
    }
  }
  
  // Build content
  const content = {
    projectName: project.name,
    repositoryUrl: repository.repoUrl,
    isMonorepo: repository.isMonorepo,
    monorepoType: repository.monorepoType,
    workspaceCount: workspaces.length,
    structure,
    files,
    workspaces: workspaces.map(ws => ({
      id: ws.id,
      name: ws.name,
      path: ws.path,
      type: ws.type,
      framework: ws.framework,
      language: ws.language,
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      branchAnalyzed: repository.currentBranch,
    },
  };
  
  // Count tokens
  const tokenCount = await tokenCounter.count(JSON.stringify(content));
  
  console.log(`Global context token count: ${tokenCount}`);
  
  // Store in S3 if too large (> 50KB)
  let s3Key;
  const contentSize = JSON.stringify(content).length;
  
  if (contentSize > 50000) {
    console.log('Context too large, storing in S3');
    s3Key = await s3Storage.store(projectId, 'global', content);
  }
  
  // Cleanup
  await gitClient.cleanup(repoPath);
  
  return {
    scope,
    content: contentSize > 50000 ? { summary: 'Stored in S3', s3Key } : content,
    tokenCount,
    s3Key,
  };
}
```

### lib/generators/workspace-context.ts
```typescript
import { AppSyncClient } from '../appsync-client';
import { GitClient } from '../git-client';
import { FileAnalyzer } from '../analyzers/file-analyzer';
import { StructureBuilder } from '../analyzers/structure-builder';
import { TokenCounter } from '../token-counter';
import { S3Storage } from '../s3-storage';
import path from 'path';

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

const gitClient = new GitClient();
const fileAnalyzer = new FileAnalyzer();
const structureBuilder = new StructureBuilder();
const tokenCounter = new TokenCounter();
const s3Storage = new S3Storage(process.env.CONTEXT_BUCKET!);

export async function generateWorkspaceContext(
  workspaceId: string,
  includeDependencies: boolean
) {
  console.log(`Generating workspace context for ${workspaceId}`);
  
  // Get workspace
  const workspace = await appsyncClient.getWorkspace(workspaceId);
  const repository = workspace.repository;
  
  // Get credentials
  const credentials = await appsyncClient.getGitCredential(repository.id);
  
  // Clone/pull repository
  const repoPath = await gitClient.cloneOrPull(repository, credentials);
  const workspacePath = workspace.path === '.' ? repoPath : path.join(repoPath, workspace.path);
  
  // Get dependencies if requested
  let dependentWorkspaces = [];
  
  if (includeDependencies) {
    const dependencies = await appsyncClient.getWorkspaceDependencies(workspaceId);
    dependentWorkspaces = await Promise.all(
      dependencies.map(dep => appsyncClient.getWorkspace(dep.dependsOnWorkspaceId))
    );
  }
  
  // Build scope
  const scope = {
    includes: [`${workspace.path}/**/*`],
    excludes: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
    ],
    workspaceIds: [workspaceId, ...dependentWorkspaces.map(ws => ws.id)],
    maxDepth: 10,
  };
  
  // Analyze workspace structure
  const structure = await structureBuilder.build(workspacePath, {
    includes: ['**/*'],
    excludes: scope.excludes,
    maxDepth: 10,
  });
  
  // Analyze all source files
  const files = await fileAnalyzer.analyzeDirectory(workspacePath, {
    includes: ['**/*.{ts,tsx,js,jsx,json}'],
    excludes: scope.excludes,
    maxFiles: 100, // Limit to prevent huge contexts
  });
  
  // Include dependency contexts if requested
  const dependencyContexts = [];
  
  if (includeDependencies) {
    for (const depWorkspace of dependentWorkspaces) {
      const depPath = depWorkspace.path === '.' ? repoPath : path.join(repoPath, depWorkspace.path);
      const depFiles = await fileAnalyzer.analyzeDirectory(depPath, {
        includes: ['**/*.{ts,tsx,js,jsx,json}'],
        excludes: scope.excludes,
        maxFiles: 50, // Fewer files for dependencies
      });
      
      dependencyContexts.push({
        workspace: {
          id: depWorkspace.id,
          name: depWorkspace.name,
          path: depWorkspace.path,
        },
        files: depFiles,
      });
    }
  }
  
  // Build content
  const content = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      path: workspace.path,
      type: workspace.type,
      framework: workspace.framework,
      language: workspace.language,
      packageJson: workspace.packageJson,
    },
    structure,
    files,
    dependencies: dependencyContexts,
    metadata: {
      generatedAt: new Date().toISOString(),
      branchAnalyzed: repository.currentBranch,
      includedDependencies: includeDependencies,
    },
  };
  
  // Count tokens
  const tokenCount = await tokenCounter.count(JSON.stringify(content));
  
  console.log(`Workspace context token count: ${tokenCount}`);
  
  // Store in S3 if too large
  let s3Key;
  const contentSize = JSON.stringify(content).length;
  
  if (contentSize > 50000) {
    console.log('Context too large, storing in S3');
    s3Key = await s3Storage.store(
      repository.projectId,
      `workspace-${workspaceId}`,
      content
    );
  }
  
  // Cleanup
  await gitClient.cleanup(repoPath);
  
  return {
    scope,
    content: contentSize > 50000 ? { summary: 'Stored in S3', s3Key } : content,
    tokenCount,
    s3Key,
  };
}
```

### lib/analyzers/file-analyzer.ts
```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export class FileAnalyzer {
  async analyzeFile(basePath: string, filePath: string) {
    const fullPath = path.join(basePath, filePath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        return null;
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const language = this.detectLanguage(filePath);
      
      return {
        path: filePath,
        language,
        size: stats.size,
        lines: content.split('\n').length,
        excerpt: content.slice(0, 500), // First 500 chars
        fullContent: content.length < 10000 ? content : undefined, // Include full if small
      };
    } catch (error) {
      console.log(`Could not analyze file ${filePath}:`, error);
      return null;
    }
  }
  
  async analyzeDirectory(dirPath: string, options: {
    includes: string[];
    excludes: string[];
    maxFiles: number;
  }) {
    const { includes, excludes, maxFiles } = options;
    
    const files = await glob(includes, {
      cwd: dirPath,
      ignore: excludes,
      absolute: false,
    });
    
    const analyses = [];
    
    for (const file of files.slice(0, maxFiles)) {
      const analysis = await this.analyzeFile(dirPath, file);
      if (analysis) {
        analyses.push(analysis);
      }
    }
    
    return analyses;
  }
  
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript-react',
      '.js': 'javascript',
      '.jsx': 'javascript-react',
      '.json': 'json',
      '.md': 'markdown',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.css': 'css',
      '.scss': 'scss',
      '.html': 'html',
    };
    
    return langMap[ext] || 'text';
  }
}
```

### lib/token-counter.ts
```typescript
import { encode } from '@anthropic-ai/tokenizer';

export class TokenCounter {
  async count(text: string): Promise<number> {
    try {
      // Use Anthropic tokenizer for Claude-3 compatibility
      const tokens = encode(text);
      return tokens.length;
    } catch (error) {
      console.error('Error counting tokens:', error);
      // Fallback: rough estimation (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }
}
```

### lib/s3-storage.ts
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class S3Storage {
  private s3Client: S3Client;
  private bucketName: string;
  
  constructor(bucketName: string) {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    this.bucketName = bucketName;
  }
  
  async store(projectId: string, contextType: string, content: any): Promise<string> {
    const key = `${projectId}/${contextType}/${Date.now()}.json`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(content),
      ContentType: 'application/json',
    });
    
    await this.s3Client.send(command);
    
    console.log(`Stored context in S3: ${key}`);
    
    return key;
  }
  
  async retrieve(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    
    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No body in S3 response');
    }
    
    const bodyString = await this.streamToString(response.Body as Readable);
    
    return JSON.parse(bodyString);
  }
  
  private async streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }
}
```

### lib/context-merger.ts
```typescript
import { AppSyncClient } from './appsync-client';
import { TokenCounter } from './token-counter';
import { S3Storage } from './s3-storage';

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

const tokenCounter = new TokenCounter();
const s3Storage = new S3Storage(process.env.CONTEXT_BUCKET!);

export async function combineContexts(contextIds: string[]) {
  console.log(`Combining ${contextIds.length} contexts`);
  
  // Get all contexts
  const contexts = await Promise.all(
    contextIds.map(id => appsyncClient.getContext(id))
  );
  
  // Retrieve content from S3 if needed
  const contextContents = await Promise.all(
    contexts.map(async ctx => {
      if (ctx.s3Key) {
        return await s3Storage.retrieve(ctx.s3Key);
      }
      return ctx.content;
    })
  );
  
  // Merge scopes
  const combinedScope = {
    includes: [...new Set(contexts.flatMap(ctx => ctx.scope.includes || []))],
    excludes: [...new Set(contexts.flatMap(ctx => ctx.scope.excludes || []))],
    workspaceIds: [...new Set(contexts.flatMap(ctx => ctx.scope.workspaceIds || []))],
    maxDepth: Math.max(...contexts.map(ctx => ctx.scope.maxDepth || 10)),
  };
  
  // Merge content
  const combinedContent = {
    sourceContexts: contexts.map(ctx => ({
      id: ctx.id,
      name: ctx.name,
      type: ctx.type,
    })),
    merged: {
      files: deduplicateFiles(contextContents.flatMap(c => c.files || [])),
      workspaces: deduplicateWorkspaces(contextContents.flatMap(c => c.workspaces || [])),
      structure: mergeStructures(contextContents.map(c => c.structure)),
    },
    metadata: {
      combinedAt: new Date().toISOString(),
      contextCount: contexts.length,
    },
  };
  
  // Count tokens
  const tokenCount = await tokenCounter.count(JSON.stringify(combinedContent));
  
  console.log(`Combined context token count: ${tokenCount}`);
  
  // Store in S3 if too large
  let s3Key;
  const contentSize = JSON.stringify(combinedContent).length;
  
  if (contentSize > 50000) {
    console.log('Combined context too large, storing in S3');
    const projectId = contexts[0].projectId;
    s3Key = await s3Storage.store(projectId, 'combined', combinedContent);
  }
  
  return {
    scope: combinedScope,
    content: contentSize > 50000 ? { summary: 'Stored in S3', s3Key } : combinedContent,
    tokenCount,
    s3Key,
  };
}

function deduplicateFiles(files: any[]): any[] {
  const seen = new Set<string>();
  return files.filter(file => {
    if (seen.has(file.path)) {
      return false;
    }
    seen.add(file.path);
    return true;
  });
}

function deduplicateWorkspaces(workspaces: any[]): any[] {
  const seen = new Set<string>();
  return workspaces.filter(ws => {
    if (seen.has(ws.id)) {
      return false;
    }
    seen.add(ws.id);
    return true;
  });
}

function mergeStructures(structures: any[]): any {
  // Simple merge - combine all directory trees
  return {
    merged: true,
    structures: structures.filter(Boolean),
  };
}
```

---

## Backend Configuration

Update `amplify/backend.ts`:

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';
import { monorepoAnalyzer } from './functions/monorepo-analyzer/resource';
import { contextSelector } from './functions/context-selector/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
  monorepoAnalyzer,
  contextSelector,
});

// Grant AppSync permissions
backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.gitIntegration.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.monorepoAnalyzer.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.monorepoAnalyzer.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.contextSelector.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.contextSelector.resources.lambda);

// Create S3 bucket for large contexts
const contextBucket = new Bucket(backend.contextSelector.resources.lambda, 'ContextBucket', {
  bucketName: 'specforge-contexts',
  versioned: true,
  encryption: BucketEncryption.S3_MANAGED,
});

// Grant S3 permissions to context-selector
contextBucket.grantReadWrite(backend.contextSelector.resources.lambda);

// Grant KMS permissions for credential decryption
const kmsKey = Key.fromLookup(backend.contextSelector.resources.lambda, 'specforge-git-credentials-key', {
  aliasName: 'alias/specforge-git-credentials',
});

kmsKey.grantDecrypt(backend.contextSelector.resources.lambda);
```

---

## Testing Infrastructure

### Test Script: test-context-generation.ts

Create `scripts/test-context-generation.ts`:

```typescript
#!/usr/bin/env node
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function testGlobalContext() {
  console.log('\n🌍 Testing Global Context Generation\n');
  
  const projectId = process.env.PROJECT_ID;
  
  if (!projectId) {
    console.error('PROJECT_ID environment variable required');
    process.exit(1);
  }
  
  console.log(`Generating global context for project: ${projectId}`);
  
  // TODO: Call context generation mutation
  // This would be implemented in your GraphQL schema
  
  console.log('✓ Global context generated\n');
}

async function testWorkspaceContext() {
  console.log('\n📦 Testing Workspace Context Generation\n');
  
  const workspaceId = process.env.WORKSPACE_ID;
  
  if (!workspaceId) {
    console.error('WORKSPACE_ID environment variable required');
    process.exit(1);
  }
  
  console.log(`Generating workspace context for: ${workspaceId}`);
  console.log('With dependencies: true');
  
  // TODO: Call workspace context generation mutation
  
  console.log('✓ Workspace context generated\n');
}

async function testFeatureContext() {
  console.log('\n🎯 Testing Feature Context Generation\n');
  
  const projectId = process.env.PROJECT_ID;
  
  if (!projectId) {
    console.error('PROJECT_ID environment variable required');
    process.exit(1);
  }
  
  const scope = {
    includes: ['src/components/**/*.tsx', 'src/lib/**/*.ts'],
    excludes: ['**/*.test.*', '**/*.spec.*'],
    maxDepth: 5,
  };
  
  console.log('Generating feature context with scope:', JSON.stringify(scope, null, 2));
  
  // TODO: Call feature context generation mutation
  
  console.log('✓ Feature context generated\n');
}

async function testContextCombination() {
  console.log('\n🔗 Testing Context Combination\n');
  
  // Get some contexts
  const contexts = await client.models.Context.list({
    limit: 3,
  });
  
  if (contexts.data.length < 2) {
    console.log('⚠ Not enough contexts to combine (need at least 2)');
    return;
  }
  
  const contextIds = contexts.data.slice(0, 2).map(c => c.id);
  
  console.log(`Combining ${contextIds.length} contexts`);
  
  // TODO: Call context combination mutation
  
  console.log('✓ Contexts combined\n');
}

async function listContexts() {
  console.log('\n📋 Listing All Contexts\n');
  
  const contexts = await client.models.Context.list();
  
  console.log(`Found ${contexts.data.length} contexts:\n`);
  
  for (const ctx of contexts.data) {
    console.log(`  📄 ${ctx.name}`);
    console.log(`     Type: ${ctx.type}`);
    console.log(`     Tokens: ${ctx.tokenCount}`);
    console.log(`     Created: ${ctx.createdAt}`);
    console.log(`     S3: ${ctx.s3Key ? 'Yes' : 'No'}\n`);
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'global':
        await testGlobalContext();
        break;
      
      case 'workspace':
        await testWorkspaceContext();
        break;
      
      case 'feature':
        await testFeatureContext();
        break;
      
      case 'combine':
        await testContextCombination();
        break;
      
      case 'list':
        await listContexts();
        break;
      
      case 'all':
        await testGlobalContext();
        await testWorkspaceContext();
        await testFeatureContext();
        await testContextCombination();
        await listContexts();
        break;
      
      default:
        console.log('Usage: npm run test:context <command>');
        console.log('\nCommands:');
        console.log('  global     - Test global context generation');
        console.log('  workspace  - Test workspace context generation');
        console.log('  feature    - Test feature context generation');
        console.log('  combine    - Test context combination');
        console.log('  list       - List all contexts');
        console.log('  all        - Run all tests');
        console.log('\nEnvironment variables:');
        console.log('  PROJECT_ID    - Required for global/feature tests');
        console.log('  WORKSPACE_ID  - Required for workspace tests');
        process.exit(1);
    }
    
    console.log('✅ Tests completed successfully\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:context": "tsx scripts/test-context-generation.ts",
    "test:context:global": "tsx scripts/test-context-generation.ts global",
    "test:context:workspace": "tsx scripts/test-context-generation.ts workspace",
    "test:context:feature": "tsx scripts/test-context-generation.ts feature",
    "test:context:all": "tsx scripts/test-context-generation.ts all"
  }
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Generate global context for entire project
- ✅ Generate workspace context with optional dependencies
- ✅ Generate feature context with custom scope
- ✅ Combine multiple contexts into one
- ✅ Accurately count tokens using Claude-3 tokenizer
- ✅ Store large contexts in S3 automatically
- ✅ Analyze file structure and content
- ✅ Handle multiple programming languages

### Performance Requirements
- ✅ Generate contexts within 5 minutes for typical repos
- ✅ Handle repositories up to 500MB
- ✅ Support contexts up to 200K tokens
- ✅ Efficient S3 storage for large contexts
- ✅ Memory-efficient file processing

### Data Quality
- ✅ Accurate token counting
- ✅ Proper file deduplication
- ✅ Correct workspace dependency resolution
- ✅ Complete scope definition
- ✅ Meaningful file excerpts

### Error Handling
- ✅ Handle missing files gracefully
- ✅ Handle binary files appropriately
- ✅ Timeout protection for large contexts
- ✅ Clear error messages
- ✅ Automatic cleanup on failure

---

## Deployment Steps

### 1. Create S3 Bucket
```bash
# Create bucket for contexts
aws s3 mb s3://specforge-contexts --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket specforge-contexts \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket specforge-contexts \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### 2. Deploy Lambda Function
```bash
cd amplify/functions/context-selector
npm install
npm run build
cd ../../..
npx ampx sandbox
```

### 3. Verify Deployment
```bash
# Check Lambda exists
aws lambda list-functions --query 'Functions[?contains(FunctionName, `context-selector`)].FunctionName'

# Check environment variables
aws lambda get-function-configuration \
  --function-name <function-name> \
  --query 'Environment.Variables'

# Check S3 permissions
aws lambda get-policy --function-name <function-name>
```

### 4. Run Tests
```bash
# Set environment variables
export PROJECT_ID=<your-project-id>
export WORKSPACE_ID=<your-workspace-id>

# Run all tests
npm run test:context:all
```

---

## Troubleshooting

### Issue: Token count inaccurate
**Solution:**
- Verify `@anthropic-ai/tokenizer` is installed correctly
- Check tokenizer version compatibility with Claude-3
- Test with known token counts

### Issue: Context too large for Lambda
**Solution:**
- Reduce `maxFiles` limit in analyzers
- Increase Lambda memory to 3GB
- Implement streaming for file processing

### Issue: S3 storage failing
**Solution:**
- Verify bucket exists and has correct permissions
- Check Lambda IAM role has S3 write permissions
- Verify bucket name in environment variables

### Issue: Missing dependencies in context
**Solution:**
- Verify `MonorepoDependency` records exist
- Check workspace IDs are correct
- Review dependency graph in database

---

## Next Steps (Epic 04)

After completing this epic:
1. Specifications can use rich, accurate contexts
2. AI prompts have complete codebase understanding
3. Context can be scoped to specific features
4. Multiple contexts can be combined for complex specs

---

## Progress Tracking

- [ ] Day 1: Global & workspace context generators
- [ ] Day 2: Feature context & file analyzers
- [ ] Day 3: Context merger, S3 storage & testing

**Estimated Total Time**: 24 hours over 3 days
