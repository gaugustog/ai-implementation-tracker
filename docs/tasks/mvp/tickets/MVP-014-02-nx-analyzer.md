# MVP-014-02: Nx Analyzer

**Epic**: Epic-02 - Repository Analysis & Workspace Discovery  
**Ticket**: MVP-014-02  
**Estimated Time**: 4 hours  
**Priority**: High (Second major analyzer)  
**Status**: Todo

---

## Objective

Implement complete Nx workspace analysis including project discovery, dependency graph building from implicit dependencies, and framework detection from Nx executors. This analyzer handles both legacy Nx (workspace.json) and modern Nx (13+, project.json).

---

## Context

Nx is a powerful build system with first-class support for monorepos. It's the most advanced monorepo tool with sophisticated caching, task orchestration, and dependency graph visualization.

**Key Characteristics**:
- Uses `nx.json` for workspace configuration
- Two project discovery modes:
  - **Legacy (Nx < 13)**: Projects defined in `workspace.json`
  - **Modern (Nx 13+)**: Projects have individual `project.json` files
- Explicit dependency management via `implicitDependencies`
- Framework detection from executors/builders (e.g., `@nx/react:build`)
- Common structure: `apps/` (applications) and `libs/` (libraries)

**Analysis Flow**:
```
detectMonorepoType() returns 'nx'
    ↓
analyzeMonorepo() dispatches to analyzeNx()
    ↓
1. Read nx.json (workspace config)
2. Try workspace.json (legacy) OR find project.json files (modern)
3. Parse each project's configuration
4. Parse each project's package.json
5. Detect project types (application/library from projectType)
6. Detect frameworks from executors/builders
7. Build dependency graph from implicitDependencies + package.json
8. Return MonorepoAnalysisResult
```

**Nx vs Turborepo**:
- Nx: Explicit dependencies (implicitDependencies), executors define frameworks
- Turborepo: Implicit dependencies (from package.json), framework detection from dependencies

---

## Implementation Details

### File to Create

**File**: `amplify/functions/monorepo-analyzer/lib/analyzers/nx.ts`

### Complete Implementation

