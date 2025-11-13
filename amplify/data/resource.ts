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
    dependents: a.hasMany('MonorepoDependency', 'dependsOnWorkspaceId'),
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
    specifications: a.hasMany('Specification', 'specificationTypeId'),
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

  // === CUSTOM QUERIES ===
  // Git Integration Lambda invocation
  gitIntegrationOperation: a
    .query()
    .arguments({
      operation: a.string().required(),
      data: a.json().required(),
    })
    .returns(a.json())
    .handler(a.handler.function('gitIntegration'))
    .authorization(allow => [allow.publicApiKey()]),
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
