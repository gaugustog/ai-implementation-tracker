import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * Allows guest (unauthenticated) access for storage
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