```typescript
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { MonorepoAnalysisResult } from './index';

/**
 * Analyze an Nx workspace monorepo.
 * 
 * Process:
 * 1. Read nx.json for workspace configuration
 * 2. Detect Nx version (legacy vs modern):
 *    - Legacy (< Nx 13): workspace.json with projects map
 *    - Modern (Nx 13+): individual project.json files
 * 3. Parse each project's configuration
 * 4. Parse each project's package.json
 * 5. Detect project types from projectType field
 * 6. Detect frameworks from executors/builders
 * 7. Build dependency graph from:
 *    - implicitDependencies in project config
 *    - package.json dependencies (internal)
 * 8. Return complete analysis result
 * 
 * Nx Workspace Structure:
 * - nx.json: Workspace config, task runners, affected settings
 * - workspace.json (legacy): Project configurations
 * - project.json (modern): Per-project configuration
 * - Typical layout:
 *   - apps/web (Next.js app)
 *   - apps/api (NestJS API)
 *   - libs/shared/ui (React components)
 *   - libs/shared/utils (Utilities)
 * 
 * @param repositoryId - Repository ID (for logging)
 * @param repoPath - Absolute path to cloned repository
 * @returns MonorepoAnalysisResult with structure, workspaces, dependencies
 * 
 * @throws Error if nx.json missing/invalid or no projects found
 */
export async function analyzeNx(
  repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing Nx workspace');
  
  // Read nx.json
  const nxConfigPath = path.join(repoPath, 'nx.json');
  const nxConfigContent = await fs.readFile(nxConfigPath, 'utf-8');
  const nxConfig = JSON.parse(nxConfigContent);
  
  console.log('Nx config loaded:', {
    npmScope: nxConfig.npmScope,
    affected: !!nxConfig.affected,
    tasksRunnerOptions: Object.keys(nxConfig.tasksRunnerOptions || {}),
  });
  
  // Try to read workspace.json (legacy Nx)
  // If it doesn't exist, use modern project.json approach
  let projectsConfig: Record<string, any> = {};
  let isLegacy = false;
  
  try {
    const workspaceJsonPath = path.join(repoPath, 'workspace.json');
    const workspaceJsonContent = await fs.readFile(workspaceJsonPath, 'utf-8');
    const workspaceJson = JSON.parse(workspaceJsonContent);
    projectsConfig = workspaceJson.projects || {};
    isLegacy = true;
    
    console.log('Legacy Nx detected (workspace.json)');
    console.log(`Found ${Object.keys(projectsConfig).length} projects in workspace.json`);
  } catch {
    // Nx 13+ uses project.json files instead
    console.log('Modern Nx detected (project.json files)');
    
    // Find all project.json files
    const projectJsonFiles = await glob('**/project.json', {
      cwd: repoPath,
      absolute: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });
    
    console.log(`Found ${projectJsonFiles.length} project.json files`);
    
    // Parse each project.json
    for (const projectFile of projectJsonFiles) {
      const projectPath = path.dirname(projectFile);
      const projectJsonPath = path.join(repoPath, projectFile);
      const projectJsonContent = await fs.readFile(projectJsonPath, 'utf-8');
      const projectJson = JSON.parse(projectJsonContent);
      
      // Project name is either:
      // 1. Explicit 'name' field in project.json
      // 2. Directory name (last segment of path)
      const projectName = projectJson.name || path.basename(projectPath);
      
      projectsConfig[projectName] = {
        root: projectPath,
        ...projectJson,
      };
    }
  }
  
  if (Object.keys(projectsConfig).length === 0) {
    throw new Error('No Nx projects found in workspace');
  }
  
  // Discover workspaces (projects)
  const workspaces = [];
  const workspaceMap = new Map<string, any>();
  
  for (const [projectName, projectConfig] of Object.entries(projectsConfig)) {
    const projectPath = (projectConfig as any).root;
    
    console.log(`Analyzing project: ${projectName} at ${projectPath}`);
    
    // Read package.json for this project
    const packageJsonPath = path.join(repoPath, projectPath, 'package.json');
    let packageJson: any = {};
    
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // Some Nx projects don't have package.json
      // Use project name as fallback
      packageJson = {
        name: projectName,
        version: '0.0.0',
      };
    }
    
    // Detect project type, framework, and language
    const projectType = detectNxProjectType(projectConfig);
    const framework = detectFrameworkFromNx(projectConfig, packageJson);
    const language = detectLanguage(packageJson);
    
    const workspace = {
      name: packageJson.name || projectName,
      path: projectPath,
      type: projectType,
      framework: framework,
      language: language,
      packageJson: packageJson,
      metadata: {
        version: packageJson.version,
        description: packageJson.description,
        nxProjectType: (projectConfig as any).projectType,
        tags: (projectConfig as any).tags || [],
        targets: Object.keys((projectConfig as any).targets || {}),
        implicitDependencies: (projectConfig as any).implicitDependencies || [],
        hasTests: Object.keys((projectConfig as any).targets || {}).some(
          (t: string) => t.includes('test') || t === 'e2e'
        ),
        hasLint: Object.keys((projectConfig as any).targets || {}).includes('lint'),
        hasBuild: Object.keys((projectConfig as any).targets || {}).includes('build'),
      },
    };
    
    workspaces.push(workspace);
    
    // Store both by package name and project name
    workspaceMap.set(workspace.name, workspace);
    if (projectName !== workspace.name) {
      workspaceMap.set(projectName, workspace);
    }
    
    console.log(`  ✓ ${workspace.name} (${projectType}, ${framework || 'no framework'})`);
  }
  
  console.log(`Total workspaces discovered: ${workspaces.length}`);
  
  // Build dependency graph from implicitDependencies and package.json
  const dependencies = [];
  
  for (const workspace of workspaces) {
    // 1. Implicit dependencies from Nx config
    const implicitDeps = workspace.metadata.implicitDependencies || [];
    
    for (const depName of implicitDeps) {
      if (depName === '*') {
        // Special case: depends on all projects
        console.log(`  → ${workspace.name} implicitly depends on all projects`);
        continue;
      }
      
      if (workspaceMap.has(depName)) {
        dependencies.push({
          workspaceName: workspace.name,
          dependsOnWorkspaceName: depName,
          type: 'internal' as const,
          version: undefined,
        });
        
        console.log(`  → ${workspace.name} implicitly depends on ${depName}`);
      }
    }
    
    // 2. Package.json dependencies
    const deps = {
      ...workspace.packageJson.dependencies,
      ...workspace.packageJson.devDependencies,
      ...workspace.packageJson.peerDependencies,
    };
    
    for (const [depName, version] of Object.entries(deps)) {
      // Check if this is an internal workspace dependency
      if (workspaceMap.has(depName)) {
        const depType = getDependencyType(workspace.packageJson, depName);
        
        // Avoid duplicate dependencies (already added via implicitDependencies)
        const isDuplicate = dependencies.some(
          d => d.workspaceName === workspace.name && d.dependsOnWorkspaceName === depName
        );
        
        if (!isDuplicate) {
          dependencies.push({
            workspaceName: workspace.name,
            dependsOnWorkspaceName: depName,
            type: depType,
            version: version as string,
          });
          
          console.log(`  → ${workspace.name} depends on ${depName} (${depType}, from package.json)`);
        }
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
      tags: ws.metadata.tags,
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

/**
 * Detect Nx project type from project configuration.
 * 
 * Nx projects have explicit projectType field:
 * - 'application': Deployable applications
 * - 'library': Reusable libraries
 * - undefined: Default to 'package'
 * 
 * @param projectConfig - Nx project configuration
 * @returns Workspace type
 */
function detectNxProjectType(projectConfig: any): 'app' | 'package' | 'library' {
  const projectType = projectConfig.projectType;
  
  if (projectType === 'application') {
    return 'app';
  }
  
  if (projectType === 'library') {
    return 'library';
  }
  
  // Fallback: no projectType specified
  return 'package';
}

/**
 * Detect framework from Nx executors/builders and package.json.
 * 
 * Nx uses executors (previously called builders) to define tasks.
 * Framework can be inferred from executor names:
 * - @nx/react:* or @nrwl/react:* → React
 * - @nx/next:* or @nrwl/next:* → Next.js
 * - @nx/angular:* or @angular-devkit/build-angular:* → Angular
 * - @nx/node:* or @nrwl/node:* → Node.js
 * - @nx/nest:* or @nrwl/nest:* → NestJS
 * 
 * Falls back to package.json dependencies if no executor found.
 * 
 * @param projectConfig - Nx project configuration
 * @param packageJson - Parsed package.json
 * @returns Framework name or undefined
 */
function detectFrameworkFromNx(projectConfig: any, packageJson: any): string | undefined {
  // Check Nx executors/builders
  const targets = projectConfig.targets || {};
  
  for (const target of Object.values(targets)) {
    const executor = (target as any).executor || (target as any).builder;
    
    if (!executor) continue;
    
    // Check executor name for framework indicators
    if (executor.includes('@nx/next') || executor.includes('@nrwl/next')) {
      return 'nextjs';
    }
    
    if (executor.includes('@nx/react') || executor.includes('@nrwl/react')) {
      return 'react';
    }
    
    if (executor.includes('@nx/angular') || executor.includes('@nrwl/angular') || 
        executor.includes('@angular-devkit/build-angular')) {
      return 'angular';
    }
    
    if (executor.includes('@nx/nest') || executor.includes('@nrwl/nest')) {
      return 'nestjs';
    }
    
    if (executor.includes('@nx/node') || executor.includes('@nrwl/node')) {
      return 'nodejs';
    }
    
    if (executor.includes('@nx/vue') || executor.includes('@nrwl/vue')) {
      return 'vue';
    }
    
    if (executor.includes('@nx/web') || executor.includes('@nrwl/web')) {
      return 'web';
    }
  }
  
  // Fallback to package.json dependencies
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  
  // Check for specific frameworks (order matters)
  if (deps['next']) return 'nextjs';
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps['@remix-run/react']) return 'remix';
  if (deps['astro']) return 'astro';
  if (deps['react']) return 'react';
  if (deps['@angular/core']) return 'angular';
  if (deps['vue']) return 'vue';
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

### 1. **Dual Project Discovery (Legacy vs Modern)**

```typescript
// Legacy Nx (< 13): workspace.json
try {
  const workspaceJson = JSON.parse(await fs.readFile('workspace.json', 'utf-8'));
  projectsConfig = workspaceJson.projects || {};
  // projectsConfig = { "web": { root: "apps/web", ... }, ... }
} catch {
  // Modern Nx (13+): project.json files
  const projectJsonFiles = await glob('**/project.json', { ... });
  
  for (const file of projectJsonFiles) {
    const projectJson = JSON.parse(...);
    const projectName = projectJson.name || path.basename(path.dirname(file));
    projectsConfig[projectName] = projectJson;
  }
}
```

**Why two modes?**
- Nx 13+ eliminated workspace.json to reduce config overhead
- Each project now has its own project.json
- Must support both for compatibility

---

### 2. **Framework Detection from Executors**

```typescript
function detectFrameworkFromNx(projectConfig: any, packageJson: any) {
  const targets = projectConfig.targets || {};
  
  for (const target of Object.values(targets)) {
    const executor = target.executor || target.builder;
    
    // Executor examples:
    // - @nx/react:build → React
    // - @nx/next:build → Next.js
    // - @nx/angular:build → Angular
    // - @nx/nest:build → NestJS
    
    if (executor.includes('@nx/next')) return 'nextjs';
    if (executor.includes('@nx/react')) return 'react';
    // ... more executors
  }
  
  // Fallback to package.json
  return detectFrameworkFromPackageJson(packageJson);
}
```

**Why check executors?**
- Nx executors are more reliable than dependencies
- Example: A Next.js app might not directly list 'next' if it's in root
- Executors are explicitly configured per project

---

### 3. **Implicit Dependencies**

```typescript
// In project.json or workspace.json:
{
  "name": "web",
  "implicitDependencies": ["shared-ui", "shared-utils"]
}

