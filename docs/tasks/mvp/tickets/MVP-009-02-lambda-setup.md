# MVP-009-02: Lambda Function Setup & Configuration

**Epic**: Epic-02 - Repository Analysis & Workspace Discovery  
**Ticket**: MVP-009-02  
**Estimated Time**: 2 hours  
**Priority**: High (Foundation ticket)  
**Status**: Todo

---

## Objective

Create the Lambda function infrastructure for `monorepo-analyzer` including resource definition, package.json, tsconfig.json, and directory structure. This is the foundation for all subsequent Epic-02 tickets.

---

## Context

The `monorepo-analyzer` Lambda function will analyze repository structure, detect monorepo types (Turborepo, Nx, Lerna, Yarn Workspaces, PNPM), discover workspaces, and build dependency graphs. This ticket sets up the basic infrastructure without implementing the core logic.

**AWS Amplify Gen 2** uses:
- `defineFunction()` for Lambda definition
- Automatic environment variable injection via `grant*` methods
- AppSync-first architecture (GraphQL API)
- TypeScript with ES2022 module system

---

## Implementation Details

### 1. Create Directory Structure

```
amplify/functions/monorepo-analyzer/
├── resource.ts          # Lambda definition
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── handler.ts           # Main entry point (placeholder)
└── lib/                 # Utility modules (empty for now)
```

### 2. Lambda Resource Definition

**File**: `amplify/functions/monorepo-analyzer/resource.ts`

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const monorepoAnalyzer = defineFunction({
  name: 'monorepo-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for large repos
  memoryMB: 2048,      // 2GB for file operations
  environment: {
    // API name from Amplify config
    API_NAME: 'specForgeDataAPI',
  },
});
```

**Key Configuration**:
- **Timeout**: 300 seconds (5 minutes) to handle large repository clones and analysis
- **Memory**: 2048 MB (2GB) for file system operations and AST parsing
- **Environment**: API_NAME for future reference (AppSync will inject GRAPHQLAPIENDPOINTOUTPUT and GRAPHQLAPIIDOUTPUT)

### 3. Package Configuration

**File**: `amplify/functions/monorepo-analyzer/package.json`

```json
{
  "name": "monorepo-analyzer",
  "version": "1.0.0",
  "type": "module",
  "description": "Analyzes repository structure and detects monorepo types",
  "main": "handler.ts",
  "dependencies": {
    "@aws-sdk/client-appsync": "^3.592.0",
    "@aws-sdk/client-kms": "^3.592.0",
    "@aws-sdk/client-ssm": "^3.592.0",
    "@aws-sdk/signature-v4": "^3.592.0",
    "@aws-sdk/protocol-http": "^3.592.0",
    "@aws-sdk/credential-provider-node": "^3.592.0",
    "@aws-crypto/sha256-js": "^5.2.0",
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
    "build": "tsc && esbuild handler.ts --bundle --platform=node --target=node18 --outfile=dist/index.js",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist node_modules"
  }
}
```

**Dependencies Explained**:
- `@aws-sdk/client-appsync`: AppSync GraphQL API calls
- `@aws-sdk/client-kms`: KMS for decrypting Git credentials
- `@aws-sdk/signature-v4`: IAM signature for AppSync authentication
- `simple-git`: Git operations (clone, pull)
- `glob`, `fast-glob`: File pattern matching for workspace discovery
- `yaml`: Parse YAML config files (pnpm-workspace.yaml, nx.json)
- `comment-json`: Parse JSON with comments (tsconfig.json, etc.)

### 4. TypeScript Configuration

**File**: `amplify/functions/monorepo-analyzer/tsconfig.json`

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
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Configuration Notes**:
- **ES2022**: Modern JavaScript features, Lambda Node.js 18+ runtime
- **Strict mode**: Catch type errors at compile time
- **Source maps**: Debugging support
- **Module resolution**: Node.js standard resolution

### 5. Placeholder Handler

**File**: `amplify/functions/monorepo-analyzer/handler.ts`

```typescript
import { AppSyncResolverHandler } from 'aws-lambda';

/**
 * Placeholder handler for monorepo-analyzer Lambda function.
 * This will be implemented in MVP-017-02.
 */

interface AnalyzeRepositoryInput {
  repositoryId: string;
  forceReanalysis?: boolean;
}

interface AnalyzeRepositoryOutput {
  success: boolean;
  message: string;
  analysisResult?: any;
}

export const handler: AppSyncResolverHandler<
  AnalyzeRepositoryInput,
  AnalyzeRepositoryOutput
