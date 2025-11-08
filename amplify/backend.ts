import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { specificationConversation } from './functions/specification-conversation/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  specificationConversation,
});

// Grant Bedrock permissions to the conversation function
const bedrockPolicy = new Policy(
  backend.specificationConversation.resources.lambda,
  'BedrockPolicy',
  {
    statements: [
      new PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      }),
    ],
  }
);

backend.specificationConversation.resources.lambda.role?.attachInlinePolicy(bedrockPolicy);

// Add function URL for HTTP access
const functionUrl = backend.specificationConversation.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // Public access
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST, HttpMethod.OPTIONS],
    allowedHeaders: ['Content-Type'],
  },
});

// Add the function URL to outputs
backend.addOutput({
  custom: {
    specificationConversationUrl: functionUrl.url,
  },
});