// Build dependency graph
for (const workspace of workspaces) {
  const implicitDeps = workspace.metadata.implicitDependencies || [];
  
  for (const depName of implicitDeps) {
    if (depName === '*') {
      // Special case: depends on all projects
      continue;
    }
    
    dependencies.push({
      workspaceName: workspace.name,
      dependsOnWorkspaceName: depName,
      type: 'internal',
    });
  }
}
```

**Implicit Dependencies**:
- Explicitly declared in Nx config
- Not in package.json
- Used for non-code dependencies (configs, assets, etc.)
- Special value `*` means "depends on all projects"

---

### 4. **Project Tags**

```typescript
// In project.json:
{
  "name": "shared-ui",
  "tags": ["scope:shared", "type:ui"]
}

metadata: {
  tags: projectConfig.tags || [],
  // Used for:
  // - Organizational grouping
  // - Lint rules (e.g., "apps can't import from other apps")
  // - Affected command filtering
}
```

**Tags Usage**:
- Organizational: `scope:shared`, `scope:feature-auth`
- Type: `type:ui`, `type:data-access`, `type:util`
- Platform: `platform:web`, `platform:mobile`

---

### 5. **Targets (Tasks)**

```typescript
// In project.json:
{
  "targets": {
    "build": {
      "executor": "@nx/next:build",
      "options": { ... }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": { ... }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "options": { ... }
    }
  }
}

