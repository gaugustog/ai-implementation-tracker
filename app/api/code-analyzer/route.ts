import { NextRequest, NextResponse } from 'next/server';

const CODE_ANALYZER_URL = process.env.CODE_ANALYZER_URL || '';

/**
 * API route for code analysis operations
 * Handles analyze and getContext operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, snapshotId, repositoryId, projectId, specificationType, keywords } = body;

    if (!operation) {
      return NextResponse.json(
        { error: 'Missing operation parameter' },
        { status: 400 }
      );
    }

    // If no Lambda URL configured, return mock response for development
    if (!CODE_ANALYZER_URL) {
      return getMockResponse(operation, body);
    }

    // Forward request to Lambda function
    const response = await fetch(CODE_ANALYZER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation,
        snapshotId,
        repositoryId,
        projectId,
        specificationType,
        keywords,
      }),
    });

    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error in code analyzer API:', error);
    return NextResponse.json(
      {
        error: 'Failed to process analysis',
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
function getMockResponse(operation: string, _body: Record<string, unknown>) {
  switch (operation) {
    case 'analyze':
      return NextResponse.json({
        message: 'Analysis complete (mock)',
        metrics: {
          totalFiles: 150,
          languageBreakdown: {
            '.ts': 80,
            '.tsx': 40,
            '.json': 15,
            '.md': 10,
            '.css': 5,
          },
        },
        techStack: {
          languages: ['TypeScript', 'JavaScript'],
          frameworks: ['Next.js', 'React'],
          buildTools: ['npm', 'Webpack'],
          packageManagers: ['npm'],
        },
        patterns: {
          architecturePattern: 'Component-based',
          testingStrategy: 'Unit Testing',
        },
      });

    case 'getContext':
      return NextResponse.json({
        context: {
          techStack: {
            languages: ['TypeScript', 'JavaScript'],
            frameworks: ['Next.js', 'React'],
            buildTools: ['npm', 'Webpack'],
            packageManagers: ['npm'],
          },
          patterns: {
            architecturePattern: 'Component-based',
            testingStrategy: 'Unit Testing',
            namingConventions: ['camelCase for variables', 'PascalCase for components'],
          },
          integrationPoints: [
            { file: 'package.json', purpose: 'Node.js dependencies and scripts' },
            { file: 'next.config.ts', purpose: 'Next.js configuration' },
            { file: 'app/api', purpose: 'API routes' },
            { file: 'components', purpose: 'React components' },
            { file: 'lib', purpose: 'Utility libraries' },
          ],
          relevantFiles: [
            'README.md',
            'package.json',
            'tsconfig.json',
            'next.config.ts',
          ],
          metrics: {
            totalFiles: 150,
            languageBreakdown: {
              '.ts': 80,
              '.tsx': 40,
              '.json': 15,
            },
          },
        },
        lastAnalyzedAt: new Date().toISOString(),
      });

    default:
      return NextResponse.json(
        { error: 'Invalid operation' },
        { status: 400 }
      );
  }
}
