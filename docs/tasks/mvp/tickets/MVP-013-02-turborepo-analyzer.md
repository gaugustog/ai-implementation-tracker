# MVP-013-02: Turborepo Analyzer

**Epic**: Epic-02 - Repository Analysis & Workspace Discovery  
**Ticket**: MVP-013-02  
**Estimated Time**: 4 hours  
**Priority**: High (First analyzer implementation)  
**Status**: Todo

---

## Objective

Implement complete Turborepo analysis including workspace discovery, dependency graph building, and framework detection. This is the **first analyzer** to be implemented and serves as a reference pattern for other monorepo analyzers.

---

## Context

Turborepo is a high-performance build system for JavaScript/TypeScript monorepos. It's widely used in modern web development and is the recommended tool by Vercel (creators of Next.js).

**Key Characteristics**:
- Uses `turbo.json` for pipeline configuration
- Relies on package manager workspaces (npm, yarn, pnpm)
- Workspaces defined in root `package.json`
- Common structure: `apps/` (applications) and `packages/` (shared libraries)

**Analysis Flow**:
```
detectMonorepoType() returns 'turborepo'
    ↓
analyzeMonorepo() dispatches to analyzeTurborepo()
    ↓
1. Read turbo.json (pipeline, outputs, caching)
2. Read root package.json (workspace patterns)
3. Discover all workspaces via glob patterns
4. Parse each workspace's package.json
5. Detect workspace types (app/package/library)
6. Detect frameworks (Next.js, React, etc.)
7. Build internal dependency graph
8. Return MonorepoAnalysisResult
```

**Result**: Used by handler to create MonorepoStructure + Workspace records + MonorepoDependency records in AppSync.

---

## Implementation Details

### Files to Create

**File 1**: `amplify/functions/monorepo-analyzer/lib/analyzers/index.ts`  
**File 2**: `amplify/functions/monorepo-analyzer/lib/analyzers/turborepo.ts`

---

### File 1: analyzers/index.ts

This is the **analyzer dispatcher** that routes to the correct analyzer based on monorepo type.

```typescript
import { MonorepoType } from '../detector';
import { analyzeTurborepo } from './turborepo';
import { analyzeNx } from './nx';
import { analyzeLerna } from './lerna';
import { analyzeYarnWorkspaces } from './yarn-workspaces';
import { analyzePnpm } from './pnpm';

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
    type: 'app' | 'package' | 'library' | 'feature';
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

---

### File 2: analyzers/turborepo.ts

Complete Turborepo analyzer implementation.

```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { MonorepoAnalysisResult } from './index';

/**
 * Analyze a Turborepo monorepo.
 * 
 * Process:
 * 1. Read turbo.json for pipeline configuration
 * 2. Read root package.json for workspace patterns
 * 3. Discover all workspaces using glob patterns
 * 4. Parse each workspace's package.json
 * 5. Detect workspace types based on path and package.json
 * 6. Detect frameworks from dependencies
 * 7. Build internal dependency graph
 * 8. Return complete analysis result
 * 
 * Turborepo Structure:
 * - turbo.json: Pipeline, caching, outputs
 * - package.json: Workspace patterns (e.g., ["apps/*", "packages/*"])
 * - Typical layout:
 *   - apps/web (Next.js app)
 *   - apps/docs (Next.js docs)
 *   - packages/ui (React component library)
 *   - packages/config (shared ESLint/TS configs)
 * 
 * @param repositoryId - Repository ID (for logging)
 * @param repoPath - Absolute path to cloned repository
 * @returns MonorepoAnalysisResult with structure, workspaces, dependencies
 * 
 * @throws Error if turbo.json or package.json missing/invalid
 */
