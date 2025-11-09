import { defineFunction } from '@aws-amplify/backend';

export const ticketGeneration = defineFunction({
  name: 'ticket-generation',
  entry: './handler.ts',
  timeoutSeconds: 900, // 15 minutes for complex processing
  memoryMB: 1024,
  environment: {
    STORAGE_BUCKET_NAME: '', // Will be set by backend configuration
  },
});
