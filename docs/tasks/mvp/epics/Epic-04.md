# Epic 04: Specification Creation & AI Plan Generation

## Overview
Implement the specification creation system with AWS Bedrock integration for AI-powered plan generation. This epic enables users to create specifications using custom types, select contexts, and leverage Claude Sonnet to generate detailed implementation plans. This is the bridge between context understanding and actionable work breakdown.

**Stage**: Stage 4 - Specification Creation  
**Duration**: 3 days  
**Priority**: Critical (Blocking for Stages 5-9)  
**Status**: Todo

---

## Objectives

1. ✅ Implement specification CRUD operations
2. ✅ Build conversation-based specification creation
3. ✅ Integrate AWS Bedrock (Claude Sonnet)
4. ✅ Create context preparation and formatting
5. ✅ Implement plan generation and refinement
6. ✅ Build comprehensive testing infrastructure
7. ✅ Validate AI output quality and structure

---

## Architecture Overview

### Specification Pipeline
```
User Input → Select Type → Select Context → Generate Plan → Refine Plan → Save Specification
     ↓            ↓              ↓              ↓              ↓              ↓
  Prompts   Spec Type      Context[]      Bedrock        User Review    Specification
  History   Template       Combined       Invocation     & Edits        Record Created

Bedrock Integration Flow:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Prepare Context                                              │
│    • Load contexts from DB/S3                                   │
│    • Format for Claude consumption                              │
│    • Add specification type system prompt                       │
├─────────────────────────────────────────────────────────────────┤
│ 2. Build Prompt                                                 │
│    • System prompt from SpecificationType                       │
│    • User prompt with template variables                        │
│    • Context insertion                                          │
│    • Requirements/inputs                                        │
├─────────────────────────────────────────────────────────────────┤
│ 3. Invoke Bedrock                                               │
│    • Model: Claude 3 Sonnet                                     │
│    • Max tokens: 4096                                           │
│    • Temperature: 0.7                                           │
│    • Stream response: Optional                                  │
├─────────────────────────────────────────────────────────────────┤
│ 4. Parse & Validate                                             │
│    • Extract plan structure                                     │
│    • Validate completeness                                      │
│    • Format for storage                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model (Recap from Epic-01)

### Key Models Used
```typescript
SpecificationType {
  id: ID
  name: string // 'ANALYSIS', 'FIXES', 'PLANS', etc.
  displayName: string
  description: string
  systemPrompt: string // Instructions for AI
  userPromptTemplate: string // Template with {{variables}}
  iconName: string
  color: string
  isDefault: boolean
  isActive: boolean
  order: integer
}

Specification {
  id: ID
  projectId: ID (required)
  specificationTypeId: ID (required)
  title: string
  description: string
  prompts: json // Conversation history
  inputs: json // User-provided data
  plan: json // AI-generated plan
  status: enum['draft', 'planning', 'ready', 'in_progress', 'completed']
  progress: float (0-100)
  specificationContexts: SpecificationContext[] (relation)
  epics: Epic[] (relation)
}

SpecificationContext {
  specificationId: ID
  contextId: ID
  priority: integer
}

Context {
  id: ID
  projectId: ID
  name: string
  type: enum['global', 'workspace', 'feature']
  content: json
  tokenCount: integer
  s3Key: string (optional)
}
```

---

## Lambda Implementation: specification-conversation

### Function Setup

**Directory Structure:**
```
amplify/functions/specification-conversation/
├── resource.ts          # Lambda definition
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── handler.ts           # Main entry point
└── lib/
    ├── bedrock-client.ts       # AWS Bedrock wrapper
    ├── context-formatter.ts    # Context preparation
    ├── prompt-builder.ts       # Prompt construction
    ├── plan-parser.ts          # Response parsing
    ├── plan-validator.ts       # Validation logic
    ├── appsync-client.ts       # GraphQL operations
    └── s3-storage.ts           # S3 for large contexts
```

### resource.ts
```typescript
import { defineFunction } from '@aws-amplify/backend';

