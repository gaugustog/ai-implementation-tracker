# MVP-012-02: Monorepo Type Detector

**Epic**: Epic-02 - Repository Analysis & Workspace Discovery  
**Ticket**: MVP-012-02  
**Estimated Time**: 2 hours  
**Priority**: High (Foundation for all analyzers)  
**Status**: Todo

---

## Objective

Implement monorepo type detection logic that identifies which monorepo framework (if any) is used in a repository. This is the **foundational decision point** that determines which analyzer to invoke in the analysis pipeline.

---

## Context

The detector is the **first critical step** in repository analysis. It determines:
1. **Is this a monorepo?** (Yes → create MonorepoStructure + multiple Workspaces)
2. **If yes, which type?** (Turborepo, Nx, Lerna, Yarn Workspaces, PNPM)
3. **If no** → Single repository (1 Workspace only, no MonorepoStructure)

**Analysis Flow**:
```
Repository
    ↓
detectMonorepoType(repoPath)
    ↓
    ├─→ 'turborepo' → analyzeTurborepo()
    ├─→ 'nx' → analyzeNx()
    ├─→ 'lerna' → analyzeLerna()
    ├─→ 'yarn_workspaces' → analyzeYarnWorkspaces()
    ├─→ 'pnpm' → analyzePnpm()
    └─→ null → analyzeSingleRepo()
```

**Detection Strategy**: File-based detection with optional package.json field validation. Each monorepo type has unique "indicator files" that definitively identify it.

---

## Implementation Details

### File to Create

**File**: `amplify/functions/monorepo-analyzer/lib/detector.ts`

### Complete Implementation

```typescript
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
export function getSupportedMonorepoTypes(): string[] {
  return MONOREPO_INDICATORS.map(indicator => indicator.type).filter(
    (type): type is string => type !== null
  );
}

/**
 * Check if a given string is a valid monorepo type.
 * 
 * @param type - String to validate
 * @returns true if valid monorepo type
 */
export function isValidMonorepoType(type: string): type is Exclude<MonorepoType, null> {
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
```

---

## Detection Rules Explained

### 1. **Turborepo**
**Indicator**: `turbo.json`

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

**Why it works**: Turborepo is the only tool that uses `turbo.json`. Its presence is definitive.

---

### 2. **Nx**
**Indicators**: `nx.json` OR `workspace.json`

```json
// nx.json
{
  "npmScope": "myorg",
  "affected": {
    "defaultBase": "main"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default"
    }
  }
}
```

**Why it works**: 
- `nx.json` is required in all Nx workspaces
- `workspace.json` exists in older Nx versions (pre-13)
- Nx 13+ uses `project.json` per project, but still requires `nx.json` at root

---

### 3. **Lerna**
**Indicator**: `lerna.json`

```json
// lerna.json
{
  "version": "independent",
  "npmClient": "yarn",
  "useWorkspaces": true,
  "packages": [
    "packages/*"
  ]
}
```

**Why it works**: Lerna requires `lerna.json` for configuration. Its presence is definitive.

---

### 4. **Yarn Workspaces**
**Indicators**: `yarn.lock` AND `workspaces` field in `package.json`

```json
// package.json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Why two indicators?**:
- `yarn.lock` alone doesn't mean it's a monorepo (could be single repo using Yarn)
- `workspaces` field alone doesn't mean Yarn is used (could be npm workspaces)
- Both together = definitive Yarn Workspaces monorepo

**Alternative format**:
```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "nohoist": ["**/react-native"]
  }
}
```

---

### 5. **PNPM**
**Indicators**: `pnpm-workspace.yaml` OR `pnpm-lock.yaml`

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
```

**Why it works**:
- `pnpm-workspace.yaml` is required for PNPM workspaces
- `pnpm-lock.yaml` indicates PNPM is used (can infer workspace from package.json)
- Either file is sufficient for detection

---

## Detection Logic Flow

```typescript
// Handler calls detector
const monorepoType = await detectMonorepoType('/tmp/repos/repo-123');

// Branch based on result
if (monorepoType === 'turborepo') {
  // Create MonorepoStructure with type='turborepo'
  // Analyze turbo.json, discover workspaces
  analysisResult = await analyzeTurborepo(repositoryId, repoPath);
  
} else if (monorepoType === 'nx') {
  // Create MonorepoStructure with type='nx'
  // Analyze nx.json, discover projects
  analysisResult = await analyzeNx(repositoryId, repoPath);
  
} else if (monorepoType === 'lerna') {
  // Create MonorepoStructure with type='lerna'
  // Analyze lerna.json, discover packages
  analysisResult = await analyzeLerna(repositoryId, repoPath);
  
} else if (monorepoType === 'yarn_workspaces') {
  // Create MonorepoStructure with type='yarn_workspaces'
  // Analyze package.json workspaces, discover packages
  analysisResult = await analyzeYarnWorkspaces(repositoryId, repoPath);
  
} else if (monorepoType === 'pnpm') {
  // Create MonorepoStructure with type='pnpm'
  // Analyze pnpm-workspace.yaml, discover packages
  analysisResult = await analyzePnpm(repositoryId, repoPath);
  
} else {
  // null = single repository
  // Create single Workspace (no MonorepoStructure)
  analysisResult = await analyzeSingleRepo(repositoryId, repoPath);
}
```

