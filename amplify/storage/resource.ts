import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'specFiles',
  access: (allow) => ({
    'specs/*': [
      allow.guest.to(['read', 'write', 'delete']),
    ],
    'tickets/*': [
      allow.guest.to(['read', 'write', 'delete']),
    ],
  }),
});
