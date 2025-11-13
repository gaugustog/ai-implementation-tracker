# SpecForge: Complete Implementation Plan

## Architecture Overview
A clean, AppSync-first architecture for spec-driven development with monorepo support.

## Core Principles
1. **AppSync-Only**: All Lambda functions use AppSync/GraphQL, never direct DynamoDB
2. **Git-Centric**: Every project has a GitRepository with branch management
3. **Flexible Workspaces**: Support both monorepo and single-repo projects
4. **Context-Driven**: Multiple context types (global, workspace, feature)
5. **Specification Pipeline**: Spec → Epics → Tickets with progress tracking
6. **Full CRUD**: Complete user interfaces for all actions
7. **All lambdas SSM-managed**: Appsync url and API key from SSM

## Data Model

### 1. Core Models
```typescript
// amplify/data/resource.ts
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

  SpecificationContext: a.model({
    specificationId: a.id().required(),
    specification: a.belongsTo('Specification', 'specificationId'),
    contextId: a.id().required(),
    context: a.belongsTo('Context', 'contextId'),
    priority: a.integer(),
    createdAt: a.datetime(),
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
```

## Implementation Stages

### Stage 1: Project & Git Management (3 days)
**Components:**
- Project CRUD operations
- Git repository connection
- Branch management UI
- Credential management (encrypted)

**Lambda Functions:**
```typescript
// amplify/backend/functions/git-manager/index.ts
export const handler = async (event) => {
  const { operation, data } = event.arguments;
  
  switch(operation) {
    case 'connectRepository':
      return await connectRepository(data);
    case 'listBranches':
      return await listBranches(data.repositoryId);
    case 'switchBranch':
      return await switchBranch(data.repositoryId, data.branch);
    case 'updateCredential':
      return await updateCredential(data);
  }
};

async function listBranches(repositoryId: string) {
  // Get repository via AppSync
  const repo = await appsyncClient.query(GET_REPOSITORY, { id: repositoryId });
  
  // Get credentials via AppSync
  const creds = await appsyncClient.query(GET_CREDENTIAL, { repositoryId });
  
  // List branches from Git provider
  const branches = await gitClient.listBranches(repo, creds);
  
  // Update repository with cached branches
  await appsyncClient.mutate(UPDATE_REPOSITORY, {
    id: repositoryId,
    branches: branches.slice(0, 100), // Cache first 100
  });
  
  return branches;
}
```

**UI Components:**
```typescript
// components/git/RepositoryManager.tsx
- Repository connection form
- Branch selector dropdown
- Credential manager (token input)
- Connection status indicator
```

### Stage 2: Repository Analysis (4 days)
**Components:**
- Monorepo detection
- Workspace discovery
- Dependency analysis
- Context generation

**Lambda Functions:**
```typescript
// amplify/backend/functions/repo-analyzer/index.ts
export const handler = async (event) => {
  const { repositoryId } = event.arguments;
  
  // Get repository via AppSync
  const repo = await appsyncClient.query(GET_REPOSITORY, { id: repositoryId });
  
  // Detect if monorepo
  const isMonorepo = await detectMonorepo(repo);
  
  if (isMonorepo) {
    await analyzeMonorepo(repositoryId, repo);
  } else {
    await analyzeSingleRepo(repositoryId, repo);
  }
};

async function analyzeMonorepo(repositoryId: string, repo: any) {
  // Detect type (turborepo, nx, etc.)
  const type = await detectMonorepoType(repo);
  
  // Create MonorepoStructure via AppSync
  const structure = await appsyncClient.mutate(CREATE_MONOREPO_STRUCTURE, {
    repositoryId,
    type,
  });
  
  // Discover workspaces
  const workspaces = await discoverWorkspaces(repo, type);
  
  // Create Workspace records via AppSync
  for (const ws of workspaces) {
    await appsyncClient.mutate(CREATE_WORKSPACE, {
      repositoryId,
      name: ws.name,
      path: ws.path,
      type: ws.type,
      packageJson: ws.packageJson,
    });
  }
  
  // Analyze dependencies
  const dependencies = await analyzeDependencies(workspaces);
  
  // Create MonorepoDependency records via AppSync
  for (const dep of dependencies) {
    await appsyncClient.mutate(CREATE_DEPENDENCY, dep);
  }
  
  // Generate contexts
  await generateContexts(repositoryId, workspaces);
}
```