> = async (event) => {
  console.log('monorepo-analyzer invoked:', JSON.stringify(event, null, 2));
  
  return {
    success: false,
    message: 'Not implemented yet - awaiting MVP-010 through MVP-017',
  };
};
```

**Handler Notes**:
- Typed with `AppSyncResolverHandler` for AppSync integration
- Input/Output interfaces defined for future implementation
- Returns placeholder response until core logic is implemented

### 6. Create lib Directory

**Create empty directory**: `amplify/functions/monorepo-analyzer/lib/`

This directory will hold utility modules:
- `detector.ts` (MVP-012-02)
- `git-client.ts` (MVP-010-02)
- `appsync-client.ts` (MVP-011-02)
- `single-repo-analyzer.ts` (MVP-016-02)
- `analyzers/` subdirectory (MVP-013 through MVP-015)

---

## Files to Create

### Summary

1. **`amplify/functions/monorepo-analyzer/resource.ts`** - Lambda definition
2. **`amplify/functions/monorepo-analyzer/package.json`** - Dependencies
3. **`amplify/functions/monorepo-analyzer/tsconfig.json`** - TypeScript config
4. **`amplify/functions/monorepo-analyzer/handler.ts`** - Placeholder handler
5. **`amplify/functions/monorepo-analyzer/lib/`** - Empty directory

---

## Acceptance Criteria

### Functional Requirements
- ✅ Directory structure created under `amplify/functions/monorepo-analyzer/`
- ✅ `resource.ts` defines Lambda with correct timeout (300s) and memory (2GB)
- ✅ `package.json` includes all required dependencies
- ✅ `tsconfig.json` configured for ES2022 with strict mode
- ✅ `handler.ts` compiles without errors
- ✅ `lib/` directory exists for future modules

### Build Requirements
- ✅ TypeScript compiles without errors: `npm run typecheck`
- ✅ Build script produces output: `npm run build`
- ✅ No dependency conflicts or missing packages

### Integration Requirements
- ✅ Lambda function can be deployed (tested in MVP-018-02)
- ✅ Environment variables structure ready for Amplify injection
- ✅ Handler responds with placeholder message when invoked

---

## Testing Instructions

### 1. Create Files
```bash
# Create directory structure
mkdir -p amplify/functions/monorepo-analyzer/lib

# Create all files as specified above
```

### 2. Install Dependencies
```bash
cd amplify/functions/monorepo-analyzer
npm install
```

### 3. Verify TypeScript Compilation
```bash
npm run typecheck
```

**Expected Output**: No errors

### 4. Build Lambda
```bash
npm run build
```

**Expected Output**: `dist/index.js` created successfully

### 5. Verify File Structure
```bash
tree amplify/functions/monorepo-analyzer
```

**Expected Structure**:
```
amplify/functions/monorepo-analyzer/
├── resource.ts
├── package.json
├── tsconfig.json
├── handler.ts
├── lib/
├── node_modules/
├── dist/
│   └── index.js
└── package-lock.json
```

---

## Environment Variables

This Lambda function will receive these environment variables from Amplify (injected automatically in MVP-018-02):

```typescript
process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT // AppSync GraphQL endpoint
process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT       // AppSync API ID
process.env.AWS_REGION                                     // AWS region
process.env.API_NAME                                       // 'specForgeDataAPI'
```

---

## Dependencies

**Depends On**:
- Epic-01 complete (assumes data model and Git integration exist)

**Blocks**:
- MVP-010-02 (Git Client)
- MVP-011-02 (AppSync Client)
- MVP-012-02 (Detector)
- All other Epic-02 tickets

---

## Notes

### Why These Dependencies?

- **simple-git**: Industry-standard Git client for Node.js, supports clone, pull, status
- **glob/fast-glob**: Required for workspace discovery (`packages/*/package.json`)
- **yaml**: PNPM and Nx use YAML config files
- **comment-json**: TypeScript configs often have comments (not valid JSON)
- **AWS SDK v3**: Modular SDK, smaller bundle sizes, better performance

### Lambda Sizing Rationale

- **2GB Memory**: Large repositories can be 100s of MB, need RAM for file operations
- **5 Min Timeout**: Clone + analysis + graph building for repos with 50+ workspaces

### Next Steps After This Ticket

1. MVP-010-02: Implement Git client for repository cloning
2. MVP-011-02: Implement AppSync client for GraphQL mutations
3. MVP-012-02: Implement monorepo type detection logic

---

## Troubleshooting

### Issue: npm install fails
**Solution**: 
- Check Node.js version (requires v18+)
- Clear npm cache: `npm cache clean --force`
- Delete package-lock.json and node_modules, reinstall

### Issue: TypeScript compilation errors
**Solution**:
- Verify tsconfig.json is valid JSON
- Check all imports resolve correctly
- Run `npm install` to ensure dependencies installed

### Issue: Build script fails
**Solution**:
- Ensure esbuild is installed: `npm install -D esbuild`
- Check handler.ts exists and is valid TypeScript
- Verify entry point in package.json matches filename

---

## Validation Checklist

Before marking this ticket complete:

- [ ] All 4 files created with exact content
- [ ] `lib/` directory exists (empty is OK)
- [ ] `npm install` completes without errors
- [ ] `npm run typecheck` passes
- [ ] `npm run build` produces `dist/index.js`
- [ ] No syntax errors in any file
- [ ] Git commit with message: "feat(epic-02): MVP-009-02 Lambda function setup"

---

## Time Tracking

- **Estimated**: 2 hours
- **Actual**: ___ hours
- **Variance**: ___ hours

---

## Related Tickets

- **Depends On**: None (Epic-01 assumed complete)
- **Blocks**: MVP-010-02, MVP-011-02, MVP-012-02, MVP-013-02, MVP-014-02, MVP-015-02, MVP-016-02, MVP-017-02, MVP-018-02
- **Epic**: Epic-02 - Repository Analysis & Workspace Discovery