---

## Edge Cases & Special Handling

### Case 1: **Multiple Monorepo Types in Same Repo**

Some repos use multiple tools (e.g., Nx + Lerna, Turborepo + PNPM).

**Solution**: Order matters! Detection stops at first match:
1. Turborepo (most specific)
2. Nx (most specific)
3. Lerna (can coexist with Yarn/PNPM)
4. Yarn Workspaces (package manager)
5. PNPM (package manager)

**Example**: Repo with `turbo.json` + `pnpm-workspace.yaml`
- Detected as: `'turborepo'` (checked first)
- PNPM is just the package manager, Turborepo is the build orchestrator

---

### Case 2: **Yarn Lock Without Workspaces**

Single repo using Yarn (not a monorepo).

**Example**:
```json
// package.json
{
  "name": "single-app",
  "version": "1.0.0"
  // No workspaces field
}
```

**Detection Result**: `null` (single repo)
- `yarn.lock` exists but `workspaces` field missing
- Falls through to null (single repo)

---

### Case 3: **NPM Workspaces**

NPM 7+ supports workspaces natively.

**Example**:
```json
// package.json
{
  "name": "my-monorepo",
  "workspaces": ["packages/*"]
}
```

**Current Behavior**: Detected as `null` (single repo)
- No `yarn.lock` file
- Falls through detection rules

**Future Enhancement**: Add `npm_workspaces` type
```typescript
{
  type: 'npm_workspaces',
  files: ['package-lock.json'],
  packageJsonField: 'workspaces',
}
```

---

### Case 4: **Missing Config Files**

Malformed or incomplete monorepo setup.

**Example**: Turborepo without `turbo.json` (deleted or gitignored)

**Detection Result**: Falls through to next indicator or null
- If no other indicators found → `null` (single repo)
- Will fail during analysis phase (expected)
- Error handling in analyzers should catch this

---

### Case 5: **Empty Repository**

No package.json or config files.

**Detection Result**: `null` (single repo)
- No indicators found
- Single repo analyzer handles gracefully (creates default workspace)

---

## Testing Strategy

### Unit Tests

```typescript
// Example test structure (not implemented in this ticket)
describe('detectMonorepoType', () => {
  it('detects Turborepo from turbo.json', async () => {
    const repoPath = await createTestRepo({
      'turbo.json': '{"pipeline":{}}',
      'package.json': '{"name":"test"}',
    });
    
    const type = await detectMonorepoType(repoPath);
    expect(type).toBe('turborepo');
  });
  
  it('detects Nx from nx.json', async () => {
    const repoPath = await createTestRepo({
      'nx.json': '{"npmScope":"test"}',
      'package.json': '{"name":"test"}',
    });
    
    const type = await detectMonorepoType(repoPath);
    expect(type).toBe('nx');
  });
  
  it('detects Yarn Workspaces from yarn.lock + workspaces', async () => {
    const repoPath = await createTestRepo({
      'yarn.lock': '# Yarn lockfile',
      'package.json': '{"workspaces":["packages/*"]}',
    });
    
    const type = await detectMonorepoType(repoPath);
    expect(type).toBe('yarn_workspaces');
  });
  
  it('returns null for single repo', async () => {
    const repoPath = await createTestRepo({
      'package.json': '{"name":"single-app"}',
    });
    
    const type = await detectMonorepoType(repoPath);
    expect(type).toBeNull();
  });
  
  it('returns null for Yarn lock without workspaces', async () => {
    const repoPath = await createTestRepo({
      'yarn.lock': '# Yarn lockfile',
      'package.json': '{"name":"single-app"}',
    });
    
    const type = await detectMonorepoType(repoPath);
    expect(type).toBeNull();
  });
});
```

---

## Usage Examples

### In Handler (MVP-017-02)

