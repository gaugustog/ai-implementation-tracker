# MVP-002-01: Implement Full 14-Model Schema

**Epic**: Epic-01 - Project & Git Management Foundation  
**Day**: 1  
**Estimated Time**: 2 hours  
**Status**: Todo  
**Priority**: Critical  
**Depends On**: MVP-001-01

---

## Objective

Replace the current simplified 3-model schema with the complete 14-model schema from the MVP plan. This establishes the foundation for all Git integration, workspace management, context handling, and specification features.

---

## Target Schema (14 Models)

### Core Models (3)
1. **Project** - Base project entity
2. **GitRepository** - Git provider integration
3. **GitCredential** - Encrypted credential storage

### Workspace Models (3)
4. **Workspace** - Monorepo/single-repo workspace
5. **MonorepoStructure** - Monorepo configuration
6. **MonorepoDependency** - Workspace dependencies

### Context Models (2)
7. **Context** - Code context for AI
8. **SpecificationContext** - Link contexts to specifications

### Specification Models (6)
9. **SpecificationType** - Customizable spec templates
10. **Specification** - Main specification entity
11. **Epic** - High-level work breakdown
12. **Ticket** - Atomic implementation tasks
13. **TicketDependency** - Task dependencies

---

## Complete Schema Implementation

Replace the entire content of `amplify/data/resource.ts` with:

```typescript
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // === PROJECTS ===
  Project: a.model({
    name: a.string().required(),
    description: a.string(),
    gitRepository: a.hasOne('GitRepository', 'projectId'),
    contexts: a.hasMany('Context', 'projectId'),
    specifications: a.hasMany('Specification', 'projectId'),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  // === GIT INTEGRATION ===
  GitRepository: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    provider: a.enum(['github', 'gitlab', 'bitbucket']),
    repoUrl: a.string().required(),
    currentBranch: a.string().required(),
    branches: a.json(), // Cached list of branches
    isMonorepo: a.boolean().default(false),
    monorepoType: a.enum(['turborepo', 'nx', 'lerna', 'yarn_workspaces', 'pnpm']),
    credential: a.hasOne('GitCredential', 'repositoryId'),
    workspaces: a.hasMany('Workspace', 'repositoryId'),
    monorepoStructure: a.hasOne('MonorepoStructure', 'repositoryId'),
    lastAnalyzedAt: a.datetime(),
    lastSyncedAt: a.datetime(),
    status: a.enum(['pending', 'analyzing', 'ready', 'error']),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  GitCredential: a.model({
    repositoryId: a.id().required(),
    repository: a.belongsTo('GitRepository', 'repositoryId'),
    type: a.enum(['token', 'ssh', 'oauth']),
    encryptedToken: a.string(), // Encrypted in Lambda
    username: a.string(),
    expiresAt: a.datetime(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  // === WORKSPACE MANAGEMENT ===
  Workspace: a.model({
    repositoryId: a.id().required(),
    repository: a.belongsTo('GitRepository', 'repositoryId'),
    name: a.string().required(),
    path: a.string().required(),
    type: a.enum(['app', 'package', 'library', 'feature', 'single']),
    framework: a.string(),
    language: a.string(),
    packageJson: a.json(),
    dependencies: a.hasMany('MonorepoDependency', 'workspaceId'),
    contexts: a.hasMany('Context', 'workspaceId'),
    metadata: a.json(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  MonorepoStructure: a.model({
    repositoryId: a.id().required(),
    repository: a.belongsTo('GitRepository', 'repositoryId'),
    type: a.string().required(),
    workspaceCount: a.integer(),
    rootConfig: a.json(), // turbo.json, nx.json, etc.
    dependencyGraph: a.json(),
    dependencies: a.hasMany('MonorepoDependency', 'monorepoStructureId'),
    analyzedAt: a.datetime(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  MonorepoDependency: a.model({
    workspaceId: a.id(),
    workspace: a.belongsTo('Workspace', 'workspaceId'),
    dependsOnWorkspaceId: a.id(),
    dependsOnWorkspace: a.belongsTo('Workspace', 'dependsOnWorkspaceId'),
    monorepoStructureId: a.id(),
    monorepoStructure: a.belongsTo('MonorepoStructure', 'monorepoStructureId'),
    type: a.enum(['internal', 'external', 'peer', 'dev']),
    version: a.string(),
    createdAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  // === CONTEXTS ===
  Context: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    workspaceId: a.id(),
    workspace: a.belongsTo('Workspace', 'workspaceId'),
    name: a.string().required(),
    type: a.enum(['global', 'workspace', 'feature']),
    scope: a.json(), // Which files/folders included
    content: a.json(), // Analyzed content
    tokenCount: a.integer(),
    specificationContexts: a.hasMany('SpecificationContext', 'contextId'),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  SpecificationContext: a.model({
    specificationId: a.id().required(),
    specification: a.belongsTo('Specification', 'specificationId'),
    contextId: a.id().required(),
    context: a.belongsTo('Context', 'contextId'),
    priority: a.integer(),
    createdAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  // === SPECIFICATIONS ===
  SpecificationType: a.model({
    name: a.string().required(), // 'ANALYSIS', 'FIXES', etc.
    displayName: a.string().required(), // 'Code Analysis', 'Bug Fixes', etc.
    description: a.string(),
    systemPrompt: a.string().required(), // Prompt template for Bedrock
    userPromptTemplate: a.string(), // Template with variables like {{context}}, {{requirements}}
    iconName: a.string(), // Icon to display in UI
    color: a.string(), // Hex color for UI
    isDefault: a.boolean().default(false), // System default types
    isActive: a.boolean().default(true),
    order: a.integer(),
    createdBy: a.string(), // 'system' or userId
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  Specification: a.model({
    projectId: a.id().required(),
    project: a.belongsTo('Project', 'projectId'),
    specificationTypeId: a.id().required(),
    specificationType: a.belongsTo('SpecificationType', 'specificationTypeId'),
    title: a.string().required(),
    description: a.string(),
    prompts: a.json(), // User prompts history
    inputs: a.json(), // User inputs/requirements
    plan: a.json(), // Generated plan
    status: a.enum(['draft', 'planning', 'ready', 'in_progress', 'completed']),
    progress: a.float().default(0),
    specificationContexts: a.hasMany('SpecificationContext', 'specificationId'),
    epics: a.hasMany('Epic', 'specificationId'),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  // === EPICS & TICKETS ===
  Epic: a.model({
    specificationId: a.id().required(),
    specification: a.belongsTo('Specification', 'specificationId'),
    epicNumber: a.integer().required(),
    title: a.string().required(),
    description: a.string(),
    objective: a.string(),
    status: a.enum(['todo', 'in_progress', 'completed']),
    progress: a.float().default(0),
    tickets: a.hasMany('Ticket', 'epicId'),
    order: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  Ticket: a.model({
    epicId: a.id().required(),
    epic: a.belongsTo('Epic', 'epicId'),
    ticketNumber: a.integer().required(),
    title: a.string().required(),
    description: a.string(),
    implementation: a.json(), // Detailed implementation steps
    acceptanceCriteria: a.string().array(),
    technicalDetails: a.json(),
    estimatedHours: a.float(),
    actualHours: a.float(),
    status: a.enum(['todo', 'queue', 'in_progress', 'blocked', 'done']),
    progress: a.integer().default(0), // 0-100 percentage
    blockReason: a.string(),
    dependencies: a.hasMany('TicketDependency', 'ticketId'),
    dependents: a.hasMany('TicketDependency', 'dependsOnId'),
    order: a.integer(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    startedAt: a.datetime(),
    completedAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),

  TicketDependency: a.model({
    ticketId: a.id().required(),
    ticket: a.belongsTo('Ticket', 'ticketId'),
    dependsOnId: a.id().required(),
    dependsOn: a.belongsTo('Ticket', 'dependsOnId'),
    type: a.enum(['blocks', 'requires']),
    createdAt: a.datetime(),
  }).authorization(allow => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  name: 'specForgeDataAPI',
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
```

