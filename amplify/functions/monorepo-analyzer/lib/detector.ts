import fs from 'fs/promises';
import path from 'path';

/**
 * Monorepo types supported by SpecForge.
 * null represents a single (non-monorepo) repository.
 */
export type MonorepoType = 'turborepo' | 'nx' | 'lerna' | 'yarn_workspaces' | 'pnpm' | null;

/**
 * Indicator pattern for detecting a specific monorepo type.
 */
interface MonorepoIndicator {
  type: MonorepoType;
  files: string[];
  packageJsonField?: string;
}

/**
 * Detection rules for all supported monorepo types.
 * Order matters: checked sequentially, first match wins.
 *
 * Detection Strategy:
 * 1. Check for unique config files (turbo.json, nx.json, lerna.json, pnpm-workspace.yaml)
 * 2. For Yarn Workspaces: Check yarn.lock + workspaces field in package.json
 * 3. Return null if no indicators found (single repo)
 */
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

/**
 * Detect the monorepo type of a repository.
 *
 * Detection Logic:
 * - Checks for presence of monorepo-specific config files
 * - For Yarn Workspaces, also validates package.json has workspaces field
 * - Returns null if no monorepo indicators found (single repo)
 *
 * Order of Detection:
 * 1. Turborepo (turbo.json)
 * 2. Nx (nx.json or workspace.json)
 * 3. Lerna (lerna.json)
 * 4. Yarn Workspaces (yarn.lock + workspaces field)
 * 5. PNPM (pnpm-workspace.yaml or pnpm-lock.yaml)
 *
 * @param repoPath - Absolute path to cloned repository
 * @returns MonorepoType or null for single repo
 *
 * @example
 * const type = await detectMonorepoType('/tmp/repos/repo-123');
 * // Returns: 'turborepo' | 'nx' | 'lerna' | 'yarn_workspaces' | 'pnpm' | null
 */
export async function detectMonorepoType(repoPath: string): Promise<MonorepoType> {
  console.log(`Detecting monorepo type in: ${repoPath}`);

  for (const indicator of MONOREPO_INDICATORS) {
    // Check for indicator files
    for (const file of indicator.files) {
      const filePath = path.join(repoPath, file);

      try {
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          console.log(`Found indicator file: ${file}`);

          // For Yarn Workspaces, additional validation required
          if (indicator.packageJsonField) {
            const hasField = await checkPackageJsonField(
              repoPath,
              indicator.packageJsonField
            );

            if (hasField) {
              console.log(`Detected monorepo type: ${indicator.type}`);
              return indicator.type;
            } else {
              console.log(`Found ${file} but missing ${indicator.packageJsonField} field in package.json`);
              continue;
            }
          }

          // Direct file-based detection (Turborepo, Nx, Lerna, PNPM)
          console.log(`Detected monorepo type: ${indicator.type}`);
          return indicator.type;
        }
      } catch (error) {
        // File doesn't exist, continue to next indicator
        continue;
      }
    }
  }

  console.log('No monorepo indicators found');
  return null;
}

/**
 * Check if package.json contains a specific field.
 * Used for Yarn Workspaces detection.
 *
 * @param repoPath - Absolute path to repository
 * @param fieldName - Field name to check for (e.g., 'workspaces')
 * @returns true if field exists and is non-empty
 */
async function checkPackageJsonField(
  repoPath: string,
  fieldName: string
): Promise<boolean> {
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Check if field exists and is non-empty
    const fieldValue = packageJson[fieldName];

    if (!fieldValue) {
      return false;
    }

    // For workspaces field, ensure it's an array with at least one pattern
    if (Array.isArray(fieldValue)) {
      return fieldValue.length > 0;
    }

    // For object format: { "packages": ["packages/*"] }
    if (typeof fieldValue === 'object' && fieldValue.packages) {
      return Array.isArray(fieldValue.packages) && fieldValue.packages.length > 0;
    }

    return false;
  } catch (error) {
    console.error(`Error reading package.json: ${error}`);
    return false;
  }
}

/**
 * Get all supported monorepo types.
 * Useful for validation and UI display.
 *
 * @returns Array of supported monorepo type strings
 */
export function getSupportedMonorepoTypes(): Array<Exclude<MonorepoType, null>> {
  return MONOREPO_INDICATORS.map(indicator => indicator.type).filter(
    (type): type is Exclude<MonorepoType, null> => type !== null
  );
}

/**
 * Check if a given string is a valid monorepo type.
 *
 * @param type - String to validate
 * @returns true if valid monorepo type
 */
export function isValidMonorepoType(type: any): type is Exclude<MonorepoType, null> {
  return getSupportedMonorepoTypes().includes(type);
}

/**
 * Get indicator files for a specific monorepo type.
 * Useful for debugging and documentation.
 *
 * @param type - Monorepo type
 * @returns Array of indicator file names
 */
export function getIndicatorFiles(type: Exclude<MonorepoType, null>): string[] {
  const indicator = MONOREPO_INDICATORS.find(ind => ind.type === type);
  return indicator ? indicator.files : [];
}