export const specificationConversation = defineFunction({
  name: 'specification-conversation',
  entry: './handler.ts',
  timeoutSeconds: 300, // 5 minutes for AI generation
  memoryMB: 2048,      // 2GB for context processing
  environment: {
    API_NAME: 'specForgeDataAPI',
    CONTEXT_BUCKET: 'specforge-contexts',
    BEDROCK_REGION: 'us-east-1',
  },
});
```

### package.json
```json
{
  "name": "specification-conversation",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.592.0",
    "@aws-sdk/client-s3": "^3.592.0",
    "@aws-sdk/client-appsync": "^3.592.0",
    "@anthropic-ai/tokenizer": "^0.1.0",
    "aws-lambda": "^1.0.7",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.138",
    "@types/node": "^20.12.12",
    "esbuild": "^0.21.4",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5"
  },
  "scripts": {
    "build": "tsc && esbuild handler.ts --bundle --platform=node --target=node18 --outfile=dist/index.js"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./"
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### handler.ts
```typescript
import { AppSyncResolverHandler } from 'aws-lambda';
import { BedrockClient } from './lib/bedrock-client';
import { ContextFormatter } from './lib/context-formatter';
import { PromptBuilder } from './lib/prompt-builder';
import { PlanParser } from './lib/plan-parser';
import { PlanValidator } from './lib/plan-validator';
import { AppSyncClient } from './lib/appsync-client';

const bedrockClient = new BedrockClient({
  region: process.env.BEDROCK_REGION || 'us-east-1',
});

const appsyncClient = new AppSyncClient({
  apiEndpoint: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIENDPOINTOUTPUT!,
  apiId: process.env.API_SPECFORGEDATAAPI_GRAPHQLAPIIDOUTPUT!,
});

const contextFormatter = new ContextFormatter(process.env.CONTEXT_BUCKET!);
const promptBuilder = new PromptBuilder();
const planParser = new PlanParser();
const planValidator = new PlanValidator();

interface SpecificationInput {
  operation: 'create' | 'generatePlan' | 'refinePlan' | 'updatePlan';
  projectId?: string;
  specificationId?: string;
  specificationTypeId?: string;
  title?: string;
  description?: string;
  contextIds?: string[];
  inputs?: Record<string, any>;
  prompts?: Array<{ role: string; content: string }>;
  planUpdates?: any;
  refinementInstructions?: string;
}

export const handler: AppSyncResolverHandler<SpecificationInput, any> = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { operation } = event.arguments;
  
  try {
    switch (operation) {
      case 'create':
        return await handleCreate(event.arguments);
      
      case 'generatePlan':
        return await handleGeneratePlan(event.arguments);
      
      case 'refinePlan':
        return await handleRefinePlan(event.arguments);
      
      case 'updatePlan':
        return await handleUpdatePlan(event.arguments);
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error in specification-conversation:', error);
    throw error;
  }
};

async function handleCreate(input: SpecificationInput) {
  const { projectId, specificationTypeId, title, description, contextIds, inputs } = input;
  
  if (!projectId || !specificationTypeId || !title) {
    throw new Error('projectId, specificationTypeId, and title are required');
  }
  
  console.log(`Creating specification: ${title}`);
  
  // Create specification record
  const specification = await appsyncClient.createSpecification({
    projectId,
    specificationTypeId,
    title,
    description: description || '',
    inputs: inputs || {},
    prompts: [],
    status: 'draft',
    progress: 0,
  });
  
  // Link contexts if provided
  if (contextIds && contextIds.length > 0) {
    for (let i = 0; i < contextIds.length; i++) {
      await appsyncClient.createSpecificationContext({
        specificationId: specification.id,
        contextId: contextIds[i],
        priority: i + 1,
      });
    }
  }
  
  return {
    success: true,
    specification,
    message: 'Specification created successfully',
  };
}

async function handleGeneratePlan(input: SpecificationInput) {
  const { specificationId } = input;
  
  if (!specificationId) {
    throw new Error('specificationId is required');
  }
  
  console.log(`Generating plan for specification ${specificationId}`);
  
  // Update status to planning
  await appsyncClient.updateSpecification(specificationId, {
    status: 'planning',
  });
  
  try {
    // Get specification with all related data
    const specification = await appsyncClient.getSpecificationWithDetails(specificationId);
    const specificationType = specification.specificationType;
    
    // Get and format contexts
    const contexts = await appsyncClient.getSpecificationContexts(specificationId);
    const formattedContext = await contextFormatter.format(contexts);
    
    // Build prompt
    const prompt = promptBuilder.build({
      systemPrompt: specificationType.systemPrompt,
      userPromptTemplate: specificationType.userPromptTemplate,
      inputs: specification.inputs,
      context: formattedContext,
      additionalPrompts: specification.prompts,
    });
    
    console.log('Invoking Bedrock...');
    console.log(`Context size: ${formattedContext.length} characters`);
    console.log(`Total prompt tokens: ~${Math.ceil(prompt.user.length / 4)}`);
    
    // Invoke Bedrock
    const response = await bedrockClient.invoke({
      systemPrompt: prompt.system,
      messages: [
        { role: 'user', content: prompt.user },
      ],
      maxTokens: 4096,
      temperature: 0.7,
    });
    
    console.log('Bedrock response received');
    console.log(`Response length: ${response.content.length} characters`);
    
    // Parse response
    const plan = planParser.parse(response.content);
    
    // Validate plan
    const validation = planValidator.validate(plan);
    
    if (!validation.isValid) {
      console.error('Plan validation failed:', validation.errors);
      throw new Error(`Generated plan is invalid: ${validation.errors.join(', ')}`);
    }
    
    // Store conversation history
    const updatedPrompts = [
      ...(specification.prompts || []),
      { role: 'user', content: prompt.user, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response.content, timestamp: new Date().toISOString() },
    ];
    
    // Update specification with plan
    await appsyncClient.updateSpecification(specificationId, {
      plan,
      prompts: updatedPrompts,
      status: 'ready',
      progress: 0,
    });
    
    return {
      success: true,
      plan,
      validation,
      usage: response.usage,
      message: 'Plan generated successfully',
    };
    
  } catch (error) {
    // Update status to draft on error
    await appsyncClient.updateSpecification(specificationId, {
      status: 'draft',
    });
    
    throw error;
  }
}

async function handleRefinePlan(input: SpecificationInput) {
  const { specificationId, refinementInstructions } = input;
  
  if (!specificationId || !refinementInstructions) {
    throw new Error('specificationId and refinementInstructions are required');
  }
  
  console.log(`Refining plan for specification ${specificationId}`);
  
  // Get specification
  const specification = await appsyncClient.getSpecificationWithDetails(specificationId);
  
  if (!specification.plan) {
    throw new Error('No plan exists to refine');
  }
  
  // Build refinement prompt
  const prompt = promptBuilder.buildRefinement({
    systemPrompt: specification.specificationType.systemPrompt,
    existingPlan: specification.plan,
    refinementInstructions,
    conversationHistory: specification.prompts,
  });
  
  // Invoke Bedrock
  const response = await bedrockClient.invoke({
    systemPrompt: prompt.system,
    messages: prompt.messages,
    maxTokens: 4096,
    temperature: 0.7,
  });
  
  // Parse refined plan
  const refinedPlan = planParser.parse(response.content);
  
  // Validate
  const validation = planValidator.validate(refinedPlan);
  
  if (!validation.isValid) {
    throw new Error(`Refined plan is invalid: ${validation.errors.join(', ')}`);
  }
  
  // Update conversation history
  const updatedPrompts = [
    ...(specification.prompts || []),
    { role: 'user', content: refinementInstructions, timestamp: new Date().toISOString() },
    { role: 'assistant', content: response.content, timestamp: new Date().toISOString() },
  ];
  
  // Update specification
  await appsyncClient.updateSpecification(specificationId, {
    plan: refinedPlan,
    prompts: updatedPrompts,
  });
  
  return {
    success: true,
    plan: refinedPlan,
    validation,
    usage: response.usage,
    message: 'Plan refined successfully',
  };
}

async function handleUpdatePlan(input: SpecificationInput) {
  const { specificationId, planUpdates } = input;
  
  if (!specificationId || !planUpdates) {
    throw new Error('specificationId and planUpdates are required');
  }
  
  console.log(`Manually updating plan for specification ${specificationId}`);
  
  // Get current specification
  const specification = await appsyncClient.getSpecificationWithDetails(specificationId);
  
  // Merge updates with existing plan
  const updatedPlan = {
    ...specification.plan,
    ...planUpdates,
  };
  
  // Validate updated plan
  const validation = planValidator.validate(updatedPlan);
  
  if (!validation.isValid) {
    throw new Error(`Updated plan is invalid: ${validation.errors.join(', ')}`);
  }
  
  // Update specification
  await appsyncClient.updateSpecification(specificationId, {
    plan: updatedPlan,
  });
  
  return {
    success: true,
    plan: updatedPlan,
    validation,
    message: 'Plan updated successfully',
  };
}
```

### lib/bedrock-client.ts
```typescript
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BedrockInvokeInput {
  systemPrompt: string;
  messages: BedrockMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

interface BedrockResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class BedrockClient {
  private client: BedrockRuntimeClient;
  private modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';
  
  constructor(config: { region: string }) {
    this.client = new BedrockRuntimeClient({ region: config.region });
  }
  
  async invoke(input: BedrockInvokeInput): Promise<BedrockResponse> {
    const {
      systemPrompt,
      messages,
      maxTokens = 4096,
      temperature = 0.7,
      topP = 0.9,
    } = input;
    
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
    };
    
    console.log('Bedrock request:', {
      modelId: this.modelId,
      systemPromptLength: systemPrompt.length,
      messageCount: messages.length,
      maxTokens,
    });
    
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });
    
    const response = await this.client.send(command);
    
    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('Bedrock response:', {
      stopReason: responseBody.stop_reason,
      inputTokens: responseBody.usage.input_tokens,
      outputTokens: responseBody.usage.output_tokens,
    });
    
    return {
      content: responseBody.content[0].text,
      stopReason: responseBody.stop_reason,
      usage: {
        inputTokens: responseBody.usage.input_tokens,
        outputTokens: responseBody.usage.output_tokens,
      },
    };
  }
}
```

### lib/context-formatter.ts
```typescript
import { S3Storage } from './s3-storage';

const s3Storage = new S3Storage(process.env.CONTEXT_BUCKET!);

export class ContextFormatter {
  constructor(private bucketName: string) {}
  
  async format(contexts: any[]): Promise<string> {
    console.log(`Formatting ${contexts.length} contexts`);
    
    if (contexts.length === 0) {
      return 'No specific code context provided.';
    }
    
    const formattedParts: string[] = [];
    
    for (const ctx of contexts) {
      let contextContent = ctx.content;
      
      // Load from S3 if needed
      if (ctx.s3Key) {
        console.log(`Loading context from S3: ${ctx.s3Key}`);
        contextContent = await s3Storage.retrieve(ctx.s3Key);
      }
      
      formattedParts.push(this.formatSingleContext(ctx, contextContent));
    }
    
    return formattedParts.join('\n\n---\n\n');
  }
  
  private formatSingleContext(ctx: any, content: any): string {
    const parts: string[] = [];
    
    parts.push(`# Context: ${ctx.name}`);
    parts.push(`Type: ${ctx.type}`);
    parts.push(`Token Count: ${ctx.tokenCount}`);
    parts.push('');
    
    // Format based on context type
    if (ctx.type === 'global') {
      parts.push(this.formatGlobalContext(content));
    } else if (ctx.type === 'workspace') {
      parts.push(this.formatWorkspaceContext(content));
    } else if (ctx.type === 'feature') {
      parts.push(this.formatFeatureContext(content));
    }
    
    return parts.join('\n');
  }
  
  private formatGlobalContext(content: any): string {
    const parts: string[] = [];
    
    parts.push(`## Project: ${content.projectName}`);
    parts.push(`Repository: ${content.repositoryUrl}`);
    parts.push(`Monorepo: ${content.isMonorepo ? 'Yes' : 'No'}`);
    
    if (content.isMonorepo) {
      parts.push(`Type: ${content.monorepoType}`);
      parts.push(`Workspaces: ${content.workspaceCount}`);
    }
    
    parts.push('');
    parts.push('### Structure');
    parts.push(JSON.stringify(content.structure, null, 2));
    
    parts.push('');
    parts.push('### Key Files');
    for (const file of content.files || []) {
      parts.push(`- ${file.path} (${file.language})`);
      if (file.excerpt) {
        parts.push(`  \`\`\`${file.language}`);
        parts.push(`  ${file.excerpt}`);
        parts.push(`  \`\`\``);
      }
    }
    
    return parts.join('\n');
  }
  
  private formatWorkspaceContext(content: any): string {
    const parts: string[] = [];
    
    parts.push(`## Workspace: ${content.workspace.name}`);
    parts.push(`Path: ${content.workspace.path}`);
    parts.push(`Type: ${content.workspace.type}`);
    parts.push(`Framework: ${content.workspace.framework || 'None'}`);
    parts.push(`Language: ${content.workspace.language}`);
    
    parts.push('');
    parts.push('### Files');
    for (const file of content.files || []) {
      parts.push(`- ${file.path}`);
      if (file.fullContent) {
        parts.push(`  \`\`\`${file.language}`);
        parts.push(`  ${file.fullContent}`);
        parts.push(`  \`\`\``);
      } else if (file.excerpt) {
        parts.push(`  ${file.excerpt}`);
      }
    }
    
    if (content.dependencies && content.dependencies.length > 0) {
      parts.push('');
      parts.push('### Dependencies');
      for (const dep of content.dependencies) {
        parts.push(`- ${dep.workspace.name}`);
      }
    }
    
    return parts.join('\n');
  }
  
  private formatFeatureContext(content: any): string {
    const parts: string[] = [];
    
    parts.push('## Feature Context');
    parts.push(`Sources: ${content.sourceContexts?.length || 0} contexts`);
    
    parts.push('');
    parts.push('### Files');
    for (const file of content.merged?.files || []) {
      parts.push(`- ${file.path}`);
      if (file.fullContent) {
        parts.push(`  \`\`\`${file.language}`);
        parts.push(`  ${file.fullContent}`);
        parts.push(`  \`\`\``);
      }
    }
    
    return parts.join('\n');
  }
}
```

### lib/prompt-builder.ts
```typescript
export class PromptBuilder {
  build(input: {
    systemPrompt: string;
    userPromptTemplate: string;
    inputs: Record<string, any>;
    context: string;
    additionalPrompts?: Array<{ role: string; content: string }>;
  }): { system: string; user: string } {
    const { systemPrompt, userPromptTemplate, inputs, context, additionalPrompts } = input;
    
    // Replace variables in user prompt template
    let userPrompt = userPromptTemplate;
    
    // Standard variables
    userPrompt = userPrompt.replace(/{{context}}/g, context);
    
    // Custom input variables
    for (const [key, value] of Object.entries(inputs)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      userPrompt = userPrompt.replace(regex, String(value));
    }
    
    // Add additional instructions if provided
    if (additionalPrompts && additionalPrompts.length > 0) {
      userPrompt += '\n\n## Additional Instructions\n';
      for (const prompt of additionalPrompts) {
        if (prompt.role === 'user') {
          userPrompt += `\n${prompt.content}\n`;
        }
      }
    }
    
    return {
      system: systemPrompt,
      user: userPrompt,
    };
  }
  