### Stage 3: Context Management (3 days)
**Components:**
- Global context (project-wide)
- Workspace context (with dependencies)
- Feature context (isolated)
- Context editor/viewer

**Lambda Functions:**
```typescript
// amplify/backend/functions/context-manager/index.ts
export const handler = async (event) => {
  const { operation, data } = event.arguments;
  
  switch(operation) {
    case 'generateGlobalContext':
      return await generateGlobalContext(data.projectId);
    case 'generateWorkspaceContext':
      return await generateWorkspaceContext(data.workspaceId, data.includeDeps);
    case 'generateFeatureContext':
      return await generateFeatureContext(data);
    case 'combineContexts':
      return await combineContexts(data.contextIds);
  }
};

async function generateWorkspaceContext(workspaceId: string, includeDeps: boolean) {
  // Get workspace via AppSync
  const workspace = await appsyncClient.query(GET_WORKSPACE, { id: workspaceId });
  
  let context = await analyzeWorkspace(workspace);
  
  if (includeDeps) {
    // Get dependencies via AppSync
    const deps = await appsyncClient.query(GET_WORKSPACE_DEPENDENCIES, { workspaceId });
    
    // Add dependency contexts
    for (const dep of deps) {
      const depContext = await analyzeWorkspace(dep.dependsOnWorkspace);
      context = mergeContexts(context, depContext);
    }
  }
  
  // Create Context record via AppSync
  return await appsyncClient.mutate(CREATE_CONTEXT, {
    projectId: workspace.repository.projectId,
    workspaceId,
    type: 'workspace',
    content: context,
    tokenCount: countTokens(context),
  });
}
```

**UI Components:**
```typescript
// components/context/ContextManager.tsx
- Context list view
- Context creation dialog
- Context editor (scope selection)
- Token counter display
- Context combination tool
```

### Stage 4: Specification Creation (3 days)
**Components:**
- Specification wizard
- Prompt interface
- Input collection
- Plan generation with Bedrock

**Lambda Functions:**
```typescript
// amplify/backend/functions/specification-creator/index.ts
export const handler = async (event) => {
  const { operation, data } = event.arguments;
  
  switch(operation) {
    case 'createSpecification':
      return await createSpecification(data);
    case 'generatePlan':
      return await generatePlan(data.specificationId);
    case 'updatePlan':
      return await updatePlan(data.specificationId, data.updates);
  }
};

async function generatePlan(specificationId: string) {
  // Get specification and contexts via AppSync
  const spec = await appsyncClient.query(GET_SPECIFICATION_WITH_CONTEXTS, { 
    id: specificationId 
  });
  
  // Prepare context for Bedrock
  const contextPrompt = prepareContextPrompt(spec.contexts);
  
  // Generate plan with Claude Sonnet
  const plan = await bedrockClient.invoke({
    modelId: 'claude-3-sonnet',
    messages: [{
      role: 'user',
      content: `${contextPrompt}\n\nGenerate a detailed plan for: ${spec.prompts}`
    }]
  });
  
  // Update specification with plan
  return await appsyncClient.mutate(UPDATE_SPECIFICATION, {
    id: specificationId,
    plan: plan.content,
    status: 'ready',
  });
}
```

**UI Components:**
```typescript
// components/specification/SpecificationWizard.tsx
- Multi-step wizard
- Context selector
- Prompt editor with history
- Requirements input form
- Plan preview/editor
```

### Stage 5: Epic Generation (3 days)
**Components:**
- Epic generator
- Epic editor
- Validation interface

**Lambda Functions:**
```typescript
// amplify/backend/functions/epic-generator/index.ts
export const handler = async (event) => {
  const { specificationId } = event.arguments;
  
  // Get specification via AppSync
  const spec = await appsyncClient.query(GET_SPECIFICATION, { id: specificationId });
  
  // Generate epics with Bedrock
  const epics = await bedrockClient.invoke({
    modelId: 'claude-3-sonnet',
    messages: [{
      role: 'user',
      content: `Break this plan into epics:\n${spec.plan}\n\nOutput as JSON array.`
    }]
  });
  
  // Create Epic records via AppSync
  for (let i = 0; i < epics.length; i++) {
    await appsyncClient.mutate(CREATE_EPIC, {
      specificationId,
      epicNumber: i + 1,
      title: epics[i].title,
      description: epics[i].description,
      objective: epics[i].objective,
      order: i,
    });
  }
  
  return epics;
};
```

