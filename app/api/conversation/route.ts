import { NextRequest, NextResponse } from 'next/server';
import type { ConversationRequest, ConversationResponse } from '@/lib/types';

export const runtime = 'edge';

/**
 * API route for specification conversations with Bedrock Claude
 * This acts as a proxy to the Lambda function and handles CORS
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConversationRequest = await request.json();

    // Validate request
    if (!body.message || !body.context || !body.sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, context, or sessionId' },
        { status: 400 }
      );
    }

    // In development, return a mock response
    // In production, this would call the Lambda function URL
    if (process.env.NODE_ENV === 'development' && !process.env.BEDROCK_LAMBDA_URL) {
      const mockResponse: ConversationResponse = {
        response: generateMockResponse(body),
        sessionId: body.sessionId,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(mockResponse, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Call the Lambda function
    const lambdaUrl = process.env.BEDROCK_LAMBDA_URL || process.env.NEXT_PUBLIC_BEDROCK_LAMBDA_URL;
    
    if (!lambdaUrl) {
      return NextResponse.json(
        { error: 'Lambda function URL not configured. Set BEDROCK_LAMBDA_URL environment variable.' },
        { status: 500 }
      );
    }

    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Lambda function error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in conversation API:', error);
    return NextResponse.json(
      {
        error: 'Failed to process conversation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Generate a mock response for development
 */
function generateMockResponse(request: ConversationRequest): string {
  const { context, message, conversationHistory } = request;
  const specType = context.specType;

  // Generate contextual mock response based on spec type
  const responses = {
    ANALYSIS: `Great! Let's build your ${specType} specification.

Based on your input: "${message}"

I'd like to help you create a comprehensive requirements analysis. Here are some questions to consider:

1. **Functional Requirements**: What are the core features and capabilities needed?
2. **Non-Functional Requirements**: What about performance, security, and scalability?
3. **User Stories**: Who are the primary users and what do they need to accomplish?
4. **Technical Constraints**: Are there any technology or platform constraints?
5. **Dependencies**: What external systems or services will this integrate with?

Would you like me to help structure these into a detailed specification document?`,

    FIXES: `I understand you want to document a fix for: "${message}"

Let's structure this fix specification properly:

1. **Problem Statement**: Can you describe the issue in detail?
2. **Root Cause**: What's causing the problem?
3. **Proposed Solution**: What's the recommended fix?
4. **Impact Analysis**: What areas of the system will be affected?
5. **Testing Strategy**: How should we verify the fix works?

Should we start with the problem statement?`,

    PLANS: `Excellent! Let's create an implementation plan for: "${message}"

To build a comprehensive plan, I need to understand:

1. **Project Goals**: What are we trying to achieve?
2. **Scope**: What's included and what's out of scope?
3. **Milestones**: What are the key delivery points?
4. **Resources**: What team members and tools are needed?
5. **Timeline**: What's the expected duration?
6. **Risks**: What could go wrong and how do we mitigate?

Shall we start by defining the goals and scope?`,

    REVIEWS: `Let's conduct a thorough review of: "${message}"

A good review should cover:

1. **Code Quality**: Is the code clean, maintainable, and following best practices?
2. **Architecture**: Is the design sound and scalable?
3. **Performance**: Are there any performance concerns?
4. **Security**: Are there security vulnerabilities?
5. **Testing**: Is there adequate test coverage?
6. **Documentation**: Is the code well-documented?

Which aspects would you like me to focus on first?`,
  };

  return responses[specType] || `I'm here to help you create a ${specType} specification. How can I assist you?`;
}
