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
  _repositoryId: string,
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
