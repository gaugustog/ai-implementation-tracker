import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Project: a
    .model({
      name: a.string().required(),
      description: a.string(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
      specifications: a.hasMany('Specification', 'projectId'),
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