---

## Implementation Steps

### 1. Replace Schema File

```bash
# Navigate to data directory
cd amplify/data

# Edit resource.ts and paste the complete schema above
# Use your editor of choice
code resource.ts  # or vim, nano, etc.
```

### 2. Deploy Schema

```bash
# Deploy with Amplify sandbox
npx ampx sandbox
```

### 3. Monitor Deployment

Watch the terminal output for:
- ✅ CloudFormation stack creation
- ✅ DynamoDB table creation (14 tables)
- ✅ AppSync API update
- ✅ No errors or warnings

---

## Acceptance Criteria

- [ ] Schema file updated with 14 models
- [ ] Deployment completes without errors
- [ ] All 14 DynamoDB tables created
- [ ] AppSync API updated successfully
- [ ] Can access GraphQL endpoint
- [ ] No TypeScript compilation errors
- [ ] All relationships properly configured

---

## Verification Steps

### 1. Check CloudFormation

```bash
# View stack status
aws cloudformation describe-stacks --stack-name amplify-* | grep StackStatus
```

### 2. List DynamoDB Tables

```bash
# Should show 14 tables
aws dynamodb list-tables --query 'TableNames[?contains(@, `amplify`)]' --output table
```

Expected tables:
- Project
- GitRepository
- GitCredential
- Workspace
- MonorepoStructure
- MonorepoDependency
- Context
- SpecificationContext
- SpecificationType
- Specification
- Epic
- Ticket
- TicketDependency

### 3. Test AppSync

```bash
# Check if AppSync API is accessible
aws appsync list-graphql-apis
```

### 4. Test TypeScript Types

```typescript
// Create a test file: test-schema-types.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from './amplify/data/resource';

const client = generateClient<Schema>();

// This should compile without errors
async function testTypes() {
  // Test Project
  const project = await client.models.Project.create({
    name: 'Test Project',
    description: 'Schema verification'
  });
  
  // Test GitRepository
  const repo = await client.models.GitRepository.create({
    projectId: project.data!.id,
    provider: 'github',
    repoUrl: 'https://github.com/test/repo',
    currentBranch: 'main',
    status: 'pending'
  });
  
  console.log('✅ Schema types working correctly');
}
```

---

## Rollback Procedure

If deployment fails:

```bash
# Stop sandbox
# Press Ctrl+C in the terminal

# Restore backup
cp amplify/data/backups/resource.ts.backup-* amplify/data/resource.ts

# Redeploy
npx ampx sandbox
```

---

## Common Issues & Solutions

### Issue: TypeScript Errors

**Solution**: Ensure all relationships use correct field names:
- `belongsTo` fields must match the ID field (e.g., `projectId` → `'projectId'`)
- `hasMany` and `hasOne` reference fields must exist on the related model

### Issue: CloudFormation Timeout

**Solution**: 
```bash
# Increase timeout
npx ampx sandbox --timeout 30
```

### Issue: Authorization Errors

**Solution**: All models use `allow.publicApiKey()` for now. This is correct for MVP.

---

## Notes

- **API Key**: The schema uses `publicApiKey` authorization for all models
- **Relationships**: All relationships are configured bidirectionally
- **JSON Fields**: Used for flexible storage (branches, configs, metadata)
- **Enums**: Strongly typed status values and provider types
- **Timestamps**: All models have `createdAt` and `updatedAt`

---

## Next Ticket

MVP-003-01: Configure Backend with Lambda and KMS