```typescript
import { detectMonorepoType } from './lib/detector';
import { analyzeMonorepo } from './lib/analyzers/index';
import { analyzeSingleRepo } from './lib/single-repo-analyzer';

// After cloning repository
const repoPath = await gitClient.cloneOrPull(repository, credentials);

// Detect type
const monorepoType = await detectMonorepoType(repoPath);

// Branch logic
let analysisResult;

if (monorepoType) {
  console.log(`Detected monorepo type: ${monorepoType}`);
  
  // Will create MonorepoStructure + multiple Workspaces
  analysisResult = await analyzeMonorepo(repositoryId, repoPath, monorepoType);
  
  // Update repository
  await appsyncClient.updateRepository(repositoryId, {
    isMonorepo: true,
    monorepoType: monorepoType,
    status: 'ready',
  });
  
} else {
  console.log('Single repository detected');
  
  // Will create single Workspace (no MonorepoStructure)
  analysisResult = await analyzeSingleRepo(repositoryId, repoPath);
  
  // Update repository
  await appsyncClient.updateRepository(repositoryId, {
    isMonorepo: false,
    monorepoType: null,
    status: 'ready',
  });
}
```

---

### Validation Example

```typescript
import { 
  detectMonorepoType, 
  isValidMonorepoType, 
  getSupportedMonorepoTypes 
} from './lib/detector';

// Get supported types for UI dropdown
const supportedTypes = getSupportedMonorepoTypes();
// Returns: ['turborepo', 'nx', 'lerna', 'yarn_workspaces', 'pnpm']

// Validate user input
const userType = 'turborepo';
if (isValidMonorepoType(userType)) {
  console.log('Valid monorepo type');
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Detect Turborepo from `turbo.json`
- ✅ Detect Nx from `nx.json` or `workspace.json`
- ✅ Detect Lerna from `lerna.json`
- ✅ Detect Yarn Workspaces from `yarn.lock` + workspaces field
- ✅ Detect PNPM from `pnpm-workspace.yaml` or `pnpm-lock.yaml`
- ✅ Return `null` for single repositories
- ✅ Return `null` when Yarn lock exists without workspaces field
- ✅ Handle missing files gracefully (no crashes)
- ✅ Log detection steps for debugging

### Type Safety Requirements
- ✅ Export `MonorepoType` type with all supported values + null
- ✅ Type guard function `isValidMonorepoType()`
- ✅ Helper function `getSupportedMonorepoTypes()`
- ✅ Helper function `getIndicatorFiles()`

### Error Handling Requirements
- ✅ Handle missing package.json gracefully
- ✅ Handle malformed JSON in package.json
- ✅ Handle file system errors (permissions, etc.)
- ✅ Continue checking other indicators on error

---

## Testing Instructions

### 1. Create the File

```bash
# Create file
mkdir -p amplify/functions/monorepo-analyzer/lib
# Copy implementation to detector.ts
```

### 2. Verify TypeScript Compilation

```bash
cd amplify/functions/monorepo-analyzer
npm run typecheck
```

**Expected**: No compilation errors

### 3. Manual Test (Create Test Repos)

Create test directories with different monorepo indicators:

```bash
# Test Turborepo detection
mkdir -p /tmp/test-turborepo
echo '{"pipeline":{}}' > /tmp/test-turborepo/turbo.json
echo '{"name":"test"}' > /tmp/test-turborepo/package.json

# Test Nx detection
mkdir -p /tmp/test-nx
echo '{"npmScope":"test"}' > /tmp/test-nx/nx.json
echo '{"name":"test"}' > /tmp/test-nx/package.json

# Test Yarn Workspaces detection
mkdir -p /tmp/test-yarn
touch /tmp/test-yarn/yarn.lock
echo '{"workspaces":["packages/*"]}' > /tmp/test-yarn/package.json

# Test single repo
mkdir -p /tmp/test-single
echo '{"name":"single-app"}' > /tmp/test-single/package.json
```

### 4. Test Script (Optional)

Create `amplify/functions/monorepo-analyzer/lib/__tests__/test-detector.ts`:

```typescript
import { detectMonorepoType } from '../detector';

async function testDetection() {
  console.log('Testing Turborepo...');
  const turborepo = await detectMonorepoType('/tmp/test-turborepo');
  console.log(`Result: ${turborepo} (expected: turborepo)\n`);
  
  console.log('Testing Nx...');
  const nx = await detectMonorepoType('/tmp/test-nx');
  console.log(`Result: ${nx} (expected: nx)\n`);
  
  console.log('Testing Yarn Workspaces...');
  const yarn = await detectMonorepoType('/tmp/test-yarn');
  console.log(`Result: ${yarn} (expected: yarn_workspaces)\n`);
  
  console.log('Testing Single Repo...');
  const single = await detectMonorepoType('/tmp/test-single');
  console.log(`Result: ${single} (expected: null)\n`);
}