### Stage 6: Ticket Generation (4 days)
**Components:**
- Ticket generator
- Ticket editor
- Dependency manager
- Status tracker

**Lambda Functions:**
```typescript
// amplify/backend/functions/ticket-generator/index.ts
export const handler = async (event) => {
  const { epicId } = event.arguments;
  
  // Get epic and specification via AppSync
  const epic = await appsyncClient.query(GET_EPIC_WITH_SPEC, { id: epicId });
  
  // Generate atomic tickets with Bedrock
  const tickets = await bedrockClient.invoke({
    modelId: 'claude-3-sonnet',
    messages: [{
      role: 'user',
      content: `Break this epic into atomic tickets:\n${epic.description}\n\n
                Context: ${epic.specification.plan}\n\n
                Each ticket should be implementable in 1-4 hours.`
    }]
  });
  
  // Create Ticket records via AppSync
  for (let i = 0; i < tickets.length; i++) {
    await appsyncClient.mutate(CREATE_TICKET, {
      epicId,
      ticketNumber: i + 1,
      title: tickets[i].title,
      description: tickets[i].description,
      implementation: tickets[i].implementation,
      acceptanceCriteria: tickets[i].criteria,
      estimatedHours: tickets[i].hours,
      order: i,
    });
  }
  
  return tickets;
};
```

### Stage 7: Progress Tracking (3 days)
**Components:**
- Ticket status board
- Progress calculator
- Blocker management
- Time tracking

**Lambda Functions:**
```typescript
// amplify/backend/functions/progress-tracker/index.ts
export const handler = async (event) => {
  const { operation, data } = event.arguments;
  
  switch(operation) {
    case 'updateTicketStatus':
      return await updateTicketStatus(data);
    case 'calculateProgress':
      return await calculateProgress(data.entityId, data.entityType);
  }
};

async function updateTicketStatus(data: any) {
  const { ticketId, status, progress, blockReason } = data;
  
  // Update ticket via AppSync
  await appsyncClient.mutate(UPDATE_TICKET, {
    id: ticketId,
    status,
    progress: status === 'in_progress' ? progress : status === 'done' ? 100 : 0,
    blockReason: status === 'blocked' ? blockReason : null,
    startedAt: status === 'in_progress' ? new Date() : undefined,
    completedAt: status === 'done' ? new Date() : undefined,
  });
  
  // Calculate and update epic progress
  const epic = await appsyncClient.query(GET_EPIC_WITH_TICKETS, { 
    ticketId 
  });
  
  const epicProgress = calculateEntityProgress(epic.tickets);
  
  await appsyncClient.mutate(UPDATE_EPIC, {
    id: epic.id,
    progress: epicProgress,
    status: epicProgress === 100 ? 'completed' : 
            epicProgress > 0 ? 'in_progress' : 'todo',
  });
  
  // Calculate and update specification progress
  const spec = await appsyncClient.query(GET_SPECIFICATION_WITH_EPICS, {
    epicId: epic.id
  });
  
  const specProgress = calculateEntityProgress(spec.epics);
  
  await appsyncClient.mutate(UPDATE_SPECIFICATION, {
    id: spec.id,
    progress: specProgress,
    status: specProgress === 100 ? 'completed' :
            specProgress > 0 ? 'in_progress' : 'ready',
  });
}
```

### Stage 8: UI Implementation (5 days)

**Dashboard Components:**
```typescript
// app/dashboard/page.tsx
- Project cards with progress
- Recent specifications
- Active tickets
- Blocked items alert
```

**Project Management:**
```typescript
// app/projects/[id]/page.tsx
- Tabbed interface:
  - Overview (with charts)
  - Git Repository
  - Workspaces (if monorepo)
  - Contexts
  - Specifications
```

**Specification Workflow:**
```typescript
// app/specifications/[id]/page.tsx
- Specification details
- Epic cards with progress
- Ticket board (Kanban view)
- Progress timeline chart
```

**Charts & Analytics:**
```typescript
// components/charts/
- SpecificationProgress.tsx (pie chart)
- TicketBurndown.tsx (line chart)
- EpicTimeline.tsx (Gantt-style)
- WorkspaceDepGraph.tsx (network graph)
```

