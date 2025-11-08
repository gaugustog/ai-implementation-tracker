import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Project: a
    .model({
      name: a.string().required(),
      description: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      specifications: a.hasMany('Specification', 'projectId'),
      gitRepository: a.hasOne('GitRepository', 'projectId'),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Specification: a
    .model({
      type: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
      content: a.string(),
      fileKey: a.string(), // S3 file key for markdown file
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      tickets: a.hasMany('Ticket', 'specificationId'),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Ticket: a
    .model({
      title: a.string().required(),
      description: a.string(),
      status: a.enum(['todo', 'in_progress', 'done']),
      specType: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
      fileKey: a.string(), // S3 file key for markdown file
      specificationId: a.id(),
      specification: a.belongsTo('Specification', 'specificationId'),
      // Extended fields for AI-generated tickets
      acceptanceCriteria: a.json(), // Array of acceptance criteria strings
      estimatedHours: a.float(),
      complexity: a.enum(['simple', 'medium', 'complex']),
      dependencies: a.json(), // Array of ticket IDs this ticket depends on
      parallelizable: a.boolean(),
      aiAgentCapable: a.boolean(),
      requiredExpertise: a.json(), // Array of required expertise strings
      testingStrategy: a.string(),
      rollbackPlan: a.string(),
      ticketGenerationId: a.id(), // Reference to the generation batch
      ticketGeneration: a.belongsTo('TicketGeneration', 'ticketGenerationId'),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  SpecificationDraft: a
    .model({
      content: a.string(),
      conversationHistory: a.json(), // Store conversation turns
      aiSuggestions: a.json(),
      version: a.integer(),
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      status: a.enum(['draft', 'reviewing', 'finalized']),
      type: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
      sessionId: a.string(), // For conversation session management
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  GitRepository: a
    .model({
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      provider: a.enum(['github']),
      repoUrl: a.string().required(),
      branch: a.string().default('main'),
      accessTokenHash: a.string(), // Encrypted token hash
      webhookSecret: a.string(),
      lastSyncedAt: a.datetime(),
      syncStatus: a.enum(['pending', 'syncing', 'synced', 'failed']),
      lastCommitHash: a.string(),
      snapshots: a.hasMany('CodeSnapshot', 'repositoryId'),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  CodeSnapshot: a
    .model({
      repositoryId: a.id().required(),
      repository: a.belongsTo('GitRepository', 'repositoryId'),
      commitHash: a.string().required(),
      fileTreeKey: a.string(), // S3 key for file tree JSON
      metricsKey: a.string(), // S3 key for metrics JSON
      analysisComplete: a.boolean().default(false),
      createdAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  ProjectContext: a
    .model({
      projectId: a.id().required(),
      project: a.belongsTo('Project', 'projectId'),
      techStack: a.json(), // Detected languages, frameworks, libraries
      dependencies: a.json(), // Package.json, requirements.txt, etc.
      fileStructure: a.json(), // Directory tree
      patterns: a.json(), // Naming conventions, architecture patterns
      integrationPoints: a.json(), // Key files and their purposes
      lastAnalyzedAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  TicketGeneration: a
    .model({
      specificationId: a.id().required(),
      specification: a.belongsTo('Specification', 'specificationId'),
      status: a.enum(['pending', 'processing', 'completed', 'failed']),
      tickets: a.hasMany('Ticket', 'ticketGenerationId'),
      summaryFileKey: a.string(), // S3 key for SUMMARY.md
      executionPlanFileKey: a.string(), // S3 key for EXECUTION_PLAN.md
      intermediateResults: a.json(), // Store pipeline intermediate data
      errorMessage: a.string(),
      tokensUsed: a.integer(),
      totalCost: a.float(), // Estimated cost in USD
      generatedAt: a.datetime(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