testDetection().catch(console.error);
```

Run: `tsx lib/__tests__/test-detector.ts`

### 5. Integration Test (After MVP-017-02)

Will be tested when integrated into handler:
```bash
# Deploy Lambda
npx ampx sandbox

# Trigger analyzeRepository on different repo types
# Verify correct monorepo type detected in logs
```

---

## Environment Variables Required

**None** - This module has no external dependencies. It only reads files from the file system.

---

## Dependencies

### NPM Packages (Already in package.json from MVP-009-02)
- `fs/promises` (Node.js built-in)
- `path` (Node.js built-in)

### Code Dependencies
- **Depends On**: MVP-009-02 (Lambda setup complete)
- **Blocks**: MVP-013-02, MVP-014-02, MVP-015-02, MVP-016-02 (All analyzers need detector)
- **Used By**: MVP-017-02 (Handler calls detectMonorepoType)

---

## Performance Considerations

### Current Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Single detection | 5-20ms | 5 file checks + 1 JSON parse |
| Large repo | 5-20ms | Same (only root files checked) |

**Why so fast?**
- Only checks root directory files (no recursion)
- Stops at first match (early exit)
- Minimal file I/O (at most 6 file stat calls)

### Optimization Techniques

1. **Order matters**: Most common types first
   - Current order works well for typical repos
   
2. **Parallel checks**: Could check all files simultaneously
   ```typescript
   // Future optimization
   const results = await Promise.allSettled(
     MONOREPO_INDICATORS.flatMap(ind => 
       ind.files.map(file => fs.stat(path.join(repoPath, file)))
     )
   );
   ```

3. **Caching**: No caching needed (called once per analysis)

---

## Security Considerations

### 1. **Path Traversal Prevention**

```typescript
// Always use path.join to prevent directory traversal
const filePath = path.join(repoPath, file);

// NEVER do this:
// const filePath = repoPath + '/' + file; // Vulnerable to ../../../etc/passwd
```

### 2. **JSON Parsing Safety**

```typescript
try {
  const packageJson = JSON.parse(packageJsonContent);
} catch (error) {
  // Handle malformed JSON gracefully
  console.error(`Error reading package.json: ${error}`);
  return false;
}
```

### 3. **File System Access**

- Only reads files (no writes)
- Only accesses files within repoPath
- Handles permission errors gracefully

---

## Troubleshooting Guide

### Issue: Detection Returns Null for Known Monorepo
**Symptoms**: Repo is Turborepo but detected as single repo

**Solution**:
1. Check if indicator file exists in root: `ls -la /tmp/repos/repo-123/turbo.json`
2. Verify file is not gitignored: `git check-ignore turbo.json`
3. Check Lambda logs for file system errors
4. Ensure file has correct permissions (Lambda can read)

**Debug**:
```typescript
// Add logging
console.log('Checking:', filePath);
console.log('Exists:', await fs.stat(filePath));
```

---

### Issue: Yarn Repo Detected as Single Repo
**Symptoms**: Repo has yarn.lock but detected as null

**Solution**:
1. Verify `workspaces` field exists in package.json
2. Check field format (array vs object)
3. Ensure workspaces array not empty

**Debug**:
```typescript
// Check package.json content
const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
console.log('Workspaces:', pkg.workspaces);
```

---

### Issue: Wrong Type Detected
**Symptoms**: Nx repo detected as Turborepo

**Solution**:
- Check indicator order in MONOREPO_INDICATORS
- Ensure more specific types checked first
- Verify no stale config files (e.g., leftover turbo.json)

---

### Issue: TypeScript Error "Type is not assignable"
**Symptoms**: `MonorepoType` not compatible with string

**Solution**:
```typescript
// Use type guard
if (isValidMonorepoType(userInput)) {
  const type: MonorepoType = userInput; // Now safe
}