## API Structure

### GraphQL Schema Extensions
```graphql
type Query {
  # Projects
  getProjectWithStats(id: ID!): ProjectWithStats
  
  # Git
  listBranches(repositoryId: ID!): [Branch!]
  
  # Contexts
  getAvailableContexts(projectId: ID!): [Context!]
  
  # Progress
  getProgressReport(projectId: ID!): ProgressReport
}

type Mutation {
  # Git Operations
  connectRepository(input: ConnectRepositoryInput!): GitRepository
  switchBranch(repositoryId: ID!, branch: String!): GitRepository
  analyzeRepository(repositoryId: ID!): AnalysisJob
  
  # Context Operations
  generateContext(input: GenerateContextInput!): Context
  combineContexts(contextIds: [ID!]!): Context
  
  # Specification Pipeline
  createSpecification(input: CreateSpecificationInput!): Specification
  generateEpics(specificationId: ID!): [Epic!]
  generateTickets(epicId: ID!): [Ticket!]
  
  # Progress Updates
  updateTicketStatus(input: UpdateTicketStatusInput!): Ticket
  addTicketDependency(ticketId: ID!, dependsOnId: ID!): TicketDependency
}

type Subscription {
  onAnalysisProgress(repositoryId: ID!): AnalysisProgress
  onSpecificationUpdate(specificationId: ID!): Specification
  onTicketUpdate(epicId: ID!): Ticket
}
```

## Security Considerations
1. **Credential Encryption**: Use AWS KMS for Git credentials
2. **Token Rotation**: Automatic token refresh
3. **Access Control**: Project-level permissions
4. **Audit Logging**: Track all mutations

## Performance Optimizations
1. **Batch Operations**: Use DataLoader pattern
2. **Caching**: AppSync caching for queries
3. **Pagination**: Cursor-based for large lists
4. **Subscriptions**: Real-time updates only for active views

## Deployment Steps
1. Deploy data model with Amplify
2. Run bootstrap script for default types
3. Deploy Lambda functions
4. Configure Bedrock access
5. Deploy frontend components
6. Set up monitoring with CloudWatch

## Bootstrap Script

### Default Specification Types
```typescript
// scripts/bootstrap-specification-types.ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

const DEFAULT_SPECIFICATION_TYPES = [
  {
    name: 'ANALYSIS',
    displayName: 'Code Analysis',
    description: 'Analyze codebase architecture, patterns, and potential improvements',
    systemPrompt: `You are an expert software architect analyzing a codebase.
Focus on:
- Architecture patterns and design decisions
- Code quality and maintainability
- Performance bottlenecks
- Security vulnerabilities
- Refactoring opportunities
- Technical debt assessment

Provide actionable insights with specific recommendations.`,
    userPromptTemplate: `Analyze the following aspects of {{projectName}}:
{{requirements}}

Context:
{{context}}

Focus Areas:
{{focusAreas}}`,
    iconName: 'Analytics',
    color: '#3B82F6',
    isDefault: true,
    order: 1,
    createdBy: 'system'
  },
  {
    name: 'FIXES',
    displayName: 'Bug Fixes',
    description: 'Fix bugs, errors, and issues in the codebase',
    systemPrompt: `You are an expert debugger and problem solver.
Focus on:
- Root cause analysis
- Impact assessment
- Solution implementation
- Test coverage for fixes
- Regression prevention
- Performance impact

Provide step-by-step fixes with code changes.`,
    userPromptTemplate: `Fix the following issue in {{projectName}}:
{{issueDescription}}

Error Details:
{{errorDetails}}

Context:
{{context}}

Expected Behavior:
{{expectedBehavior}}`,
    iconName: 'BugReport',
    color: '#EF4444',
    isDefault: true,
    order: 2,
    createdBy: 'system'
  },
  {
    name: 'PLANS',
    displayName: 'Implementation Plans',
    description: 'Create detailed implementation plans for new features',
    systemPrompt: `You are a technical project manager creating implementation plans.
Focus on:
- Feature breakdown into epics and tasks
- Technical requirements and constraints
- Dependencies and sequencing
- Resource estimation
- Risk assessment
- Success criteria

Create detailed, actionable implementation plans.`,
    userPromptTemplate: `Create an implementation plan for {{projectName}}:
{{featureDescription}}

