# Git Repository Integration Guide

This guide explains how to integrate Git repositories with the AI Implementation Tracker to enable context-aware specification generation using Amazon Bedrock.

## Overview

The Git integration feature allows the AI specification assistant to understand your actual codebase structure, existing patterns, and technical stack when creating specifications. This results in more accurate, context-aware specifications that align with your existing code.

## Features

### 1. Repository Connection
- Connect GitHub repositories (private and public)
- OAuth2 authentication with personal access tokens
- Branch selection (main, master, develop, etc.)
- Automatic repository synchronization

### 2. Codebase Analysis
- **Technology Stack Detection**: Automatically identifies languages, frameworks, and build tools
- **Pattern Recognition**: Detects architectural patterns (MVC, Clean Architecture, etc.)
- **Integration Points**: Identifies key files and their purposes
- **Code Metrics**: Calculates file counts and language breakdown

### 3. Context-Aware Specifications
- AI receives codebase context when generating specifications
- Suggestions follow existing code patterns and conventions
- Integration with current architecture is considered
- Relevant files are identified based on specification type

### 4. Security
- Access tokens encrypted with AWS KMS
- Webhook signature validation
- Secure HTTPS connections for all Git operations
- No tokens stored in plain text

## Getting Started

### Prerequisites

1. **GitHub Account**: You need a GitHub account with access to the repository
2. **Personal Access Token**: Generate a token with `repo` scope
3. **AWS Backend Deployed**: The Amplify backend must be deployed (or use mock mode for development)

### Step 1: Generate a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give your token a descriptive name (e.g., "AI Implementation Tracker")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - For webhooks (optional): `admin:repo_hook`
5. Click "Generate token"
6. **Important**: Copy the token immediately - you won't be able to see it again!

### Step 2: Connect Your Repository

1. Navigate to your project in the application
2. Click the settings icon on the project card
3. Go to the "Git Integration" tab
4. Enter your repository information:
   - **Repository URL**: `https://github.com/owner/repo`
   - **Access Token**: Paste your personal access token
   - **Branch**: Select the branch to analyze (usually `main` or `master`)
5. Click "Connect Repository"

The system will:
- Validate your token and repository access
- Create an encrypted record of your repository
- Trigger an initial sync and analysis

### Step 3: View Codebase Context

1. After the repository is connected, switch to the "Codebase Context" tab
2. Wait for the initial analysis to complete (usually takes 1-2 minutes)
3. Explore the detected:
   - **Technology Stack**: Languages, frameworks, build tools
   - **Code Patterns**: Architecture patterns and testing strategies
   - **Integration Points**: Key files and their purposes
   - **Metrics**: File counts and language breakdown

### Step 4: Create Context-Aware Specifications

1. Navigate to the Specifications page
2. Create a new specification for your project
3. The AI will automatically use the codebase context to:
   - Suggest implementations that match your tech stack
   - Follow your existing code patterns
   - Recommend integration with existing components
   - Structure specifications appropriately

## Architecture

### Backend Components

#### 1. Git Integration Lambda Function
**Location**: `amplify/functions/git-integration/`

**Responsibilities**:
- Connect to GitHub repositories
- Clone or pull repository contents
- Manage encrypted access tokens
- Trigger analysis pipeline

**Operations**:
- `connect`: Authenticate and link repository
- `sync`: Pull latest changes and update snapshot
- `disconnect`: Remove repository connection

#### 2. Code Analyzer Lambda Function
**Location**: `amplify/functions/code-analyzer/`

**Responsibilities**:
- Analyze repository file structure
- Detect technologies and patterns
- Calculate code metrics
- Generate project context for AI

**Operations**:
- `analyze`: Analyze a code snapshot
- `getContext`: Retrieve context for specification generation

#### 3. Data Schema

**GitRepository Model**:
```typescript
{
  projectId: string;
  provider: 'github';
  repoUrl: string;
  branch: string;
  accessTokenHash: string;  // Encrypted
  webhookSecret: string;
  lastSyncedAt: datetime;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  lastCommitHash: string;
}
```

**CodeSnapshot Model**:
```typescript
{
  repositoryId: string;
  commitHash: string;
  fileTreeKey: string;      // S3 key for file tree JSON
  metricsKey: string;       // S3 key for metrics JSON
  analysisComplete: boolean;
}
```

**ProjectContext Model**:
```typescript
{
  projectId: string;
  techStack: {
    languages: string[];
    frameworks: string[];
    buildTools: string[];
  };
  patterns: {
    architecturePattern: string;
    testingStrategy: string;
  };
  integrationPoints: Array<{
    file: string;
    purpose: string;
  }>;
}
```

### Frontend Components

#### GitIntegrationPanel
**Location**: `components/git/GitIntegrationPanel.tsx`

A React component for managing repository connections:
- Repository URL input
- Access token input (secured)
- Branch selection
- Connect/Sync/Disconnect actions
- Status indicators

#### CodebaseContextViewer
**Location**: `components/git/CodebaseContextViewer.tsx`