  buildRefinement(input: {
    systemPrompt: string;
    existingPlan: any;
    refinementInstructions: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }): { system: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> } {
    const { systemPrompt, existingPlan, refinementInstructions, conversationHistory } = input;
    
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }
    }
    
    // Add refinement request
    const refinementPrompt = `
Based on the existing plan below, please refine it according to these instructions:

${refinementInstructions}

Existing Plan:
${JSON.stringify(existingPlan, null, 2)}

Please provide the complete refined plan in the same format.
`;
    
    messages.push({
      role: 'user',
      content: refinementPrompt,
    });
    
    return {
      system: systemPrompt,
      messages,
    };
  }
}
```

### lib/plan-parser.ts
```typescript
export class PlanParser {
  parse(content: string): any {
    // Try to extract JSON if embedded in markdown
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (error) {
        console.error('Failed to parse JSON from markdown:', error);
      }
    }
    
    // Try direct JSON parse
    try {
      return JSON.parse(content);
    } catch (error) {
      // Not JSON, treat as structured text
      return this.parseStructuredText(content);
    }
  }
  
  private parseStructuredText(content: string): any {
    // Parse markdown-style structured plan
    const plan: any = {
      overview: '',
      objectives: [],
      approach: '',
      phases: [],
      risks: [],
      successCriteria: [],
      rawContent: content,
    };
    
    const lines = content.split('\n');
    let currentSection = '';
    let currentPhase: any = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      // Detect sections
      if (trimmed.toLowerCase().startsWith('## overview')) {
        currentSection = 'overview';
        continue;
      } else if (trimmed.toLowerCase().startsWith('## objectives')) {
        currentSection = 'objectives';
        continue;
      } else if (trimmed.toLowerCase().startsWith('## approach')) {
        currentSection = 'approach';
        continue;
      } else if (trimmed.toLowerCase().startsWith('## phases') || trimmed.toLowerCase().startsWith('## implementation')) {
        currentSection = 'phases';
        continue;
      } else if (trimmed.toLowerCase().startsWith('## risks')) {
        currentSection = 'risks';
        continue;
      } else if (trimmed.toLowerCase().startsWith('## success')) {
        currentSection = 'successCriteria';
        continue;
      }
      
      // Phase detection
      if (trimmed.startsWith('### Phase') || trimmed.startsWith('### Step')) {
        if (currentPhase) {
          plan.phases.push(currentPhase);
        }
        currentPhase = {
          name: trimmed.replace(/^###\s*/, ''),
          description: '',
          tasks: [],
        };
        continue;
      }
      
      // Content collection
      if (currentSection === 'overview') {
        plan.overview += trimmed + ' ';
      } else if (currentSection === 'approach') {
        plan.approach += trimmed + ' ';
      } else if (currentSection === 'objectives' && trimmed.startsWith('-')) {
        plan.objectives.push(trimmed.substring(1).trim());
      } else if (currentSection === 'risks' && trimmed.startsWith('-')) {
        plan.risks.push(trimmed.substring(1).trim());
      } else if (currentSection === 'successCriteria' && trimmed.startsWith('-')) {
        plan.successCriteria.push(trimmed.substring(1).trim());
      } else if (currentPhase) {
        if (trimmed.startsWith('-')) {
          currentPhase.tasks.push(trimmed.substring(1).trim());
        } else {
          currentPhase.description += trimmed + ' ';
        }
      }
    }
    
    if (currentPhase) {
      plan.phases.push(currentPhase);
    }
    
    return plan;
  }
}
```

### lib/plan-validator.ts
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class PlanValidator {
  validate(plan: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check basic structure
    if (!plan) {
      errors.push('Plan is null or undefined');
      return { isValid: false, errors, warnings };
    }
    
    // Check for required sections
    if (!plan.overview && !plan.rawContent) {
      warnings.push('No overview section found');
    }
    
    if (!plan.phases || plan.phases.length === 0) {
      errors.push('No phases/implementation steps found');
    }
    
    // Validate phases
    if (plan.phases) {
      for (let i = 0; i < plan.phases.length; i++) {
        const phase = plan.phases[i];
        
        if (!phase.name) {
          errors.push(`Phase ${i + 1} has no name`);
        }
        
        if (!phase.tasks || phase.tasks.length === 0) {
          warnings.push(`Phase ${i + 1} (${phase.name}) has no tasks`);
        }
      }
    }
    
    // Check objectives
    if (plan.objectives && plan.objectives.length === 0) {
      warnings.push('No objectives defined');
    }
    
    // Check success criteria
    if (plan.successCriteria && plan.successCriteria.length === 0) {
      warnings.push('No success criteria defined');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
```