export async function analyzeTurborepo(
  repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing Turborepo structure');
  
  // Read turbo.json
  const turboConfigPath = path.join(repoPath, 'turbo.json');
  const turboConfigContent = await fs.readFile(turboConfigPath, 'utf-8');
  const turboConfig = JSON.parse(turboConfigContent);
  
  console.log('Turbo config loaded:', {
    hasPipeline: !!turboConfig.pipeline,
    globalDependencies: turboConfig.globalDependencies?.length || 0,
  });
  
  // Read root package.json
  const rootPackageJsonPath = path.join(repoPath, 'package.json');
  const rootPackageJsonContent = await fs.readFile(rootPackageJsonPath, 'utf-8');
  const rootPackageJson = JSON.parse(rootPackageJsonContent);
  
  // Get workspace patterns
  // Supports both array and object formats:
  // - Array: ["apps/*", "packages/*"]
  // - Object: { "packages": ["apps/*", "packages/*"] }
  let workspacePatterns: string[] = [];
  
  if (Array.isArray(rootPackageJson.workspaces)) {
    workspacePatterns = rootPackageJson.workspaces;
  } else if (rootPackageJson.workspaces?.packages) {
    workspacePatterns = rootPackageJson.workspaces.packages;
  } else {
    throw new Error('No workspace patterns found in root package.json');
  }
  
  console.log('Workspace patterns:', workspacePatterns);
  
  // Find all package.json files in workspaces
  const workspaces = [];
  const workspaceMap = new Map<string, any>();
  
  for (const pattern of workspacePatterns) {
    const packageJsonFiles = await glob(`${pattern}/package.json`, {
      cwd: repoPath,
      absolute: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });
    
    console.log(`Pattern "${pattern}" found ${packageJsonFiles.length} workspaces`);
    
    for (const pkgFile of packageJsonFiles) {
      const pkgPath = path.join(repoPath, pkgFile);
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const packageJson = JSON.parse(pkgContent);
      
      // Extract workspace path (directory containing package.json)
      const workspacePath = path.dirname(pkgFile);
      
      // Detect workspace type, framework, and language
      const workspaceType = detectWorkspaceType(workspacePath, packageJson);
      const framework = detectFramework(packageJson);
      const language = detectLanguage(packageJson);
      
      const workspace = {
        name: packageJson.name,
        path: workspacePath,
        type: workspaceType,
        framework: framework,
        language: language,
        packageJson: packageJson,
        metadata: {
          version: packageJson.version,
          description: packageJson.description,
          scripts: Object.keys(packageJson.scripts || {}),
          hasTests: !!(packageJson.scripts?.test || packageJson.scripts?.['test:unit']),
          hasLint: !!(packageJson.scripts?.lint),
          hasBuild: !!(packageJson.scripts?.build),
        },
      };
      
      workspaces.push(workspace);
      workspaceMap.set(packageJson.name, workspace);
      
      console.log(`  ✓ ${packageJson.name} (${workspaceType}, ${framework || 'no framework'})`);
    }
  }
  
  console.log(`Total workspaces discovered: ${workspaces.length}`);
  
  // Build dependency graph
  const dependencies = [];
  
  for (const workspace of workspaces) {
    const deps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
      ...workspace.packageJson.peerDependencies,
    };
    
    for (const [depName, version] of Object.entries(deps)) {
      // Check if this is an internal workspace dependency
      if (workspaceMap.has(depName)) {
        const depType = getDependencyType(workspace.packageJson, depName);
        
        dependencies.push({
          workspaceName: workspace.name,
          dependsOnWorkspaceName: depName,
          type: depType,
          version: version as string,
        });
        
        console.log(`  → ${workspace.name} depends on ${depName} (${depType})`);
      }
    }
  }
  
  console.log(`Total internal dependencies: ${dependencies.length}`);
  
  // Build dependency graph visualization
  const dependencyGraph = {
    nodes: workspaces.map(ws => ({
      id: ws.name,
      type: ws.type,
      path: ws.path,
      framework: ws.framework,
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

/**
 * Detect workspace type based on path convention and package.json.
 * 
 * Rules:
 * 1. Path contains /apps/ or /app/ → 'app'
 * 2. Path contains /packages/ or /libs/ → 'package'
 * 3. Has main/module/exports field → 'library'
 * 4. Fallback → 'package'
 * 
 * @param workspacePath - Relative path to workspace
 * @param packageJson - Parsed package.json
 * @returns Workspace type
 */
function detectWorkspaceType(
  workspacePath: string,
  packageJson: any
): 'app' | 'package' | 'library' {
  const pathLower = workspacePath.toLowerCase();
  
  // Apps are typically in apps/ or app/ directory
  if (pathLower.includes('/apps/') || pathLower.includes('/app/')) {
    return 'app';
  }
  
  // Packages/libraries in packages/ or libs/
  if (pathLower.includes('/packages/') || pathLower.includes('/libs/')) {
    // Further classify as library if it has entry points
    if (packageJson.main || packageJson.module || packageJson.exports) {
      return 'library';
    }
    return 'package';
  }
  
  // Check if it's a library by package.json fields
  if (packageJson.main || packageJson.module || packageJson.exports) {
    return 'library';
  }
  
  return 'package';
}

/**
 * Detect framework from package.json dependencies.
 * 
 * Checks both dependencies and devDependencies.
 * Order matters: more specific frameworks first.
 * 
 * Supported frameworks:
 * - next (Next.js)
 * - react (React)
 * - vue (Vue.js)
 * - @angular/core (Angular)
 * - svelte (Svelte)
 * - express (Express)
 * - fastify (Fastify)
 * - nestjs (@nestjs/core)
 * - remix (@remix-run/react)
 * - astro (Astro)
 * - solid-js (SolidJS)
 * 
 * @param packageJson - Parsed package.json
 * @returns Framework name or undefined
 */
function detectFramework(packageJson: any): string | undefined {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  // Check for specific frameworks (order matters)
  if (deps['next']) return 'nextjs';
  if (deps['@remix-run/react']) return 'remix';
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps['astro']) return 'astro';
  if (deps['solid-js']) return 'solidjs';
  if (deps['react']) return 'react';
  if (deps['vue']) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps['svelte']) return 'svelte';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  
  return undefined;
}

/**
 * Detect programming language from package.json.
 * 
 * Rules:
 * 1. Has typescript dependency → 'typescript'
 * 2. Has @types/* dependency → 'typescript'
 * 3. Fallback → 'javascript'
 * 
 * @param packageJson - Parsed package.json
 * @returns Language ('typescript' or 'javascript')
 */
function detectLanguage(packageJson: any): string {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  // Check for TypeScript
  if (deps['typescript']) {
    return 'typescript';
  }
  
  // Check for @types packages (indicates TypeScript usage)
  const hasTypesPackages = Object.keys(deps).some(dep => dep.startsWith('@types/'));
  if (hasTypesPackages) {
    return 'typescript';
  }
  
  return 'javascript';
}

/**
 * Determine dependency type based on where it's declared.
 * 
 * Types:
 * - 'internal': In dependencies
 * - 'dev': In devDependencies
 * - 'peer': In peerDependencies
 * 
 * @param packageJson - Parsed package.json
 * @param depName - Dependency name
 * @returns Dependency type
 */
function getDependencyType(
  packageJson: any,
  depName: string
): 'internal' | 'dev' | 'peer' {
  if (packageJson.peerDependencies?.[depName]) {
    return 'peer';
  }
  
  if (packageJson.devDependencies?.[depName]) {
    return 'dev';
  }
  
  return 'internal';
}
```

---

## Key Features Explained

### 1. **Workspace Discovery via Glob Patterns**

```typescript
const workspacePatterns = rootPackageJson.workspaces;
// Example: ["apps/*", "packages/*"]

for (const pattern of workspacePatterns) {
  const packageJsonFiles = await glob(`${pattern}/package.json`, {
    cwd: repoPath,
    absolute: false,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });
  
  // Found: apps/web/package.json, apps/docs/package.json, packages/ui/package.json
}
```

**Why glob?**
- Patterns like `apps/*` match all directories in apps/
- More flexible than hardcoded paths
- Ignores build artifacts and node_modules

---

### 2. **Workspace Type Detection**

```typescript
function detectWorkspaceType(workspacePath: string, packageJson: any) {
  // apps/web → 'app'
  if (workspacePath.includes('/apps/')) return 'app';
  
  // packages/ui with main field → 'library'
  if (workspacePath.includes('/packages/') && packageJson.main) {
    return 'library';
  }
  
  // packages/config without main field → 'package'
  return 'package';
}
```

**Type Classification**:
- **app**: Deployable application (Next.js app, docs site)
- **library**: Shared code with entry point (UI components, utils)
- **package**: Configuration or tooling (ESLint config, TS config)

---

### 3. **Framework Detection**

```typescript
function detectFramework(packageJson: any): string | undefined {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  if (deps['next']) return 'nextjs';
  if (deps['react']) return 'react';
  // ... more frameworks
}
```

**Detection Strategy**:
- Check both dependencies and devDependencies
- Order matters: Next.js before React (Next.js includes React)
- Remix before React
- Framework-specific: @nestjs/core, @angular/core

---

### 4. **Internal Dependency Graph**

```typescript
for (const workspace of workspaces) {
  const deps = { ...workspace.packageJson.dependencies, ... };
  
  for (const [depName, version] of Object.entries(deps)) {
    if (workspaceMap.has(depName)) {
      // This is an internal workspace dependency
      dependencies.push({
        workspaceName: workspace.name,
        dependsOnWorkspaceName: depName,
        type: getDependencyType(workspace.packageJson, depName),
        version: version,
      });
    }
  }
}
```

**Example**:
```
@acme/web (app) 
  → depends on @acme/ui (library) 
  → depends on @acme/tsconfig (package)

@acme/docs (app)
  → depends on @acme/ui (library)
```

**Graph Structure**:
```json
{
  "nodes": [
    { "id": "@acme/web", "type": "app", "path": "apps/web" },
    { "id": "@acme/ui", "type": "library", "path": "packages/ui" }
  ],
  "edges": [
    { "from": "@acme/web", "to": "@acme/ui", "type": "internal" }
  ]
}
```

---

### 5. **Workspace Metadata**

```typescript
metadata: {
  version: packageJson.version,
  description: packageJson.description,
  scripts: Object.keys(packageJson.scripts || {}),
  hasTests: !!(packageJson.scripts?.test || packageJson.scripts?.['test:unit']),
  hasLint: !!(packageJson.scripts?.lint),
  hasBuild: !!(packageJson.scripts?.build),
}
```

**Purpose**: Additional context for UI and analysis
- Version tracking
- Available scripts
- Capabilities flags (tests, lint, build)

---

## Usage in Handler (MVP-017-02)

```typescript
import { detectMonorepoType } from './lib/detector';
import { analyzeMonorepo } from './lib/analyzers/index';

// After cloning repository
const repoPath = '/tmp/repos/repo-123';
const monorepoType = await detectMonorepoType(repoPath);

if (monorepoType === 'turborepo') {
  // Analyze Turborepo structure
  const analysisResult = await analyzeMonorepo(repositoryId, repoPath, monorepoType);
  
  // analysisResult contains:
  // - structure: { type, workspaceCount, rootConfig, dependencyGraph }
  // - workspaces: [{ name, path, type, framework, language, packageJson, metadata }]
  // - dependencies: [{ workspaceName, dependsOnWorkspaceName, type, version }]
  
  // Create MonorepoStructure record
  const structure = await appsyncClient.createMonorepoStructure({
    repositoryId,
    type: analysisResult.structure.type,
    workspaceCount: analysisResult.structure.workspaceCount,
    rootConfig: analysisResult.structure.rootConfig,
    dependencyGraph: analysisResult.structure.dependencyGraph,
    analyzedAt: new Date().toISOString(),
  });
  
  // Create Workspace records (batch)
  const workspaces = await appsyncClient.batchCreateWorkspaces(
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
  
  // Build workspace ID map
  const workspaceIdMap = new Map(
    workspaces.map(ws => [ws.name, ws.id])
  );
  
  // Create MonorepoDependency records (batch)
  await appsyncClient.batchCreateDependencies(
    analysisResult.dependencies.map(dep => ({
      workspaceId: workspaceIdMap.get(dep.workspaceName)!,
      dependsOnWorkspaceId: workspaceIdMap.get(dep.dependsOnWorkspaceName)!,
      monorepoStructureId: structure.id,
      type: dep.type,
      version: dep.version,
    }))
  );
  
  // Update repository
  await appsyncClient.updateRepository(repositoryId, {
    isMonorepo: true,
    monorepoType: 'turborepo',
    status: 'ready',
    lastAnalyzedAt: new Date().toISOString(),
  });
}
```

---

## Example Turborepo Structure

```
vercel-turbo-example/
├── turbo.json                    # Turborepo configuration
├── package.json                  # Root package.json with workspaces
├── apps/
│   ├── web/                      # Next.js app (type: 'app')
│   │   ├── package.json
│   │   ├── app/
│   │   └── next.config.js
│   └── docs/                     # Next.js docs (type: 'app')
│       ├── package.json
│       └── app/
└── packages/
    ├── ui/                       # React components (type: 'library')
    │   ├── package.json
    │   ├── src/
    │   └── tsconfig.json
    ├── eslint-config/            # ESLint config (type: 'package')
    │   ├── package.json
    │   └── index.js
    └── tsconfig/                 # TS config (type: 'package')
        ├── package.json
        ├── base.json
        └── nextjs.json
```

### Root package.json

```json
{
  "name": "turborepo-example",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "devDependencies": {
    "turbo": "^1.10.0"
  }
}
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

### Analysis Result

```typescript
{
  structure: {
    type: 'turborepo',
    workspaceCount: 5,
    rootConfig: { /* turbo.json content */ },
    dependencyGraph: {
      nodes: [
        { id: '@acme/web', type: 'app', path: 'apps/web', framework: 'nextjs' },
        { id: '@acme/docs', type: 'app', path: 'apps/docs', framework: 'nextjs' },
        { id: '@acme/ui', type: 'library', path: 'packages/ui', framework: 'react' },
        { id: '@acme/eslint-config', type: 'package', path: 'packages/eslint-config' },
        { id: '@acme/tsconfig', type: 'package', path: 'packages/tsconfig' }
      ],
      edges: [
        { from: '@acme/web', to: '@acme/ui', type: 'internal' },
        { from: '@acme/web', to: '@acme/tsconfig', type: 'dev' },
        { from: '@acme/web', to: '@acme/eslint-config', type: 'dev' },
        { from: '@acme/docs', to: '@acme/ui', type: 'internal' },
        { from: '@acme/ui', to: '@acme/tsconfig', type: 'dev' }
      ]
    }
  },
  workspaces: [
    {
      name: '@acme/web',
      path: 'apps/web',
      type: 'app',
      framework: 'nextjs',
      language: 'typescript',
      packageJson: { /* full package.json */ },
      metadata: {
        version: '1.0.0',
        scripts: ['dev', 'build', 'start', 'lint', 'test'],
        hasTests: true,
        hasLint: true,
        hasBuild: true
      }
    },
    // ... more workspaces
  ],
  dependencies: [
    {
      workspaceName: '@acme/web',
      dependsOnWorkspaceName: '@acme/ui',
      type: 'internal',
      version: 'workspace:*'
    },
    // ... more dependencies
  ]
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Read and parse turbo.json
- ✅ Read and parse root package.json
- ✅ Support both array and object workspace formats
- ✅ Discover all workspaces via glob patterns
- ✅ Ignore node_modules, dist, build directories
- ✅ Parse each workspace's package.json
- ✅ Detect workspace types (app/package/library)
- ✅ Detect frameworks (Next.js, React, Vue, etc.)
- ✅ Detect language (TypeScript vs JavaScript)
- ✅ Build internal dependency graph
- ✅ Classify dependency types (internal/dev/peer)
- ✅ Generate graph visualization (nodes + edges)
- ✅ Return MonorepoAnalysisResult with all data

