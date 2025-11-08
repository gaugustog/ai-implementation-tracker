import { defineFunction } from '@aws-amplify/backend';

export const ticketGeneration = defineFunction({
  name: 'ticket-generation',
  timeoutSeconds: 900, // 15 minutes for complex generations
  memoryMB: 1024,
  environment: {
    // STORAGE_BUCKET_NAME will be set dynamically in backend.ts
  },
});