A React component for visualizing analysis results:
- Accordion-style sections
- Tech stack badges
- Pattern information
- Integration points list
- Code metrics

### API Routes

#### `/api/git` (POST)
Handles Git operations:
- `operation: 'connect'` - Connect a repository
- `operation: 'sync'` - Sync repository changes
- `operation: 'disconnect'` - Disconnect repository

#### `/api/code-analyzer` (POST)
Handles code analysis:
- `operation: 'analyze'` - Analyze a snapshot
- `operation: 'getContext'` - Get project context

#### `/api/webhooks/github` (POST)
GitHub webhook handler:
- Validates webhook signatures
- Handles push events
- Triggers automatic sync

## Token Optimization

The system implements several strategies to optimize token usage:

### 1. Smart File Selection
- Only relevant files are included in context
- Files are ranked by relevance to specification type
- Maximum of 20 files included per specification

### 2. Specification Type Filtering
Different types of specifications focus on different files:
- **ANALYSIS**: README, package.json, schema files
- **FIXES**: Test files, error logs
- **PLANS**: Architecture and design docs
- **REVIEWS**: Source code files

### 3. Context Summarization
- Tech stack summarized into bullet points
- Only top 5 integration points included
- Patterns condensed into key information

## Security Best Practices

### 1. Token Management
- **Never commit tokens** to your repository
- Rotate tokens periodically (every 90 days recommended)
- Use tokens with minimal required permissions
- Delete tokens when no longer needed

### 2. Repository Access
- Only connect repositories you have permission to access
- Be aware that the system will read all files in the repository
- Exclude sensitive directories (automatically excluded: node_modules, .env, etc.)

### 3. Webhook Security
- Webhook signatures are validated using HMAC SHA-256
- Only authorized webhooks are processed
- Set a strong webhook secret in GitHub

## Development Mode

For development without AWS deployment, the system provides mock responses:

```typescript
// Mock Git integration responses
{
  connect: { repositoryId: 'repo-mock-...', branch: 'main' }
  sync: { snapshotId: 'snapshot-mock-...', commitHash: 'abc123' }
}

// Mock code analysis responses
{
  techStack: { languages: ['TypeScript'], frameworks: ['Next.js'] }
  patterns: { architecturePattern: 'Component-based' }
  integrationPoints: [...]
}
```

This allows you to:
- Develop UI without AWS costs
- Test the integration flow
- Demo the feature to stakeholders

## Troubleshooting

### Issue: "Invalid GitHub token"
**Solution**:
- Ensure token has `repo` scope
- Check token hasn't expired
- Verify token is for the correct GitHub account

### Issue: "Repository not found"
**Solution**:
- Check repository URL is correct
- Ensure you have access to the repository
- For private repos, verify token has appropriate permissions

### Issue: "Sync failed"
**Solution**:
- Check Lambda function logs in CloudWatch
- Verify network connectivity
- Ensure repository size is reasonable (< 500 MB recommended)

### Issue: "Analysis incomplete"
**Solution**:
- Wait a few minutes for analysis to complete
- Check code-analyzer Lambda logs
- Verify S3 bucket has sufficient space

## Limitations

### Current Limitations
1. **GitHub Only**: Currently only GitHub is supported (GitLab, Bitbucket coming soon)
2. **Branch Switching**: Requires disconnect and reconnect to change branches
3. **Large Repositories**: Repositories > 1 GB may have performance issues
4. **File Size**: Individual files > 10 MB are skipped in analysis
5. **Languages**: Best support for JavaScript/TypeScript, Python, Java

### Future Enhancements
- Support for GitLab, Bitbucket, AWS CodeCommit
- Semantic code search using embeddings
- Dependency analysis and vulnerability scanning
- Pull request integration for specification review
- Automated specification updates on code changes
- Multi-branch analysis and comparison

## API Reference

### Connect Repository

```typescript
POST /api/git
{
  "operation": "connect",
  "projectId": "project-123",
  "repoUrl": "https://github.com/owner/repo",
  "accessToken": "ghp_xxxxxxxxxxxx",
  "branch": "main"
}

Response:
{
  "repositoryId": "repo-456",
  "message": "Repository connected successfully",
  "branch": "main"
}
```

### Sync Repository

```typescript
POST /api/git
{
  "operation": "sync",
  "repositoryId": "repo-456"
}

Response:
{
  "message": "Repository synced successfully",
  "snapshotId": "snapshot-789",
  "commitHash": "abc123def456"
}
```

### Get Codebase Context

```typescript
POST /api/code-analyzer
{
  "operation": "getContext",
  "projectId": "project-123",
  "specificationType": "ANALYSIS"
}

Response:
{
  "context": {
    "techStack": {...},
    "patterns": {...},
    "integrationPoints": [...],
    "relevantFiles": [...]
  },
  "lastAnalyzedAt": "2024-01-01T12:00:00Z"
}
```

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Review this documentation
3. Check AWS Bedrock service status
4. Open an issue in the repository

## License

This integration follows the same license as the main project (MIT).