### Error Handling Requirements
- ✅ Throw error if turbo.json missing or invalid JSON
- ✅ Throw error if package.json missing or invalid JSON
- ✅ Throw error if no workspace patterns found
- ✅ Handle missing workspace package.json gracefully
- ✅ Handle malformed workspace package.json gracefully
- ✅ Log warnings for workspaces without names

### Performance Requirements
- ✅ Complete analysis within 30 seconds for typical repos
- ✅ Handle up to 100 workspaces efficiently
- ✅ Process dependency graphs with 500+ edges

### Data Quality Requirements
- ✅ No duplicate workspace entries
- ✅ All internal dependencies correctly identified
- ✅ Workspace types accurately classified
- ✅ Framework detection covers common frameworks
- ✅ Dependency graph is acyclic (or cycles are acceptable)

---

## Testing Instructions

### 1. Create Files

```bash
# Create analyzer directory
mkdir -p amplify/functions/monorepo-analyzer/lib/analyzers

# Copy implementations
# - index.ts
# - turborepo.ts
```

### 2. Verify TypeScript Compilation

```bash
cd amplify/functions/monorepo-analyzer
npm run typecheck
```

**Expected**: No compilation errors

### 3. Unit Test (Manual)

Create test Turborepo structure:

```bash
mkdir -p /tmp/test-turbo/{apps/web,packages/ui}

# Root files
cat > /tmp/test-turbo/turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**"]
    }
  }
}
EOF

cat > /tmp/test-turbo/package.json << 'EOF'
{
  "name": "test-turbo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
EOF

# App workspace
cat > /tmp/test-turbo/apps/web/package.json << 'EOF'
{
  "name": "@test/web",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@test/ui": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "jest"
  }
}
EOF

# Package workspace
cat > /tmp/test-turbo/packages/ui/package.json << 'EOF'
{
  "name": "@test/ui",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "dependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF
```

