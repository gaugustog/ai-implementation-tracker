import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseStreamCommandOutput,
  Message,
} from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Type definitions
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface SpecificationContext {
  projectId: string;
  projectName?: string;
  projectDescription?: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  existingContent?: string;
  codebaseContext?: {
    techStack?: any;
    patterns?: any;
    integrationPoints?: any;
    relevantFiles?: string[];
  };
}

interface ConversationRequest {
  message: string;
  conversationHistory: ConversationMessage[];
  context: SpecificationContext;
  sessionId: string;
}

// System prompts for different specification types
const SYSTEM_PROMPTS = {
  ANALYSIS: `You are an expert technical analyst helping to create a detailed requirements analysis specification. 
Your role is to:
- Ask clarifying questions about requirements
- Identify missing or ambiguous requirements
- Suggest technical considerations
- Structure the analysis clearly with sections like: Overview, Requirements, Technical Constraints, Dependencies, etc.
- Be thorough but concise`,

  FIXES: `You are an expert software engineer helping to document bug fixes and issues.
Your role is to:
- Help identify root causes
- Suggest comprehensive fix approaches
- Consider edge cases and potential side effects
- Structure the fix document with: Problem Statement, Root Cause, Proposed Solution, Testing Strategy, etc.
- Focus on clarity and actionability`,

  PLANS: `You are an expert project manager helping to create implementation plans.
Your role is to:
- Break down work into logical phases
- Identify dependencies and risks
- Suggest realistic timelines considering the AI implementation context
- Structure the plan with: Goals, Phases, Tasks, Milestones, Resources, etc.
- Be practical and detailed`,

  REVIEWS: `You are an expert code reviewer helping to document code and design reviews.
Your role is to:
- Identify potential issues and improvements
- Suggest best practices
- Consider maintainability and scalability
- Structure the review with: Summary, Findings, Recommendations, Action Items, etc.
- Be constructive and specific`,
};

/**
 * Main handler for specification conversation
 */
export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const request: ConversationRequest = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event.body;

    const { message, conversationHistory, context, sessionId } = request;

    if (!message || !context || !context.specType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: message, context, or specType' }),
      };
    }

    // Build system prompt based on specification type
    const systemPrompt = buildSystemPrompt(context);

    // Convert conversation history to Bedrock format
    const messages: Message[] = conversationHistory.map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content }],
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: [{ text: message }],
    });

    // Call Bedrock with streaming
    const command = new ConverseStreamCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      messages,
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    const response: ConverseStreamCommandOutput = await bedrockClient.send(command);

    // Handle streaming response
    if (!response.stream) {
      throw new Error('No stream in response');
    }

    let fullResponse = '';
    const chunks: string[] = [];

    for await (const chunk of response.stream) {
      if (chunk.contentBlockDelta?.delta?.text) {
        const text = chunk.contentBlockDelta.delta.text;
        fullResponse += text;
        chunks.push(text);
      }
    }

    // Return the complete response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({
        response: fullResponse,
        sessionId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in conversation handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to process conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Build system prompt based on context
 */
function buildSystemPrompt(context: SpecificationContext): string {
  const basePrompt = SYSTEM_PROMPTS[context.specType];
  
  let contextInfo = '';
  if (context.projectName) {
    contextInfo += `\nProject: ${context.projectName}`;
  }
  if (context.projectDescription) {
    contextInfo += `\nProject Description: ${context.projectDescription}`;
  }
  
  // Add codebase context if available
  if (context.codebaseContext) {
    contextInfo += '\n\n## Codebase Context';
    
    if (context.codebaseContext.techStack) {
      const techStack = context.codebaseContext.techStack;
      contextInfo += '\n\n### Technology Stack';
      
      if (techStack.languages?.length) {
        contextInfo += `\n- Languages: ${techStack.languages.join(', ')}`;
      }
      if (techStack.frameworks?.length) {
        contextInfo += `\n- Frameworks: ${techStack.frameworks.join(', ')}`;
      }
      if (techStack.buildTools?.length) {
        contextInfo += `\n- Build Tools: ${techStack.buildTools.join(', ')}`;
      }
    }
    
    if (context.codebaseContext.patterns) {
      const patterns = context.codebaseContext.patterns;
      contextInfo += '\n\n### Code Patterns';
      
      if (patterns.architecturePattern) {
        contextInfo += `\n- Architecture: ${patterns.architecturePattern}`;
      }
      if (patterns.testingStrategy) {
        contextInfo += `\n- Testing: ${patterns.testingStrategy}`;
      }
    }
    
    if (context.codebaseContext.integrationPoints?.length) {
      contextInfo += '\n\n### Key Integration Points';
      context.codebaseContext.integrationPoints.slice(0, 5).forEach((point: any) => {
        contextInfo += `\n- ${point.file}: ${point.purpose}`;
      });
    }
    
    if (context.codebaseContext.relevantFiles?.length) {
      contextInfo += '\n\n### Relevant Files';
      context.codebaseContext.relevantFiles.slice(0, 10).forEach((file: string) => {
        contextInfo += `\n- ${file}`;
      });
    }
  }
  
  if (context.existingContent) {
    contextInfo += `\n\n## Current Draft\n${context.existingContent}`;
  }

  const instructions = context.codebaseContext
    ? `\n\nPlease help the user build a comprehensive ${context.specType} specification by:
- Asking questions and making suggestions
- Following the existing code patterns and conventions from the codebase
- Considering the current technology stack and architecture
- Suggesting integration with existing components where appropriate
- Structuring the content in markdown format`
    : `\n\nPlease help the user build a comprehensive ${context.specType} specification by asking questions, making suggestions, and helping structure the content in markdown format.`;

  return `${basePrompt}${contextInfo}${instructions}`;
}