Requirements:
{{requirements}}

Constraints:
{{constraints}}

Context:
{{context}}`,
    iconName: 'Assignment',
    color: '#10B981',
    isDefault: true,
    order: 3,
    createdBy: 'system'
  },
  {
    name: 'REVIEWS',
    displayName: 'Code Reviews',
    description: 'Comprehensive code review with suggestions',
    systemPrompt: `You are a senior developer conducting a thorough code review.
Focus on:
- Code quality and best practices
- Performance optimizations
- Security issues
- Testing coverage
- Documentation quality
- Maintainability
- Architectural consistency

Provide specific, constructive feedback with examples.`,
    userPromptTemplate: `Review the following code in {{projectName}}:
{{codeSection}}

Review Criteria:
{{criteria}}

Context:
{{context}}

Standards:
{{codingStandards}}`,
    iconName: 'RateReview',
    color: '#F59E0B',
    isDefault: true,
    order: 4,
    createdBy: 'system'
  },
  {
    name: 'FEATURE',
    displayName: 'Feature Development',
    description: 'Develop new features from scratch',
    systemPrompt: `You are a full-stack developer implementing new features.
Focus on:
- Feature architecture and design
- Implementation approach
- API design
- Database schema changes
- UI/UX considerations
- Testing strategy
- Documentation

Create complete feature implementation plans.`,
    userPromptTemplate: `Develop the following feature for {{projectName}}:
{{featureDescription}}

User Stories:
{{userStories}}

Technical Requirements:
{{technicalRequirements}}

Context:
{{context}}`,
    iconName: 'AddCircle',
    color: '#8B5CF6',
    isDefault: true,
    order: 5,
    createdBy: 'system'
  },
  {
    name: 'REFACTOR',
    displayName: 'Code Refactoring',
    description: 'Refactor code for better structure and maintainability',
    systemPrompt: `You are a software architect focused on code refactoring.
Focus on:
- Design pattern implementation
- Code structure improvement
- Performance optimization
- Reducing technical debt
- Improving testability
- Enhancing readability

Provide refactoring plans with before/after comparisons.`,
    userPromptTemplate: `Refactor the following code in {{projectName}}:
{{targetCode}}

Refactoring Goals:
{{goals}}

Constraints:
{{constraints}}

Context:
{{context}}`,
    iconName: 'AutoFixHigh',
    color: '#06B6D4',
    isDefault: true,
    order: 6,
    createdBy: 'system'
  },
  {
    name: 'DOCUMENTATION',
    displayName: 'Documentation',
    description: 'Create or update project documentation',
    systemPrompt: `You are a technical writer creating comprehensive documentation.
Focus on:
- Clear, concise explanations
- Code examples
- API documentation
- Architecture diagrams (as descriptions)
- Setup instructions
- Troubleshooting guides

Create user-friendly, thorough documentation.`,
    userPromptTemplate: `Document the following for {{projectName}}:
{{documentationScope}}

Target Audience:
{{audience}}

Documentation Type:
{{docType}}

Context:
{{context}}`,
    iconName: 'Description',
    color: '#64748B',
    isDefault: true,
    order: 7,
    createdBy: 'system'
  },
  {
    name: 'TESTING',
    displayName: 'Test Creation',
    description: 'Create comprehensive test suites',
    systemPrompt: `You are a QA engineer creating comprehensive test suites.
Focus on:
- Unit test creation
- Integration test scenarios
- E2E test flows
- Edge case coverage
- Performance testing
- Security testing

Create thorough test plans with example code.`,
    userPromptTemplate: `Create tests for {{projectName}}:
{{testScope}}

Testing Requirements:
{{requirements}}

Coverage Goals:
{{coverageGoals}}

