import { NextRequest, NextResponse } from 'next/server';

const GIT_INTEGRATION_URL = process.env.GIT_INTEGRATION_URL || '';

/**
 * API route for Git integration operations
 * Handles connect, sync, and disconnect operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, repositoryId, projectId, repoUrl, accessToken, branch } = body;

    if (!operation) {
      return NextResponse.json(
        { error: 'Missing operation parameter' },
        { status: 400 }
      );
    }

    // If no Lambda URL configured, return mock response for development
    if (!GIT_INTEGRATION_URL) {
      return getMockResponse(operation, body);
    }

    // Forward request to Lambda function
    const response = await fetch(GIT_INTEGRATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation,
        repositoryId,
        projectId,
        repoUrl,
        accessToken,
        branch,
      }),
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error in git API:', error);
    return NextResponse.json(
      {
        error: 'Failed to process git operation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
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
 * Mock responses for development
 */
function getMockResponse(operation: string, body: any) {
  switch (operation) {
    case 'connect':
      return NextResponse.json({
        repositoryId: `repo-mock-${Date.now()}`,
        message: 'Repository connected successfully (mock)',
        branch: body.branch || 'main',
      });

    case 'sync':
      return NextResponse.json({
        message: 'Repository synced successfully (mock)',
        snapshotId: `snapshot-mock-${Date.now()}`,
        commitHash: 'abc123',
      });

    case 'disconnect':
      return NextResponse.json({
        message: 'Repository disconnected successfully (mock)',
      });

    default:
      return NextResponse.json(
        { error: 'Invalid operation' },
        { status: 400 }
      );
  }
}