// Or explicit cast (less safe)
const type = userInput as MonorepoType;
```

---

## File Size Reference

**File**: `amplify/functions/monorepo-analyzer/lib/detector.ts`  
**Lines**: ~230  
**Size**: ~9 KB

---

## Related Files

- **Used By**: 
  - `handler.ts` (MVP-017-02) - Main detection call
  - `analyzers/index.ts` (MVP-013-02) - Branches to correct analyzer
  
- **Parallel To**: 
  - `git-client.ts` (MVP-010-02) - File system operations
  - `appsync-client.ts` (MVP-011-02) - Data persistence

---

## Future Enhancements

### 1. **NPM Workspaces Support**

```typescript
{
  type: 'npm_workspaces',
  files: ['package-lock.json'],
  packageJsonField: 'workspaces',
}
```

**Complexity**: Low (same pattern as Yarn)  
**Value**: Medium (growing adoption)

---

### 2. **Rush Support**

```typescript
{
  type: 'rush',
  files: ['rush.json'],
}
```

**Complexity**: Low (file-based detection)  
**Value**: Low (niche tool)

---

### 3. **Bazel Support**

```typescript
{
  type: 'bazel',
  files: ['WORKSPACE', 'BUILD.bazel'],
}
```

**Complexity**: High (complex build system)  
**Value**: Medium (large orgs use Bazel)

---

### 4. **Confidence Scores**

Return detection confidence instead of boolean:

```typescript
interface DetectionResult {
  type: MonorepoType;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

// High confidence: unique config file exists (turbo.json)
// Medium confidence: common file + field check (yarn.lock + workspaces)
// Low confidence: inference from patterns
```

**Complexity**: Medium  
**Value**: High (helps debug ambiguous cases)

---

### 5. **Parallel Detection**

Check all indicators simultaneously:

```typescript
const checks = MONOREPO_INDICATORS.map(async indicator => {
  const results = await Promise.allSettled(
    indicator.files.map(file => fs.stat(path.join(repoPath, file)))
  );
  
  if (results.some(r => r.status === 'fulfilled')) {
    return indicator.type;
  }
  
  return null;
});

const types = (await Promise.all(checks)).filter(Boolean);
return types[0]; // First match
```

**Complexity**: Low  
**Value**: Low (current perf is fine, ~20ms)

---

## Validation Checklist

Before marking this ticket complete:

- [ ] File created: `amplify/functions/monorepo-analyzer/lib/detector.ts`
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] All JSDoc comments present
- [ ] Export `MonorepoType` type
- [ ] Export `detectMonorepoType` function
- [ ] Export `isValidMonorepoType` helper
- [ ] Export `getSupportedMonorepoTypes` helper
- [ ] Export `getIndicatorFiles` helper
- [ ] Detection order is correct (Turborepo → Nx → Lerna → Yarn → PNPM)
- [ ] Yarn Workspaces requires both yarn.lock AND workspaces field
- [ ] Returns null for single repositories
- [ ] Handles missing files gracefully
- [ ] Handles malformed package.json gracefully
- [ ] Logs detection steps for debugging
- [ ] Git commit: "feat(epic-02): MVP-012-02 monorepo type detector"

---

## Next Steps

After completing this ticket:
1. **MVP-013-02**: Implement Turborepo analyzer (uses detector)
2. **MVP-014-02**: Implement Nx analyzer (uses detector)
3. **MVP-015-02**: Implement Lerna, Yarn, PNPM analyzers (use detector)
4. **MVP-016-02**: Implement single repo analyzer (called when detector returns null)
5. **MVP-017-02**: Integrate detector into main handler

---

## Time Tracking

- **Estimated**: 2 hours
- **Actual**: ___ hours
- **Variance**: ___ hours

---

## Notes

### Why Not Use package.json "monorepo" Field?

There's no standard "monorepo" field in package.json. Each tool has its own conventions:
- Turborepo: `turbo.json`
- Nx: `nx.json`
- Lerna: `lerna.json`
- Yarn: `workspaces` field
- PNPM: `pnpm-workspace.yaml`

File-based detection is more reliable than trying to infer from package.json.

---

### Why Check Files Instead of Running Commands?

**Commands approach** (not used):
```bash
# Would be unreliable
turbo --version  # Not installed in Lambda
nx --version     # Not installed in Lambda
```

**Problems**:
- Tools not installed in Lambda environment
- Requires installing all tools (bloated deployment)
- Slow (spawning processes)
- Can't detect if tools not in PATH

**File-based approach** (used):
- Fast (5-20ms)
- Reliable (config files always present)
- No external dependencies
- Works offline

---

### Why Return Null Instead of 'single'?

```typescript
// Current approach
type MonorepoType = 'turborepo' | 'nx' | ... | null;

// Alternative (not used)
type MonorepoType = 'turborepo' | 'nx' | ... | 'single';
```

**Reason**: `null` is semantically clearer
- `null` = "no monorepo type detected"
- `'single'` would be treated as another monorepo type
- Makes branching logic cleaner: `if (monorepoType) { ... }`

---

## Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Nx Workspace Structure](https://nx.dev/concepts/more-concepts/folder-structure)
- [Lerna Configuration](https://lerna.js.org/docs/configuration)
- [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)
- [PNPM Workspaces](https://pnpm.io/workspaces)
