# Epic 02 - Implementation Tickets Summary

## Overview
Epic 02: Repository Analysis & Workspace Discovery will be split into **10 implementation tickets**. Each ticket is self-contained with all necessary context for implementation.

---

## Ticket Breakdown

### **MVP-009-02: Lambda Function Setup & Configuration**
**Estimated Time**: 2 hours  
**Description**: Create the Lambda function infrastructure including resource definition, package.json, tsconfig.json, and directory structure.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/resource.ts`
- `amplify/functions/monorepo-analyzer/package.json`
- `amplify/functions/monorepo-analyzer/tsconfig.json`
- Directory structure for `/lib` folder

**Dependencies**: None (Epic-01 tickets 001-008 assumed complete)

---

### **MVP-010-02: Git Client Implementation**
**Estimated Time**: 3 hours  
**Description**: Implement Git client for cloning/pulling repositories with KMS credential decryption.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/git-client.ts`

**Key Features**:
- Clone or pull repository
- KMS token decryption
- Build authenticated URLs
- Cleanup temporary directories

**Dependencies**: MVP-009-02

---

### **MVP-011-02: AppSync Client Implementation**
**Estimated Time**: 4 hours  
**Description**: Implement AppSync client for GraphQL operations with IAM signature.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/appsync-client.ts`

**Key Features**:
- Query and mutation execution with IAM signing
- Repository operations (get, update)
- GitCredential retrieval
- MonorepoStructure creation
- Workspace creation
- MonorepoDependency creation

**Dependencies**: MVP-009-02

---

### **MVP-012-02: Monorepo Type Detector**
**Estimated Time**: 2 hours  
**Description**: Implement detection logic for all 5 monorepo types (Turborepo, Nx, Lerna, Yarn Workspaces, PNPM).  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/detector.ts`

**Key Features**:
- File-based detection (turbo.json, nx.json, lerna.json, etc.)
- Package.json field validation (workspaces)
- Return null for single repos

**Dependencies**: MVP-009-02

---

### **MVP-013-02: Turborepo Analyzer**
**Estimated Time**: 4 hours  
**Description**: Implement complete Turborepo analysis including workspace discovery and dependency graph building.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/analyzers/index.ts`
- `amplify/functions/monorepo-analyzer/lib/analyzers/turborepo.ts`

**Key Features**:
- Read turbo.json and package.json
- Discover workspaces via glob patterns
- Detect workspace types (app/package/library)
- Detect frameworks (Next.js, React, etc.)
- Build internal dependency graph
- Return MonorepoAnalysisResult

**Dependencies**: MVP-009-02, MVP-012-02

---

### **MVP-014-02: Nx Analyzer**
**Estimated Time**: 4 hours  
**Description**: Implement complete Nx workspace analysis with project.json support.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/analyzers/nx.ts`

**Key Features**:
- Read nx.json and workspace.json
- Support project.json files (Nx 13+)
- Detect project types (application/library)
- Extract framework from executors/builders
- Build dependency graph from implicitDependencies
- Detect language (TypeScript/JavaScript)

**Dependencies**: MVP-009-02, MVP-012-02, MVP-013-02

---

### **MVP-015-02: Lerna, Yarn Workspaces & PNPM Analyzers**
**Estimated Time**: 4 hours  
**Description**: Implement analyzers for remaining 3 monorepo types.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/analyzers/lerna.ts`
- `amplify/functions/monorepo-analyzer/lib/analyzers/yarn-workspaces.ts`
- `amplify/functions/monorepo-analyzer/lib/analyzers/pnpm.ts`

**Key Features**:
- Lerna: Parse lerna.json, discover packages
- Yarn: Parse workspace patterns from package.json
- PNPM: Parse pnpm-workspace.yaml
- All share common workspace discovery and dependency logic

**Dependencies**: MVP-009-02, MVP-012-02, MVP-013-02

---

### **MVP-016-02: Single Repository Analyzer**
**Estimated Time**: 2 hours  
**Description**: Implement analyzer for non-monorepo (single) repositories.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/lib/single-repo-analyzer.ts`

**Key Features**:
- Read root package.json
- Detect framework and language
- Create single workspace with type 'single'
- Return minimal MonorepoAnalysisResult

**Dependencies**: MVP-009-02, MVP-012-02

---

### **MVP-017-02: Main Lambda Handler & Data Persistence**
**Estimated Time**: 4 hours  
**Description**: Implement main Lambda handler with complete analysis flow and data persistence.  
**Files Created**:
- `amplify/functions/monorepo-analyzer/handler.ts`

**Key Features**:
- Handle analyzeRepository event
- Update repository status (analyzing → ready/error)
- Clone/pull repository
- Detect monorepo type and branch logic
- Persist MonorepoStructure (if monorepo)
- Persist all Workspaces
- Persist MonorepoDependencies
- Error handling and cleanup

**Dependencies**: MVP-010-02, MVP-011-02, MVP-012-02, MVP-013-02, MVP-014-02, MVP-015-02, MVP-016-02

---

### **MVP-018-02: Backend Configuration & Testing**
**Estimated Time**: 3 hours  
**Description**: Update backend configuration and create comprehensive testing infrastructure.  
**Files Created**:
- Update to `amplify/backend.ts`
- `scripts/test-monorepo-analysis.ts`
- Update to root `package.json` (add test scripts)

**Key Features**:
- Add monorepoAnalyzer to backend
- Grant AppSync permissions
- Grant KMS decrypt permissions
- Create automated test cases
- Create manual test mode
- Add npm scripts for testing

**Dependencies**: MVP-017-02

---

## Implementation Order

```
MVP-009-02 (Foundation)
    ↓
├─→ MVP-010-02 (Git Client)
├─→ MVP-011-02 (AppSync Client)
└─→ MVP-012-02 (Detector)
        ↓
    ├─→ MVP-013-02 (Turborepo)
    ├─→ MVP-014-02 (Nx)
    ├─→ MVP-015-02 (Lerna, Yarn, PNPM)
    └─→ MVP-016-02 (Single Repo)
            ↓
        MVP-017-02 (Handler)
            ↓
        MVP-018-02 (Backend & Tests)
```

---

## Total Estimated Time

- **Setup & Infrastructure**: 2 hours (MVP-009)
- **Core Clients**: 7 hours (MVP-010, MVP-011)
- **Detection**: 2 hours (MVP-012)
- **Analyzers**: 14 hours (MVP-013, MVP-014, MVP-015, MVP-016)
- **Integration**: 4 hours (MVP-017)
- **Testing**: 3 hours (MVP-018)

**Total**: ~32 hours (4 days @ 8 hours/day)

---

## Data Model Reference (From Epic-01)

All tickets will work with these models:

```typescript
GitRepository {
  id, projectId, provider, repoUrl, currentBranch
  isMonorepo, monorepoType, status, lastAnalyzedAt
}

MonorepoStructure {
  id, repositoryId, type, workspaceCount
  rootConfig, dependencyGraph, analyzedAt
}

Workspace {
  id, repositoryId, name, path, type
  framework, language, packageJson, metadata
}

MonorepoDependency {
  id, workspaceId, dependsOnWorkspaceId
  monorepoStructureId, type, version
}
```

---

## Environment Variables

All Lambda functions use:
- `API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT`
- `API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT`
- `AWS_REGION`

---

## Next Steps

1. Review this ticket summary
2. Confirm the breakdown makes sense
3. Request implementation of tickets one at a time
4. Start with MVP-009-02 (Foundation)

Example: "Implement MVP-009-02" or "Create ticket MVP-009-02"