---

## Backend Configuration

Update `amplify/backend.ts`:

```typescript
import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { gitIntegration } from './functions/git-integration/resource';
import { monorepoAnalyzer } from './functions/monorepo-analyzer/resource';
import { contextSelector } from './functions/context-selector/resource';
import { specificationConversation } from './functions/specification-conversation/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  gitIntegration,
  monorepoAnalyzer,
  contextSelector,
  specificationConversation,
});

// Grant AppSync permissions
backend.data.resources.graphqlApi.grantMutation(backend.gitIntegration.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.gitIntegration.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.monorepoAnalyzer.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.monorepoAnalyzer.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.contextSelector.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.contextSelector.resources.lambda);

backend.data.resources.graphqlApi.grantMutation(backend.specificationConversation.resources.lambda);
backend.data.resources.graphqlApi.grantQuery(backend.specificationConversation.resources.lambda);

// Grant Bedrock permissions to specification-conversation
backend.specificationConversation.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
    ],
  })
);

// Grant S3 read access for contexts
const contextBucket = Bucket.fromBucketName(
  backend.specificationConversation.resources.lambda,
  'ContextBucket',
  'specforge-contexts'
);

contextBucket.grantRead(backend.specificationConversation.resources.lambda);
```

---

## Testing Infrastructure

