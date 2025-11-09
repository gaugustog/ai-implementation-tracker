import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { Table, AttributeType, BillingMode, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { specificationConversation } from './functions/specification-conversation/resource';
import { gitIntegration } from './functions/git-integration/resource';
import { codeAnalyzer } from './functions/code-analyzer/resource';
import { ticketGeneration } from './functions/ticket-generation/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  storage,
  specificationConversation,
  gitIntegration,
  codeAnalyzer,
  ticketGeneration,
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
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['Content-Type'],
  },
});

// Add the function URL to outputs
backend.addOutput({
  custom: {
    specificationConversationUrl: functionUrl.url,
  },
});

// Configure Git Integration function
const gitIntegrationFunctionUrl = backend.gitIntegration.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['Content-Type'],
  },
});

// Grant permissions to Git Integration function
const gitIntegrationPolicy = new Policy(
  backend.gitIntegration.resources.lambda,
  'GitIntegrationPolicy',
  {
    statements: [
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: ['*'], // In production, specify exact table ARNs
      }),
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
      }),
      new PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt'],
        resources: ['*'], // In production, specify KMS key ARN
      }),
    ],
  }
);

backend.gitIntegration.resources.lambda.role?.attachInlinePolicy(gitIntegrationPolicy);

// Create DynamoDB table for Git Integration data
const gitDataTable = new Table(
  backend.gitIntegration.resources.lambda,
  'GitIntegrationTable',
  {
    partitionKey: { name: 'id', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // For development; use RETAIN for production
    tableName: 'GitIntegrationData', // Explicit name for easier debugging
  }
);

// Add Global Secondary Index for efficient projectId queries
gitDataTable.addGlobalSecondaryIndex({
  indexName: 'ProjectIdIndex',
  partitionKey: { name: 'projectId', type: AttributeType.STRING },
  projectionType: ProjectionType.ALL, // Include all attributes in the index
});

// Grant Lambda access to the table
gitDataTable.grantReadWriteData(backend.gitIntegration.resources.lambda);
gitDataTable.grantReadWriteData(backend.codeAnalyzer.resources.lambda);

// Set environment variables
backend.gitIntegration.addEnvironment('TABLE_NAME', gitDataTable.tableName);
backend.gitIntegration.addEnvironment('BUCKET_NAME', backend.storage.resources.bucket.bucketName);
backend.gitIntegration.addEnvironment('DEBUG_GIT_INTEGRATION', process.env.DEBUG_GIT_INTEGRATION || 'false');

// Configure Code Analyzer function
const codeAnalyzerFunctionUrl = backend.codeAnalyzer.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['Content-Type'],
  },
});

// Grant permissions to Code Analyzer function
const codeAnalyzerPolicy = new Policy(
  backend.codeAnalyzer.resources.lambda,
  'CodeAnalyzerPolicy',
  {
    statements: [
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: ['*'], // In production, specify exact table ARNs
      }),
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
      }),
    ],
  }
);

backend.codeAnalyzer.resources.lambda.role?.attachInlinePolicy(codeAnalyzerPolicy);

// Set environment variables for Code Analyzer
backend.codeAnalyzer.addEnvironment('TABLE_NAME', gitDataTable.tableName);
backend.codeAnalyzer.addEnvironment('BUCKET_NAME', backend.storage.resources.bucket.bucketName);

// Configure Ticket Generation function
const ticketGenerationFunctionUrl = backend.ticketGeneration.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['Content-Type'],
  },
});

// Grant permissions to Ticket Generation function
const ticketGenerationPolicy = new Policy(
  backend.ticketGeneration.resources.lambda,
  'TicketGenerationPolicy',
  {
    statements: [
      new PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*'],
      }),
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
      }),
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: ['*'], // In production, specify exact table ARNs
      }),
    ],
  }
);

backend.ticketGeneration.resources.lambda.role?.attachInlinePolicy(ticketGenerationPolicy);

// Set storage bucket name environment variable
backend.ticketGeneration.addEnvironment('STORAGE_BUCKET_NAME', backend.storage.resources.bucket.bucketName);

// Add function URLs to outputs
backend.addOutput({
  custom: {
    gitIntegrationUrl: gitIntegrationFunctionUrl.url,
    codeAnalyzerUrl: codeAnalyzerFunctionUrl.url,
    ticketGenerationUrl: ticketGenerationFunctionUrl.url,
  },
});