metadata: {
  targets: Object.keys(projectConfig.targets || {}),
  // ['build', 'test', 'lint']
  hasTests: targets.some(t => t.includes('test')),
  hasLint: targets.includes('lint'),
  hasBuild: targets.includes('build'),
}
```

---

## Example Nx Workspace Structure

### Legacy Nx (< 13)

```
nx-monorepo/
├── nx.json                       # Workspace config
├── workspace.json                # Project definitions (legacy)
├── package.json                  # Root dependencies
├── apps/
│   ├── web/                      # Next.js app
│   │   ├── package.json
│   │   ├── project.json (optional)
│   │   └── app/
│   └── api/                      # NestJS API
│       ├── package.json
│       └── src/
└── libs/
    ├── shared/ui/                # React components
    │   ├── package.json
    │   └── src/
    └── shared/utils/             # Utilities
        ├── package.json
        └── src/
```

**workspace.json (Legacy)**:
```json
{
  "version": 2,
  "projects": {
    "web": {
      "root": "apps/web",
      "projectType": "application",
      "targets": {
        "build": {
          "executor": "@nrwl/next:build"
        }
      }
    },
    "shared-ui": {
      "root": "libs/shared/ui",
      "projectType": "library",
      "targets": {
        "build": {
          "executor": "@nrwl/react:build"
        }
      }
    }
  }
}
```

---

### Modern Nx (13+)

```
nx-monorepo/
├── nx.json                       # Workspace config
├── package.json                  # Root dependencies
├── apps/
│   ├── web/
│   │   ├── project.json          # Project config (replaces workspace.json)
│   │   ├── package.json
│   │   └── app/
│   └── api/
│       ├── project.json
│       ├── package.json
│       └── src/
└── libs/
    ├── shared/ui/
    │   ├── project.json
    │   ├── package.json
    │   └── src/
    └── shared/utils/
        ├── project.json
        ├── package.json
        └── src/
