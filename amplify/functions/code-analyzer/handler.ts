import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME || '';
const BUCKET_NAME = process.env.BUCKET_NAME || '';

interface AnalysisEvent {
  operation: 'analyze' | 'getContext';
  repositoryId?: string;
  snapshotId?: string;
  projectId?: string;
  specificationType?: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  keywords?: string[];
}

interface TechStack {
  languages: string[];
  frameworks: string[];
  buildTools: string[];
  packageManagers: string[];
  databases: string[];
}

interface CodeMetrics {
  totalFiles: number;
  totalLines: number;
  languageBreakdown: Record<string, number>;
  largestFiles: Array<{ path: string; lines: number }>;
}

interface ProjectContextData {
  techStack: TechStack;
  dependencies: Record<string, any>;
  fileStructure: any;
  patterns: {
    namingConventions: string[];
    architecturePattern: string;
    testingStrategy: string;
  };
  integrationPoints: Array<{ file: string; purpose: string }>;
}

/**
 * Main handler for code analysis operations
 */
export const handler = async (event: any) => {
  console.log('Code Analyzer Event:', JSON.stringify(event, null, 2));

  try {
    const request: AnalysisEvent = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event.body || event;

    switch (request.operation) {
      case 'analyze':
        return await handleAnalyze(request);
      case 'getContext':
        return await handleGetContext(request);
      default:
        return createResponse(400, { error: 'Invalid operation' });
    }
  } catch (error) {
    console.error('Error in code analyzer:', error);
    return createResponse(500, {
      error: 'Failed to process analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Analyze a code snapshot
 */
async function handleAnalyze(request: AnalysisEvent) {
  const { snapshotId, repositoryId } = request;

  if (!snapshotId || !repositoryId) {
    return createResponse(400, { error: 'Missing snapshotId or repositoryId' });
  }

  try {
    // Get snapshot from DynamoDB
    const { Item: snapshot } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: snapshotId },
    }));

    if (!snapshot) {
      return createResponse(404, { error: 'Snapshot not found' });
    }

    // Get file tree from S3
    const fileTreeResponse = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: snapshot.fileTreeKey,
    }));

    const fileTreeData = await streamToString(fileTreeResponse.Body);
    const fileTree = JSON.parse(fileTreeData);

    // Analyze the codebase
    const techStack = detectTechStack(fileTree);
    const metrics = calculateMetrics(fileTree);
    const patterns = detectPatterns(fileTree);
    const integrationPoints = identifyIntegrationPoints(fileTree);
    const dependencies = await extractDependencies(fileTree);

    // Build project context
    const projectContext: ProjectContextData = {
      techStack,
      dependencies,
      fileStructure: fileTree,
      patterns,
      integrationPoints,
    };

    // Store metrics in S3
    const metricsKey = `git/${repositoryId}/metrics-${Date.now()}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: metricsKey,
      Body: JSON.stringify({ metrics, techStack, patterns }),
      ContentType: 'application/json',
    }));

    // Update snapshot with metrics reference
    await dynamoClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: snapshotId },
      UpdateExpression: 'SET metricsKey = :metricsKey, analysisComplete = :complete',
      ExpressionAttributeValues: {
        ':metricsKey': metricsKey,
        ':complete': true,
      },
    }));

    // Get repository to find projectId
    const { Item: repository } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: repositoryId },
    }));

    // Create or update ProjectContext
    if (repository?.projectId) {
      const contextId = `context-${repository.projectId}`;
      await dynamoClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          id: contextId,
          projectId: repository.projectId,
          techStack: projectContext.techStack,
          dependencies: projectContext.dependencies,
          fileStructure: projectContext.fileStructure,
          patterns: projectContext.patterns,
          integrationPoints: projectContext.integrationPoints,
          lastAnalyzedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));
    }

    return createResponse(200, {
      message: 'Analysis complete',
      metrics,
      techStack,
      patterns,
    });
  } catch (error) {
    console.error('Error analyzing code:', error);
    return createResponse(500, {
      error: 'Failed to analyze code',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get project context for specification generation
 */
async function handleGetContext(request: AnalysisEvent) {
  const { projectId, specificationType, keywords } = request;

  if (!projectId) {
    return createResponse(400, { error: 'Missing projectId' });
  }

  try {
    // Get project context
    const contextId = `context-${projectId}`;
    const { Item: context } = await dynamoClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: contextId },
    }));

    if (!context) {
      return createResponse(404, { error: 'Project context not found' });
    }

    // Select relevant files based on specification type and keywords
    const relevantFiles = selectRelevantFiles(
      context.fileStructure,
      specificationType || 'ANALYSIS',
      keywords || []
    );

    // Build context for Bedrock
    const bedrockContext = {
      techStack: context.techStack,
      patterns: context.patterns,
      integrationPoints: context.integrationPoints,
      relevantFiles,
      dependencies: context.dependencies,
    };

    return createResponse(200, {
      context: bedrockContext,
      lastAnalyzedAt: context.lastAnalyzedAt,
    });
  } catch (error) {
    console.error('Error getting context:', error);
    return createResponse(500, {
      error: 'Failed to get context',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Helper functions
 */

function detectTechStack(fileTree: any[]): TechStack {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const buildTools = new Set<string>();
  const packageManagers = new Set<string>();
  const databases = new Set<string>();

  function traverse(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        // Detect languages by extension
        const ext = path.extname(node.name).toLowerCase();
        const langMap: Record<string, string> = {
          '.ts': 'TypeScript',
          '.tsx': 'TypeScript',
          '.js': 'JavaScript',
          '.jsx': 'JavaScript',
          '.py': 'Python',
          '.java': 'Java',
          '.go': 'Go',
          '.rb': 'Ruby',
          '.php': 'PHP',
          '.cs': 'C#',
          '.cpp': 'C++',
          '.c': 'C',
          '.rs': 'Rust',
          '.swift': 'Swift',
          '.kt': 'Kotlin',
        };

        if (langMap[ext]) {
          languages.add(langMap[ext]);
        }

        // Detect frameworks and tools by filename
        const name = node.name.toLowerCase();
        if (name === 'package.json') packageManagers.add('npm');
        if (name === 'requirements.txt' || name === 'pipfile') packageManagers.add('pip');
        if (name === 'composer.json') packageManagers.add('composer');
        if (name === 'go.mod') packageManagers.add('go modules');
        if (name === 'cargo.toml') packageManagers.add('cargo');
        
        if (name === 'next.config.js' || name === 'next.config.ts') frameworks.add('Next.js');
        if (name === 'nuxt.config.js') frameworks.add('Nuxt.js');
        if (name === 'angular.json') frameworks.add('Angular');
        if (name === 'vue.config.js') frameworks.add('Vue.js');
        if (name === 'svelte.config.js') frameworks.add('Svelte');
        
        if (name === 'webpack.config.js') buildTools.add('Webpack');
        if (name === 'vite.config.js' || name === 'vite.config.ts') buildTools.add('Vite');
        if (name === 'tsconfig.json') buildTools.add('TypeScript');
        if (name === 'dockerfile') buildTools.add('Docker');
      }

      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(fileTree);

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    buildTools: Array.from(buildTools),
    packageManagers: Array.from(packageManagers),
    databases: Array.from(databases),
  };
}

function calculateMetrics(fileTree: any[]): CodeMetrics {
  let totalFiles = 0;
  const languageBreakdown: Record<string, number> = {};

  function traverse(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        totalFiles++;
        const ext = path.extname(node.name);
        languageBreakdown[ext] = (languageBreakdown[ext] || 0) + 1;
      }

      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(fileTree);

  return {
    totalFiles,
    totalLines: 0, // Would need to read files to count
    languageBreakdown,
    largestFiles: [],
  };
}

function detectPatterns(fileTree: any[]): any {
  const patterns = {
    namingConventions: [] as string[],
    architecturePattern: 'unknown',
    testingStrategy: 'unknown',
  };

  // Simple pattern detection based on directory structure
  const dirNames = new Set<string>();
  
  function collectDirs(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'directory') {
        dirNames.add(node.name.toLowerCase());
      }
      if (node.children) {
        collectDirs(node.children);
      }
    }
  }

  collectDirs(fileTree);

  // Detect architecture patterns
  if (dirNames.has('controllers') && dirNames.has('models') && dirNames.has('views')) {
    patterns.architecturePattern = 'MVC';
  } else if (dirNames.has('domain') && dirNames.has('application') && dirNames.has('infrastructure')) {
    patterns.architecturePattern = 'Clean Architecture';
  } else if (dirNames.has('components') || dirNames.has('app')) {
    patterns.architecturePattern = 'Component-based';
  }

  // Detect testing strategy
  if (dirNames.has('__tests__') || dirNames.has('test') || dirNames.has('tests')) {
    patterns.testingStrategy = 'Unit Testing';
  }

  return patterns;
}

function identifyIntegrationPoints(fileTree: any[]): Array<{ file: string; purpose: string }> {
  const integrationPoints: Array<{ file: string; purpose: string }> = [];

  const keyFiles = [
    { name: 'package.json', purpose: 'Node.js dependencies and scripts' },
    { name: 'tsconfig.json', purpose: 'TypeScript configuration' },
    { name: 'next.config.js', purpose: 'Next.js configuration' },
    { name: 'next.config.ts', purpose: 'Next.js configuration' },
    { name: 'amplify', purpose: 'AWS Amplify backend' },
    { name: 'README.md', purpose: 'Project documentation' },
    { name: 'api', purpose: 'API routes' },
    { name: 'components', purpose: 'React components' },
    { name: 'lib', purpose: 'Utility libraries' },
  ];

  function traverse(nodes: any[], currentPath: string = '') {
    for (const node of nodes) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      
      for (const keyFile of keyFiles) {
        if (node.name.toLowerCase() === keyFile.name.toLowerCase()) {
          integrationPoints.push({
            file: nodePath,
            purpose: keyFile.purpose,
          });
        }
      }

      if (node.children) {
        traverse(node.children, nodePath);
      }
    }
  }

  traverse(fileTree);

  return integrationPoints;
}

async function extractDependencies(fileTree: any[]): Promise<Record<string, any>> {
  // In a real implementation, this would read package.json, requirements.txt, etc.
  // For now, just return empty object
  return {};
}

function selectRelevantFiles(
  fileTree: any[],
  specificationType: string,
  keywords: string[]
): string[] {
  const relevantFiles: string[] = [];

  // Define file patterns for each specification type
  const typePatterns: Record<string, string[]> = {
    ANALYSIS: ['README', 'package.json', 'tsconfig', 'schema', 'model'],
    FIXES: ['test', 'spec', 'error', 'bug'],
    PLANS: ['README', 'architecture', 'design', 'roadmap'],
    REVIEWS: ['src', 'lib', 'component', 'service'],
  };

  const patterns = typePatterns[specificationType] || [];
  const allKeywords = [...patterns, ...keywords];

  function traverse(nodes: any[], currentPath: string = '') {
    for (const node of nodes) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      
      if (node.type === 'file') {
        // Check if file matches any keyword
        const matchesKeyword = allKeywords.some(keyword =>
          node.name.toLowerCase().includes(keyword.toLowerCase())
        );

        if (matchesKeyword) {
          relevantFiles.push(nodePath);
        }
      }

      if (node.children) {
        traverse(node.children, nodePath);
      }
    }
  }

  traverse(fileTree);

  // Limit to top 20 most relevant files
  return relevantFiles.slice(0, 20);
}

async function streamToString(stream: any): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function createResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
