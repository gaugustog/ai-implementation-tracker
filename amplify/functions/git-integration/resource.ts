import { defineFunction } from '@aws-amplify/backend';

export const gitIntegration = defineFunction({
  name: 'git-integration',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for git operations
  memoryMB: 1024,
  environment: {
    // Environment variables will be set in backend.ts
  },
});