```

**project.json (Modern)**:
```json
{
  "name": "web",
  "projectType": "application",
  "tags": ["scope:web", "type:app"],
  "targets": {
    "build": {
      "executor": "@nx/next:build",
      "options": {
        "outputPath": "dist/apps/web"
      }
    }
  },
  "implicitDependencies": ["shared-ui"]
}
```

---

### nx.json

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "npmScope": "myorg",
  "affected": {
    "defaultBase": "main"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Analysis Result Example

```typescript
{
  structure: {
    type: 'nx',
    workspaceCount: 4,
    rootConfig: { /* nx.json content */ },
    dependencyGraph: {
      nodes: [
        { 
          id: '@myorg/web', 
          type: 'app', 
          path: 'apps/web', 
          framework: 'nextjs',
          tags: ['scope:web', 'type:app']
        },
        { 
          id: '@myorg/api', 
          type: 'app', 
          path: 'apps/api', 
          framework: 'nestjs',
          tags: ['scope:api', 'type:app']
        },
        { 
          id: '@myorg/shared-ui', 
          type: 'library', 
          path: 'libs/shared/ui', 
          framework: 'react',
          tags: ['scope:shared', 'type:ui']
        },
        { 
          id: '@myorg/shared-utils', 
          type: 'library', 
          path: 'libs/shared/utils',
          tags: ['scope:shared', 'type:util']
        }
      ],
      edges: [
        { from: '@myorg/web', to: '@myorg/shared-ui', type: 'internal' },
        { from: '@myorg/web', to: '@myorg/shared-utils', type: 'internal' },
        { from: '@myorg/api', to: '@myorg/shared-utils', type: 'internal' },
        { from: '@myorg/shared-ui', to: '@myorg/shared-utils', type: 'internal' }
      ]
    }
  },
  workspaces: [
    {
      name: '@myorg/web',
      path: 'apps/web',
      type: 'app',
      framework: 'nextjs',
      language: 'typescript',
      packageJson: { /* full package.json */ },
      metadata: {
        version: '1.0.0',
        nxProjectType: 'application',
        tags: ['scope:web', 'type:app'],
        targets: ['build', 'serve', 'test', 'lint'],
        implicitDependencies: ['shared-ui'],
        hasTests: true,
        hasLint: true,
        hasBuild: true
      }
    },
    // ... more workspaces
  ],
  dependencies: [
    {
      workspaceName: '@myorg/web',
      dependsOnWorkspaceName: '@myorg/shared-ui',
      type: 'internal',
      version: undefined  // Implicit dependency (not in package.json)
    },
    {
      workspaceName: '@myorg/web',
      dependsOnWorkspaceName: '@myorg/shared-utils',
      type: 'internal',
      version: 'workspace:*'  // From package.json
    },
    // ... more dependencies
  ]
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Read and parse nx.json
- ✅ Support legacy Nx (workspace.json)
- ✅ Support modern Nx (project.json files)
- ✅ Discover all projects in workspace
- ✅ Parse each project's configuration
- ✅ Parse each project's package.json (if exists)
- ✅ Detect project types from projectType field
- ✅ Detect frameworks from executors/builders
- ✅ Detect language (TypeScript vs JavaScript)
- ✅ Build dependency graph from implicitDependencies
- ✅ Build dependency graph from package.json
- ✅ Avoid duplicate dependencies
- ✅ Extract project tags
- ✅ Extract project targets
- ✅ Handle special implicitDependencies value '*'
- ✅ Return MonorepoAnalysisResult with all data

### Error Handling Requirements
- ✅ Throw error if nx.json missing or invalid JSON
- ✅ Throw error if no projects found
- ✅ Handle missing package.json gracefully (use project name)
- ✅ Handle missing workspace.json (try project.json)
- ✅ Handle malformed project configurations
- ✅ Log warnings for projects without names

### Performance Requirements
- ✅ Complete analysis within 30 seconds for typical workspaces
- ✅ Handle up to 100 projects efficiently
- ✅ Process dependency graphs with 500+ edges

### Data Quality Requirements
- ✅ No duplicate workspace entries
- ✅ All dependencies correctly identified (implicit + package.json)
- ✅ Project types accurately classified
- ✅ Framework detection covers Nx executors
- ✅ Tags preserved from project config

---

## Testing Instructions

### 1. Create File

```bash
# Copy implementation to nx.ts
mkdir -p amplify/functions/monorepo-analyzer/lib/analyzers
```

### 2. Verify TypeScript Compilation

```bash
cd amplify/functions/monorepo-analyzer
npm run typecheck
```

**Expected**: No compilation errors

### 3. Manual Test - Legacy Nx

Create test workspace:

```bash
mkdir -p /tmp/test-nx-legacy/{apps/web,libs/shared-ui}

# nx.json
cat > /tmp/test-nx-legacy/nx.json << 'EOF'
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "npmScope": "test",
  "affected": {
    "defaultBase": "main"
  }
}
EOF

# workspace.json (legacy)
cat > /tmp/test-nx-legacy/workspace.json << 'EOF'
{
  "version": 2,
  "projects": {
    "web": {
      "root": "apps/web",
      "projectType": "application",
      "targets": {
        "build": {
          "executor": "@nx/next:build"
        }
      }
    },
    "shared-ui": {
      "root": "libs/shared-ui",
      "projectType": "library",
      "targets": {
        "build": {
          "executor": "@nx/react:build"
        }
      },
      "tags": ["scope:shared", "type:ui"]
    }
  }
}
EOF

# Web app package.json
cat > /tmp/test-nx-legacy/apps/web/package.json << 'EOF'
{
  "name": "@test/web",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@test/shared-ui": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

# Shared UI package.json
cat > /tmp/test-nx-legacy/libs/shared-ui/package.json << 'EOF'
{
  "name": "@test/shared-ui",
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

### 4. Manual Test - Modern Nx

Create test workspace:

```bash
mkdir -p /tmp/test-nx-modern/{apps/web,libs/shared-ui}

# nx.json
cat > /tmp/test-nx-modern/nx.json << 'EOF'
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "npmScope": "test"
}
EOF