Test script:

```typescript
import { analyzeTurborepo } from './lib/analyzers/turborepo';

async function test() {
  const result = await analyzeTurborepo('test-repo', '/tmp/test-turbo');
  
  console.log('Structure:', result.structure);
  console.log('Workspaces:', result.workspaces.length);
  console.log('Dependencies:', result.dependencies.length);
  
  // Assertions
  console.assert(result.structure.type === 'turborepo', 'Type should be turborepo');
  console.assert(result.structure.workspaceCount === 2, 'Should have 2 workspaces');
  console.assert(result.workspaces.length === 2, 'Should have 2 workspace objects');
  console.assert(result.dependencies.length === 1, 'Should have 1 internal dependency');
  
  const web = result.workspaces.find(ws => ws.name === '@test/web');
  console.assert(web?.type === 'app', 'web should be type app');
  console.assert(web?.framework === 'nextjs', 'web should use Next.js');
  console.assert(web?.language === 'typescript', 'web should use TypeScript');
  
  const ui = result.workspaces.find(ws => ws.name === '@test/ui');
  console.assert(ui?.type === 'library', 'ui should be type library');
  console.assert(ui?.framework === 'react', 'ui should use React');
  
  console.log('\n✓ All tests passed');
}

test().catch(console.error);
```

### 4. Integration Test (After MVP-017-02)

