import fs from 'fs/promises';
import path from 'path';
import { MonorepoAnalysisResult } from './analyzers/index';

/**
 * Analyze a single (non-monorepo) repository.
 *
 * Process:
 * 1. Read root package.json
 * 2. Detect framework from dependencies
 * 3. Detect language (TypeScript vs JavaScript)
 * 4. Create single workspace with type 'single'
 * 5. Return minimal analysis result (no MonorepoStructure, no dependencies)
 *
 * Single Repo Structure:
 * - package.json at root
 * - No monorepo configuration files
 * - Represents entire repo as one workspace
 *
 * @param repositoryId - Repository ID (for logging)
 * @param repoPath - Absolute path to cloned repository
 * @returns MonorepoAnalysisResult with single workspace
 *
 * @throws Error if package.json missing/invalid
 */
export async function analyzeSingleRepo(
  _repositoryId: string,
  repoPath: string
): Promise<MonorepoAnalysisResult> {
  console.log('Analyzing single repository structure');

  // Read root package.json
  const packageJsonPath = path.join(repoPath, 'package.json');

  let packageJson: any;
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(packageJsonContent);
  } catch (error) {
    console.warn('No package.json found, creating minimal workspace');
    packageJson = {
      name: 'untitled',
      version: '0.0.0',
    };
  }

  console.log(`Repository name: ${packageJson.name || 'untitled'}`);

  // Detect framework and language
  const framework = detectFramework(packageJson);
  const language = detectLanguage(packageJson);

  console.log(`Framework: ${framework || 'none'}, Language: ${language}`);

  // Create single workspace
  const workspace = {
    name: packageJson.name || 'untitled',
    path: '.', // Root directory
    type: 'single' as const,
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
      dependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length,
    },
  };

  // Single repos have no MonorepoStructure or internal dependencies
  return {
    structure: {
      type: 'single',
      workspaceCount: 1,
      rootConfig: null, // No monorepo config
      dependencyGraph: {
        nodes: [
          {
            id: workspace.name,
            type: 'single',
            path: '.',
            framework: workspace.framework,
          },
        ],
        edges: [], // No internal dependencies
      },
    },
    workspaces: [workspace],
    dependencies: [], // No internal dependencies in single repos
  };
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
