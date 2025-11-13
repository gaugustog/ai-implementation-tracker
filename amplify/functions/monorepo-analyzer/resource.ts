import { defineFunction } from '@aws-amplify/backend';

export const monorepoAnalyzer = defineFunction({
  name: 'monorepo-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for large repos
  memoryMB: 2048,      // 2GB for file operations
  environment: {
    NODE_ENV: 'production',
  },
  resourceGroupName: 'data', // Assign to data stack like git-integration
});