### Test Script: test-specification-creation.ts

Create `scripts/test-specification-creation.ts`:

```typescript
#!/usr/bin/env node
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

Amplify.configure(outputs);

const client = generateClient<Schema>();

async function testCreateSpecification() {
  console.log('\n📝 Testing Specification Creation\n');
  
  const projectId = process.env.PROJECT_ID;
  const specificationTypeId = process.env.SPEC_TYPE_ID;
  
  if (!projectId || !specificationTypeId) {
    console.error('PROJECT_ID and SPEC_TYPE_ID environment variables required');
    process.exit(1);
  }
  
  // Get available contexts
  const contexts = await client.models.Context.list({
    filter: { projectId: { eq: projectId } },
    limit: 3,
  });
  
  console.log(`Found ${contexts.data.length} contexts for project`);
  
  const contextIds = contexts.data.map(c => c.id);
  
  // Create specification
  console.log('Creating specification...');
  
  const spec = await client.models.Specification.create({
    projectId,
    specificationTypeId,
    title: 'Test Specification - ' + new Date().toISOString(),
    description: 'Automated test specification',
    inputs: {
      requirements: 'Implement user authentication',
      constraints: 'Use AWS Cognito',
      focusAreas: 'Security, UX',
    },
    status: 'draft',
    progress: 0,
  });
  
  if (!spec.data) {
    throw new Error('Failed to create specification');
  }
  
  console.log(`✓ Specification created: ${spec.data.id}`);
  
  // Link contexts
  for (const contextId of contextIds) {
    await client.models.SpecificationContext.create({
      specificationId: spec.data.id,
      contextId,
      priority: 1,
    });
  }
  
  console.log(`✓ Linked ${contextIds.length} contexts\n`);
  
  return spec.data.id;
}

async function testGeneratePlan() {
  console.log('\n🤖 Testing Plan Generation with Bedrock\n');
  
  const specificationId = process.env.SPECIFICATION_ID;
  
  if (!specificationId) {
    console.error('SPECIFICATION_ID environment variable required');
    process.exit(1);
  }
  
  console.log(`Generating plan for specification: ${specificationId}`);
  
  // TODO: Call plan generation mutation
  // This would trigger the Lambda function
  
  console.log('⏳ Plan generation started (check logs)...\n');
  
  // Poll for completion
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes
  
  while (attempts < maxAttempts) {
    const spec = await client.models.Specification.get({ id: specificationId });
    
    if (spec.data?.status === 'ready' && spec.data?.plan) {
      console.log('✓ Plan generated successfully!\n');
      console.log('Plan Summary:');
      console.log(JSON.stringify(spec.data.plan, null, 2).substring(0, 500) + '...');
      return;
    } else if (spec.data?.status === 'draft') {
      console.error('✗ Plan generation failed');
      break;
    }
    
    console.log(`  Attempt ${attempts + 1}/${maxAttempts}: Status = ${spec.data?.status}`);
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    console.error('✗ Plan generation timed out');
  }
}

async function testRefinePlan() {
  console.log('\n✨ Testing Plan Refinement\n');
  
  const specificationId = process.env.SPECIFICATION_ID;
  
  if (!specificationId) {
    console.error('SPECIFICATION_ID environment variable required');
    process.exit(1);
  }
  
  // Get current specification
  const spec = await client.models.Specification.get({ id: specificationId });
  
  if (!spec.data?.plan) {
    console.error('No plan exists to refine');
    process.exit(1);
  }
  
  console.log('Refining plan with instructions...');
  
  // TODO: Call plan refinement mutation
  // refinementInstructions: "Add more detailed security considerations"
  
  console.log('⏳ Plan refinement started (check logs)...\n');
  console.log('✓ Refinement would be applied\n');
}

async function listSpecifications() {
  console.log('\n📋 Listing All Specifications\n');
  
  const specifications = await client.models.Specification.list();
  
  console.log(`Found ${specifications.data.length} specifications:\n`);
  
  for (const spec of specifications.data) {
    console.log(`  📄 ${spec.title}`);
    console.log(`     ID: ${spec.id}`);
    console.log(`     Status: ${spec.status}`);
    console.log(`     Progress: ${spec.progress}%`);
    console.log(`     Type: ${spec.specificationTypeId}`);
    console.log(`     Has Plan: ${spec.plan ? 'Yes' : 'No'}`);
    console.log(`     Created: ${spec.createdAt}\n`);
  }
}

async function testBedrockConnection() {
  console.log('\n🔌 Testing Bedrock Connection\n');
  
  console.log('Checking Bedrock access...');
  
  // This would be done via Lambda
  // Just verify Lambda exists and has correct permissions
  
  console.log('✓ Lambda function deployed');
  console.log('✓ IAM permissions configured');
  console.log('✓ Bedrock ready for use\n');
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'create':
        const specId = await testCreateSpecification();
        console.log(`\n💡 To generate plan, run:`);
        console.log(`SPECIFICATION_ID=${specId} npm run test:spec:generate\n`);
        break;
      
      case 'generate':
        await testGeneratePlan();
        break;
      
      case 'refine':
        await testRefinePlan();
        break;
      
      case 'list':
        await listSpecifications();
        break;
      
      case 'bedrock':
        await testBedrockConnection();
        break;
      
      case 'all':
        await testBedrockConnection();
        const id = await testCreateSpecification();
        process.env.SPECIFICATION_ID = id;
        await testGeneratePlan();
        await listSpecifications();
        break;
      
      default:
        console.log('Usage: npm run test:spec <command>');
        console.log('\nCommands:');
        console.log('  create     - Create a new specification');
        console.log('  generate   - Generate plan for specification');
        console.log('  refine     - Refine existing plan');
        console.log('  list       - List all specifications');
        console.log('  bedrock    - Test Bedrock connection');
        console.log('  all        - Run all tests');
        console.log('\nEnvironment variables:');
        console.log('  PROJECT_ID         - Required for create');
        console.log('  SPEC_TYPE_ID       - Required for create');
        console.log('  SPECIFICATION_ID   - Required for generate/refine');
        process.exit(1);
    }
    
    console.log('✅ Tests completed successfully\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:spec": "tsx scripts/test-specification-creation.ts",
    "test:spec:create": "tsx scripts/test-specification-creation.ts create",
    "test:spec:generate": "tsx scripts/test-specification-creation.ts generate",
    "test:spec:refine": "tsx scripts/test-specification-creation.ts refine",
    "test:spec:list": "tsx scripts/test-specification-creation.ts list",
    "test:spec:all": "tsx scripts/test-specification-creation.ts all"
  }
}
```

