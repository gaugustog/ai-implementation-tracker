import { defineFunction } from '@aws-amplify/backend';

export const codeAnalyzer = defineFunction({
  name: 'code-analyzer',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for code analysis
  memoryMB: 2048,
  environment: {
    // Environment variables will be set in backend.ts
  },
});
