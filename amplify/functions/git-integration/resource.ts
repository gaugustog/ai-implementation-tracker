import { defineFunction } from '@aws-amplify/backend';

export const gitIntegration = defineFunction({
  name: 'git-integration',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  environment: {
    NODE_ENV: 'production',
    APPSYNC_ENDPOINT: 'placeholder', // Will be overridden by backend.ts
  },
});