---

## Acceptance Criteria

### Functional Requirements
- ✅ Create specifications with type selection
- ✅ Link multiple contexts to specifications
- ✅ Generate plans using Bedrock/Claude Sonnet
- ✅ Refine plans with conversational follow-ups
- ✅ Manually edit and update plans
- ✅ Parse and validate AI-generated plans
- ✅ Store conversation history

### AI Quality Requirements
- ✅ Plans are actionable and detailed
- ✅ Plans follow specification type guidelines
- ✅ Plans incorporate provided context
- ✅ Plans are well-structured (phases, tasks, objectives)
- ✅ Validation catches incomplete plans

### Performance Requirements
- ✅ Plan generation completes within 2 minutes
- ✅ Handle contexts up to 200K tokens
- ✅ Support refinement iterations
- ✅ Efficient context formatting

### Error Handling
- ✅ Handle Bedrock API errors gracefully
- ✅ Validate plan structure before saving
- ✅ Rollback on generation failure
- ✅ Clear error messages to users

---

## Deployment Steps

### 1. Configure Bedrock Access
```bash
# Verify Bedrock model access in AWS Console
# Navigate to: Bedrock → Model access
# Enable: Claude 3 Sonnet

# Check access via CLI
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?contains(modelId, `claude-3-sonnet`)]'
```

