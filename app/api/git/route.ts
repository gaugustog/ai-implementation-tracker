import { NextRequest, NextResponse } from 'next/server';

const GIT_INTEGRATION_URL = process.env.GIT_INTEGRATION_URL || '';
const DEBUG = process.env.DEBUG_GIT_INTEGRATION === 'true';

const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log('[GitAPI]', ...args);
  }
};

/**
 * API route for Git integration operations
 * Handles connect, sync, and disconnect operations
 */
export async function POST(request: NextRequest) {
  debugLog('POST request received');

  try {
    const body = await request.json();
    const { operation, repositoryId, projectId, repoUrl, accessToken, branch } = body;

    debugLog('Request body:', {
      operation,
      repositoryId,
      projectId,
      repoUrl,
      branch,
      hasAccessToken: !!accessToken
    });

    if (!operation) {
      debugLog('Missing operation parameter');
      return NextResponse.json(
        { error: 'Missing operation parameter' },
        { status: 400 }
      );
    }

    // If no Lambda URL configured, return mock response for development
    if (!GIT_INTEGRATION_URL) {
      debugLog('No Lambda URL configured, using mock response');
      return getMockResponse(operation, body);
    }

    debugLog('Forwarding to Lambda:', GIT_INTEGRATION_URL);

    // Forward request to Lambda function
    const lambdaBody = {
      operation,
      repositoryId,
      projectId,
      repoUrl,
      accessToken,
      branch,
    };

    debugLog('Lambda request body:', { ...lambdaBody, accessToken: accessToken ? '***' : undefined });

    const response = await fetch(GIT_INTEGRATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lambdaBody),
    });

    debugLog('Lambda response status:', response.status);

    const data = await response.json();
    debugLog('Lambda response data:', data);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error in git API:', error);
    debugLog('Error details:', error);
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
function getMockResponse(operation: string, body: Record<string, unknown>) {
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

    case 'changeBranch':
      return NextResponse.json({
        message: 'Branch changed successfully (mock)',
        branch: body.branch,
      });

    case 'getByProject':
      return NextResponse.json({
        repository: {
          id: 'mock-repo-123',
          projectId: body.projectId,
          repoUrl: 'https://github.com/mock/repo',
          branch: 'main',
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
          lastCommitHash: 'abc123',
        },
      });

    case 'getBranches':
      return NextResponse.json({
        branches: ['main', 'develop', 'feature/test', 'hotfix/bug'],
        currentBranch: 'main',
      });

    default:
      return NextResponse.json(
        { error: 'Invalid operation' },
        { status: 400 }
      );
  }
}
