import { defineFunction } from '@aws-amplify/backend';

export const specificationConversation = defineFunction({
  name: 'specification-conversation',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 1024,
});