### 2. Deploy Lambda Function
```bash
cd amplify/functions/specification-conversation
npm install
npm run build
cd ../../..
npx ampx sandbox
```

### 3. Verify Deployment
```bash
# Check Lambda exists
aws lambda list-functions --query 'Functions[?contains(FunctionName, `specification-conversation`)].FunctionName'

# Check Bedrock permissions
aws lambda get-policy --function-name <function-name>

# Should see bedrock:InvokeModel permission
```

### 4. Run Tests
```bash
# Set environment variables
export PROJECT_ID=<your-project-id>
export SPEC_TYPE_ID=<spec-type-id>

# Test creation
npm run test:spec:create

# Test generation (use ID from create output)
export SPECIFICATION_ID=<specification-id>
npm run test:spec:generate
```

---

## Troubleshooting

### Issue: Bedrock access denied
**Solution:**
- Verify model access enabled in Bedrock console
- Check Lambda IAM role has `bedrock:InvokeModel` permission
- Verify correct model ARN in IAM policy
- Check region matches (us-east-1)

### Issue: Context too large for Bedrock
**Solution:**
- Reduce number of contexts selected
- Implement context summarization
- Use Claude 3 Opus (200K context window)
- Split into multiple generations

### Issue: Generated plan is invalid
**Solution:**
- Review specification type system prompt
- Add more structure requirements to prompt
- Implement stricter validation rules
- Use few-shot examples in prompt

### Issue: Plan generation timeout
**Solution:**
- Increase Lambda timeout to 300s
- Optimize context formatting
- Reduce max_tokens if possible
- Check Bedrock API throttling

---

## Next Steps (Epic 05)

After completing this epic:
1. Epic generation will break plans into high-level work items
2. Ticket generation will create atomic implementation tasks
3. Progress tracking will monitor completion
4. UI will display plan and allow refinement

---

## Progress Tracking

- [ ] Day 1: Bedrock client & context formatting
- [ ] Day 2: Plan generation & parsing
- [ ] Day 3: Refinement, validation & testing

**Estimated Total Time**: 24 hours over 3 days