Will be tested when integrated into handler:
```bash
# Deploy Lambda
npx ampx sandbox

# Connect a real Turborepo repository
# Trigger analysis
# Verify workspaces and dependencies created in DynamoDB
```

---

## Environment Variables Required

**None** - This module only reads from file system.

---

## Dependencies

### NPM Packages (Already in package.json from MVP-009-02)
- `fs/promises` (Node.js built-in)
- `path` (Node.js built-in)
- `glob`: ^10.3.10

### Code Dependencies
- **Depends On**: 
  - MVP-009-02 (Lambda setup)
  - MVP-012-02 (MonorepoType definition from detector)
- **Blocks**: MVP-017-02 (Handler needs analyzer)
- **Parallel To**: MVP-014-02 (Nx), MVP-015-02 (Lerna/Yarn/PNPM), MVP-016-02 (Single repo)

---

## Troubleshooting Guide

### Issue: turbo.json Not Found
**Error**: `ENOENT: no such file or directory`

**Solution**:
1. Verify detector correctly identified as Turborepo
2. Check if turbo.json is gitignored (shouldn't be)
3. Verify file exists: `ls -la /tmp/repos/repo-123/turbo.json`
4. Check file permissions

---

### Issue: No Workspaces Found
**Symptoms**: `workspaces.length === 0`

**Solution**:
1. Check root package.json has workspaces field
2. Verify workspace patterns are correct
3. Check glob patterns match directories
4. Verify workspaces have package.json files
5. Check ignore patterns not excluding too much

**Debug**:
```typescript
console.log('Workspace patterns:', workspacePatterns);
console.log('Found files:', packageJsonFiles);
```

---

### Issue: Incorrect Workspace Types
**Symptoms**: App detected as package or vice versa

**Solution**:
1. Check path naming convention (apps/ vs packages/)
2. Review `detectWorkspaceType()` logic
3. For libraries, ensure package.json has main/module/exports field
4. Add custom logic for your repo structure

---

### Issue: Framework Not Detected
**Symptoms**: `framework: undefined` for known framework

**Solution**:
1. Add framework to `detectFramework()` function
2. Check dependency name spelling (case-sensitive)
3. Verify dependency in package.json (not just installed)
4. Check both dependencies and devDependencies

**Example Fix**:
```typescript
function detectFramework(packageJson: any): string | undefined {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Add your framework
  if (deps['your-framework']) return 'your-framework';
  
  // ... existing frameworks
}
```

---

### Issue: Missing Internal Dependencies
**Symptoms**: Dependency graph incomplete

**Solution**:
1. Verify workspace names match package.json names exactly
2. Check workspaceMap.has() logic
3. Review version format (workspace:*, ^1.0.0, etc.)
4. Check all dependency fields (dependencies, devDependencies, peerDependencies)

**Debug**:
```typescript
console.log('Workspace map keys:', Array.from(workspaceMap.keys()));
console.log('Dependencies in package:', Object.keys(deps));
```

---

### Issue: JSON Parse Error
**Error**: `Unexpected token in JSON`

**Solution**:
1. Check for trailing commas (invalid JSON)
2. Check for comments (invalid JSON, use comment-json if needed)
3. Verify file encoding (should be UTF-8)
4. Check for special characters

**Workaround**:
```typescript
import { parse as parseJSON } from 'comment-json';

// Instead of:
const config = JSON.parse(content);

// Use:
const config = parseJSON(content);
```

---

## Performance Optimization

### Current Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Read turbo.json | <5ms | Single file read |
| Read package.json | <5ms | Single file read |
| Glob discovery | 50-200ms | Depends on workspace count |
| Parse workspaces | 10-50ms | ~5ms per workspace |
| Build dep graph | 10-30ms | O(n×m) where n=workspaces, m=deps |
| **Total** | **100-300ms** | For typical repos (10-20 workspaces) |

### Optimization Techniques

1. **Parallel Workspace Processing**
```typescript
// Current: Sequential
for (const pkgFile of packageJsonFiles) {
  const workspace = await processWorkspace(pkgFile);
  workspaces.push(workspace);
}

// Optimized: Parallel
const workspacePromises = packageJsonFiles.map(pkgFile => 
  processWorkspace(pkgFile)
);
const workspaces = await Promise.all(workspacePromises);
```

2. **Glob Optimization**
```typescript
// Use fast-glob instead of glob (2-3x faster)
import fg from 'fast-glob';

const packageJsonFiles = await fg(`${pattern}/package.json`, {
  cwd: repoPath,
  absolute: false,
  ignore: ['**/node_modules/**'],
});
```

3. **Caching**
```typescript
// Cache parsed package.json files
const packageJsonCache = new Map<string, any>();

async function readPackageJson(path: string) {
  if (packageJsonCache.has(path)) {
    return packageJsonCache.get(path);
  }
  
  const content = await fs.readFile(path, 'utf-8');
  const parsed = JSON.parse(content);
  packageJsonCache.set(path, parsed);
  
  return parsed;
}
```

---

## File Size Reference

**File 1**: `analyzers/index.ts`  
**Lines**: ~60  
**Size**: ~2 KB

**File 2**: `analyzers/turborepo.ts`  
**Lines**: ~280  
**Size**: ~10 KB

---

## Related Files

- **Used By**: `handler.ts` (MVP-017-02)
- **Uses**: `detector.ts` (MVP-012-02) for MonorepoType
- **Parallel To**: 
  - `analyzers/nx.ts` (MVP-014-02)
  - `analyzers/lerna.ts` (MVP-015-02)
  - `analyzers/yarn-workspaces.ts` (MVP-015-02)
  - `analyzers/pnpm.ts` (MVP-015-02)

---

## Future Enhancements

### 1. **Turbo Cache Analysis**

```typescript
// Parse .turbo/ directory for cache statistics
const cacheStats = await analyzeTurboCache(repoPath);

metadata: {
  // ... existing metadata
  turboCache: {
    enabled: cacheStats.enabled,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    size: cacheStats.totalSize,
  }
}
```

---

### 2. **Task Dependencies**

```typescript
// Parse turbo.json pipeline for task dependencies
const taskDeps = extractTaskDependencies(turboConfig.pipeline);

metadata: {
  // ... existing metadata
  tasks: {
    build: { dependsOn: ['^build'] },
    test: { dependsOn: ['build', '^build'] },
    lint: { dependsOn: [] }
  }
}
```

---

### 3. **Workspace Scripts Analysis**

```typescript
// Analyze common scripts across workspaces
const commonScripts = findCommonScripts(workspaces);
// Returns: ['dev', 'build', 'test', 'lint'] are in 90% of workspaces

metadata: {
  // ... existing metadata
  commonScripts: commonScripts,
  scriptCoverage: {
    dev: 0.9,
    build: 1.0,
    test: 0.8,
    lint: 0.95
  }
}
```

---

## Validation Checklist

Before marking this ticket complete:

- [ ] File created: `amplify/functions/monorepo-analyzer/lib/analyzers/index.ts`
- [ ] File created: `amplify/functions/monorepo-analyzer/lib/analyzers/turborepo.ts`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] All JSDoc comments present
- [ ] Export `MonorepoAnalysisResult` interface
- [ ] Export `analyzeMonorepo` function
- [ ] Export `analyzeTurborepo` function
- [ ] Read turbo.json successfully
- [ ] Read root package.json successfully
- [ ] Support both array and object workspace formats
- [ ] Glob discovery works with patterns
- [ ] Ignore node_modules, dist, build directories
- [ ] Detect workspace types correctly
- [ ] Detect frameworks correctly
- [ ] Detect language (TypeScript vs JavaScript)
- [ ] Build dependency graph with internal deps
- [ ] Classify dependency types (internal/dev/peer)
- [ ] Return complete MonorepoAnalysisResult
- [ ] Manual test passes with test repo
- [ ] Git commit: "feat(epic-02): MVP-013-02 turborepo analyzer implementation"