Context:
{{context}}`,
    iconName: 'BugReport',
    color: '#FB923C',
    isDefault: true,
    order: 8,
    createdBy: 'system'
  }
];

export async function bootstrapSpecificationTypes() {
  console.log('Bootstrapping default specification types...');
  
  try {
    // Check if already bootstrapped
    const existing = await client.models.SpecificationType.list({
      filter: { isDefault: { eq: true } }
    });
    
    if (existing.data.length > 0) {
      console.log('Default types already exist, skipping bootstrap');
      return;
    }
    
    // Create default types
    for (const type of DEFAULT_SPECIFICATION_TYPES) {
      await client.models.SpecificationType.create({
        ...type,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Created specification type: ${type.displayName}`);
    }
    
    console.log('Bootstrap completed successfully');
  } catch (error) {
    console.error('Error bootstrapping specification types:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  bootstrapSpecificationTypes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### Stage 9: Specification Type Management (2 days)

**Components:**
- Specification type CRUD
- Prompt template editor
- Variable system for templates

**Lambda Functions:**
```typescript
// amplify/backend/functions/specification-type-manager/index.ts
export const handler = async (event) => {
  const { operation, data } = event.arguments;
  
  switch(operation) {
    case 'createSpecificationType':
      return await createSpecificationType(data);
    case 'updateSpecificationType':
      return await updateSpecificationType(data);
    case 'testPrompt':
      return await testPrompt(data);
  }
};

async function createSpecificationType(data: any) {
  // Validate prompt template
  const variables = extractVariables(data.userPromptTemplate);
  
  // Create via AppSync
  const type = await appsyncClient.mutate(CREATE_SPECIFICATION_TYPE, {
    ...data,
    isDefault: false,
    createdBy: data.userId || 'user',
  });
  
  return type;
}

async function testPrompt(data: any) {
  const { typeId, testInputs } = data;
  
  // Get specification type
  const type = await appsyncClient.query(GET_SPECIFICATION_TYPE, { id: typeId });
  
  // Replace variables in template
  let prompt = type.userPromptTemplate;
  for (const [key, value] of Object.entries(testInputs)) {
    prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  // Test with Bedrock
  const response = await bedrockClient.invoke({
    modelId: 'claude-3-sonnet',
    system: type.systemPrompt,
    messages: [{
      role: 'user',
      content: prompt
    }],
    maxTokens: 1000,
  });
  
  return {
    renderedPrompt: prompt,
    testResponse: response.content,
  };
}

function extractVariables(template: string): string[] {
  const regex = /{{(\w+)}}/g;
  const variables = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    variables.push(match[1]);
  }
  
  return [...new Set(variables)];
}
```

**UI Components:**
```typescript
// app/settings/specification-types/page.tsx
export default function SpecificationTypesPage() {
  return (
    <div>
      <Typography variant="h4">Specification Types</Typography>
      
      {/* Default Types (read-only) */}
      <Card>
        <CardHeader title="Default Types" />
        <CardContent>
          <List>
            {defaultTypes.map(type => (
              <SpecificationTypeItem
                key={type.id}
                type={type}
                readOnly={true}
                onView={() => openViewer(type)}
              />
            ))}
          </List>
        </CardContent>
      </Card>
      
      {/* Custom Types */}
      <Card>
        <CardHeader 
          title="Custom Types"
          action={
            <Button onClick={openCreator}>
              Add Custom Type
            </Button>
          }
        />
        <CardContent>
          <List>
            {customTypes.map(type => (
              <SpecificationTypeItem
                key={type.id}
                type={type}
                readOnly={false}
                onEdit={() => openEditor(type)}
                onDelete={() => deleteType(type.id)}
              />
            ))}
          </List>
        </CardContent>
      </Card>
    </div>
  );
}

// components/specification/SpecificationTypeEditor.tsx
export function SpecificationTypeEditor({ type, onSave }: Props) {
  const [formData, setFormData] = useState(type || {
    name: '',
    displayName: '',
    description: '',
    systemPrompt: '',
    userPromptTemplate: '',
    iconName: 'Description',
    color: '#3B82F6',
  });
  
  const [testInputs, setTestInputs] = useState({});
  const [testResult, setTestResult] = useState(null);
  
  const variables = extractVariables(formData.userPromptTemplate);
  
  return (
    <Dialog open fullWidth maxWidth="lg">
      <DialogTitle>
        {type ? 'Edit' : 'Create'} Specification Type
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid item xs={12} md={6}>
            <TextField
              label="Internal Name"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              helperText="e.g., CUSTOM_ANALYSIS"
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({...formData, displayName: e.target.value})}
              helperText="User-friendly name"
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              multiline
              rows={2}
              fullWidth
            />
          </Grid>
          
          {/* Icon and Color */}
          <Grid item xs={12} md={6}>
            <IconPicker
              value={formData.iconName}
              onChange={(icon) => setFormData({...formData, iconName: icon})}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ColorPicker
              value={formData.color}
              onChange={(color) => setFormData({...formData, color})}
            />
          </Grid>
          
          {/* System Prompt */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              System Prompt (Instructions for AI)
            </Typography>
            <CodeEditor
              value={formData.systemPrompt}
              onChange={(value) => setFormData({...formData, systemPrompt: value})}
              language="markdown"
              minHeight="200px"
            />
          </Grid>
          
          {/* User Prompt Template */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              User Prompt Template
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Use {`{{variableName}}`} for dynamic values. 
              Available: projectName, context, requirements, etc.
            </Alert>
            <CodeEditor
              value={formData.userPromptTemplate}
              onChange={(value) => setFormData({...formData, userPromptTemplate: value})}
              language="markdown"
              minHeight="150px"
            />
            
            {variables.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Detected variables: {variables.join(', ')}
                </Typography>
              </Box>
            )}
          </Grid>
          
          {/* Test Section */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Test Prompt
            </Typography>
            
            <Grid container spacing={2}>
              {variables.map(variable => (
                <Grid item xs={12} md={6} key={variable}>
                  <TextField
                    label={variable}
                    value={testInputs[variable] || ''}
                    onChange={(e) => setTestInputs({
                      ...testInputs,
                      [variable]: e.target.value
                    })}
                    fullWidth
                    size="small"
                  />
                </Grid>
              ))}
            </Grid>
            
            <Button
              variant="outlined"
              onClick={async () => {
                const result = await testSpecificationPrompt(
                  formData,
                  testInputs
                );
                setTestResult(result);
              }}
              sx={{ mt: 2 }}
            >
              Test Prompt
            </Button>
            
            {testResult && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Test Result:
                </Typography>
                <Typography variant="body2" component="pre">
                  {testResult}
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={() => onSave(formData)}
          disabled={!formData.name || !formData.displayName}
        >
          Save Type
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### Specification Creation with Custom Types
```typescript
// components/specification/SpecificationCreator.tsx
export function SpecificationCreator({ projectId }: Props) {
  const [selectedType, setSelectedType] = useState<SpecificationType | null>(null);
  const [inputs, setInputs] = useState({});
  
  // Load available specification types
  const { data: types } = useQuery(LIST_SPECIFICATION_TYPES, {
    filter: { isActive: { eq: true } }
  });
  
  return (
    <Stepper activeStep={activeStep}>
      {/* Step 1: Select Type */}
      <Step>
        <StepLabel>Select Specification Type</StepLabel>
        <StepContent>
          <Grid container spacing={2}>
            {types?.map(type => (
              <Grid item xs={12} md={4} key={type.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedType?.id === type.id ? 2 : 0,
                    borderColor: 'primary.main'
                  }}
                  onClick={() => setSelectedType(type)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Icon name={type.iconName} sx={{ color: type.color, mr: 1 }} />
                      <Typography variant="h6">{type.displayName}</Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {type.description}
                    </Typography>
                    {type.isDefault && (
                      <Chip label="Default" size="small" sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </StepContent>
      </Step>
      
      {/* Step 2: Fill Inputs */}
      <Step>
        <StepLabel>Provide Information</StepLabel>
        <StepContent>
          {selectedType && (
            <DynamicForm
              template={selectedType.userPromptTemplate}
              onChange={setInputs}
              values={inputs}
            />
          )}
        </StepContent>
      </Step>
      
      {/* Step 3: Select Context */}
      <Step>
        <StepLabel>Select Context</StepLabel>
        <StepContent>
          <ContextSelector projectId={projectId} />
        </StepContent>
      </Step>
      
      {/* Step 4: Generate Plan */}
      <Step>
        <StepLabel>Review & Generate</StepLabel>
        <StepContent>
          <Button onClick={generateSpecification}>
            Generate {selectedType?.displayName}
          </Button>
        </StepContent>
      </Step>
    </Stepper>
  );
}

## Total Timeline
**Estimated Duration**: 4-5 weeks
- Week 1: Stages 1-2 (Project, Git, Analysis)
- Week 2: Stages 3-4 (Context, Specifications)
- Week 3: Stages 5-6 (Epics, Tickets)
- Week 4: Stage 7-8 (Progress, UI)
- Week 5: Testing & Polish

This architecture ensures clean separation of concerns, full AppSync integration, and comprehensive UI for all user actions.
