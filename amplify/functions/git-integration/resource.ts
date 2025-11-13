import { defineFunction } from '@aws-amplify/backend';

export const gitIntegration = defineFunction({
  name: 'git-integration',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  environment: {
    NODE_ENV: 'production',
    // APPSYNC_ENDPOINT is auto-injected by Amplify via GraphQL handler
  },
  resourceGroupName: 'data', // Assign to data stack to avoid circular dependency
});