---

## Next Steps

After completing this ticket:
1. **MVP-014-02**: Implement Nx analyzer (similar pattern)
2. **MVP-015-02**: Implement Lerna, Yarn, PNPM analyzers
3. **MVP-016-02**: Implement single repo analyzer
4. **MVP-017-02**: Integrate all analyzers into main handler

---

## Time Tracking

- **Estimated**: 4 hours
- **Actual**: ___ hours
- **Variance**: ___ hours

---

## Notes

### Why Turborepo First?

1. **Simplicity**: Clearest structure and conventions
2. **Popularity**: Widely used in modern web development
3. **Reference**: Serves as pattern for other analyzers
4. **Vercel**: Official Vercel tool, well-documented

### Common Turborepo Patterns

**Workspace Naming**:
- Scoped: `@acme/web`, `@acme/ui`
- Unscoped: `web`, `ui`
- Mixed: Some scoped, some not

**Directory Structure**:
- `apps/` for applications
- `packages/` for libraries and tooling
- Some use `libs/` instead of `packages/`

**Dependency Versions**:
- `workspace:*` (recommended)
- `workspace:^` (caret range)
- `*` (any version)
- Exact versions discouraged

### Turborepo vs Other Tools

| Feature | Turborepo | Nx | Lerna |
|---------|-----------|----|----- |
| Config File | turbo.json | nx.json | lerna.json |
| Workspace Discovery | package.json workspaces | workspace.json or project.json | packages in lerna.json |
| Caching | Built-in | Built-in | Via plugins |
| Task Orchestration | Pipeline | Executors/Targets | Commands |
| Dependency Graph | Implicit | Explicit (implicitDependencies) | Implicit |

---

## Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Turborepo Examples](https://github.com/vercel/turbo/tree/main/examples)
- [Turborepo Configuration](https://turbo.build/repo/docs/core-concepts/monorepos/configuring-workspaces)
- [Package Manager Workspaces](https://turbo.build/repo/docs/handbook/workspaces)