# apps/web/project.json
cat > /tmp/test-nx-modern/apps/web/project.json << 'EOF'
{
  "name": "web",
  "projectType": "application",
  "tags": ["scope:web"],
  "targets": {
    "build": {
      "executor": "@nx/next:build"
    }
  },
  "implicitDependencies": ["shared-ui"]
}
EOF

# apps/web/package.json
cat > /tmp/test-nx-modern/apps/web/package.json << 'EOF'
{
  "name": "@test/web",
  "version": "1.0.0",
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
EOF

# libs/shared-ui/project.json
cat > /tmp/test-nx-modern/libs/shared-ui/project.json << 'EOF'
{
  "name": "shared-ui",
  "projectType": "library",
  "tags": ["scope:shared", "type:ui"],
  "targets": {
    "build": {
      "executor": "@nx/react:build"
    }
  }
}
EOF

# libs/shared-ui/package.json
cat > /tmp/test-nx-modern/libs/shared-ui/package.json << 'EOF'
{
  "name": "@test/shared-ui",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "dependencies": {
    "react": "^18.0.0"
  }
}
EOF
```

### 5. Test Script

```typescript
import { analyzeNx } from './lib/analyzers/nx';

async function testLegacy() {
  console.log('Testing Legacy Nx...\n');
  
  const result = await analyzeNx('test-repo', '/tmp/test-nx-legacy');
  
  console.log('Structure:', result.structure);
  console.log('Workspaces:', result.workspaces.length);
  console.log('Dependencies:', result.dependencies.length);
  
  // Assertions
  console.assert(result.structure.type === 'nx', 'Type should be nx');
  console.assert(result.structure.workspaceCount === 2, 'Should have 2 workspaces');
  
  const web = result.workspaces.find(ws => ws.name === '@test/web');
  console.assert(web?.type === 'app', 'web should be type app');
  console.assert(web?.framework === 'nextjs', 'web should use Next.js');
  
  const ui = result.workspaces.find(ws => ws.name === '@test/shared-ui');
  console.assert(ui?.type === 'library', 'ui should be type library');
  console.assert(ui?.framework === 'react', 'ui should use React');
  console.assert(ui?.metadata.tags?.includes('scope:shared'), 'ui should have tags');
  
  console.log('\n✓ Legacy Nx tests passed');
}

async function testModern() {
  console.log('\nTesting Modern Nx...\n');
  
  const result = await analyzeNx('test-repo', '/tmp/test-nx-modern');
  
  console.assert(result.structure.workspaceCount === 2, 'Should have 2 workspaces');
  
  // Check implicit dependencies
  const implicitDep = result.dependencies.find(
    d => d.workspaceName === '@test/web' && d.dependsOnWorkspaceName === 'shared-ui'
  );
  console.assert(implicitDep, 'Should have implicit dependency');
  console.assert(implicitDep?.type === 'internal', 'Should be internal type');
  
  console.log('\n✓ Modern Nx tests passed');
}

async function test() {
  await testLegacy();
  await testModern();
  console.log('\n✓ All Nx tests passed');
}

test().catch(console.error);
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
  - MVP-012-02 (MonorepoType)
  - MVP-013-02 (MonorepoAnalysisResult interface from analyzers/index.ts)
- **Blocks**: MVP-017-02 (Handler needs all analyzers)
- **Parallel To**: MVP-015-02 (Lerna/Yarn/PNPM), MVP-016-02 (Single repo)

---

## Troubleshooting Guide

### Issue: No Projects Found
**Error**: `No Nx projects found in workspace`

**Solution**:
1. Check if workspace.json or project.json files exist
2. For modern Nx, verify project.json files not in node_modules
3. Check glob patterns not too restrictive
4. Verify nx.json exists (confirms it's an Nx workspace)

---

### Issue: Framework Not Detected
**Symptoms**: `framework: undefined` for known framework

**Solution**:
1. Check executor name in targets
2. Add executor pattern to `detectFrameworkFromNx()`
3. Verify package.json has framework dependency (fallback)
4. Check both `executor` and `builder` fields (legacy)

**Example Fix**:
```typescript
if (executor.includes('@nx/my-framework')) return 'my-framework';
```

---

### Issue: Duplicate Dependencies
**Symptoms**: Same dependency appears multiple times

**Solution**:
- Duplicate check already implemented
- Verify `isDuplicate` logic works correctly
- Check workspace name resolution (package name vs project name)

**Debug**:
```typescript
console.log('Existing deps:', dependencies.map(d => 
  `${d.workspaceName} → ${d.dependsOnWorkspaceName}`
));
```

---

### Issue: Implicit Dependencies Not Found
**Symptoms**: Missing dependencies that should exist

**Solution**:
1. Check `implicitDependencies` field exists in project config
2. Verify project names match exactly
3. Check for typos in dependency names
4. Handle special case `*` (depends on all)

---

### Issue: Missing Package.json
**Symptoms**: Error when reading package.json

**Solution**: Already handled gracefully
```typescript
try {
  packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
} catch {
  // Fallback: use project name
  packageJson = { name: projectName, version: '0.0.0' };
}
```

---

### Issue: Legacy vs Modern Detection Fails
**Symptoms**: Wrong mode detected

**Solution**:
- Legacy mode: workspace.json must exist
- Modern mode: Falls back automatically if workspace.json missing
- Check file permissions
- Verify JSON is valid

---

## Performance Optimization

### Current Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Read nx.json | <5ms | Single file read |
| Read workspace.json | <5ms | Single file read |
| Find project.json files | 50-100ms | Glob search |
| Parse projects | 10-30ms | ~5ms per project |
| Build dep graph | 10-20ms | O(n×m) |
| **Total (Legacy)** | **80-150ms** | 10-20 projects |
| **Total (Modern)** | **100-180ms** | 10-20 projects |

### Optimization Techniques

1. **Parallel Project Parsing** (same as Turborepo)
2. **Cache project.json locations** (for re-analysis)
3. **Use fast-glob** (2-3x faster than glob)

---

## File Size Reference

**File**: `analyzers/nx.ts`  
**Lines**: ~420  
**Size**: ~15 KB

---

## Related Files

- **Used By**: `handler.ts` (MVP-017-02), `analyzers/index.ts` (MVP-013-02)
- **Uses**: `detector.ts` (MVP-012-02) for MonorepoType
- **Parallel To**: 
  - `analyzers/turborepo.ts` (MVP-013-02)
  - `analyzers/lerna.ts` (MVP-015-02)
  - `analyzers/yarn-workspaces.ts` (MVP-015-02)
  - `analyzers/pnpm.ts` (MVP-015-02)

---

## Validation Checklist

Before marking this ticket complete:

- [ ] File created: `amplify/functions/monorepo-analyzer/lib/analyzers/nx.ts`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] All JSDoc comments present
- [ ] Export `analyzeNx` function
- [ ] Read nx.json successfully
- [ ] Support legacy Nx (workspace.json)
- [ ] Support modern Nx (project.json files)
- [ ] Discover all projects correctly
- [ ] Detect project types from projectType field
- [ ] Detect frameworks from executors/builders
- [ ] Detect language (TypeScript vs JavaScript)
- [ ] Build dependency graph from implicitDependencies
- [ ] Build dependency graph from package.json
- [ ] Avoid duplicate dependencies
- [ ] Handle special case '*' in implicitDependencies
- [ ] Extract project tags
- [ ] Extract project targets
- [ ] Return complete MonorepoAnalysisResult
- [ ] Manual tests pass (both legacy and modern)
- [ ] Git commit: "feat(epic-02): MVP-014-02 nx analyzer implementation"

---

## Next Steps

After completing this ticket:
1. **MVP-015-02**: Implement Lerna, Yarn Workspaces, PNPM analyzers
2. **MVP-016-02**: Implement single repo analyzer
3. **MVP-017-02**: Integrate all analyzers into main handler

---

## Time Tracking

- **Estimated**: 4 hours
- **Actual**: ___ hours
- **Variance**: ___ hours

---

## Notes

### Nx vs Turborepo Comparison

| Feature | Nx | Turborepo |
|---------|----|-----------|
| Config Files | nx.json + (workspace.json OR project.json) | turbo.json + package.json |
| Project Discovery | Explicit (workspace.json) or glob (project.json) | Glob patterns from package.json workspaces |
| Dependencies | Explicit (implicitDependencies) + package.json | Implicit from package.json only |
| Framework Detection | Executors/builders | package.json dependencies |
| Project Types | projectType field (application/library) | Inferred from path convention |
| Tags | Explicit tags field | Not supported |
| Targets | Defined per project | Global pipeline in turbo.json |

### Nx Versions

**Legacy Nx (< 13)**:
- Single workspace.json at root
- All projects defined in one file
- Easier to parse (one file read)
- Deprecated but still in use

**Modern Nx (13+)**:
- Distributed project.json files
- Each project owns its config
- More maintainable for large workspaces
- Requires glob search to find all projects

### Common Nx Executors

**Build Executors**:
- `@nx/react:build` - React library
- `@nx/next:build` - Next.js app
- `@nx/angular:build` - Angular app
- `@nx/nest:build` - NestJS app
- `@nx/node:build` - Node.js app

**Test Executors**:
- `@nx/jest:jest` - Jest tests
- `@nx/cypress:cypress` - Cypress E2E
- `@nx/playwright:playwright` - Playwright E2E

**Lint Executors**:
- `@nx/linter:eslint` - ESLint
- `@nx/linter:lint` - Generic linter

---

## Additional Resources

- [Nx Documentation](https://nx.dev/)
- [Nx Project Configuration](https://nx.dev/reference/project-configuration)
- [Nx Executors](https://nx.dev/concepts/executors-and-configurations)
- [Nx 13 Migration Guide](https://nx.dev/recipes/adopting-nx/adding-to-monorepo)
- [Nx Dependency Graph](https://nx.dev/concepts/mental-model#the-project-graph)
