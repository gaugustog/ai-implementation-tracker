import { defineFunction } from '@aws-amplify/backend';

export const ticketGeneration = defineFunction({
  name: 'ticket-generation',
  timeoutSeconds: 900, // 15 minutes for complex generations
  memoryMB: 1024,
});
