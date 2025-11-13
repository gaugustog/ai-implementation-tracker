# AWS Amplify Gen2 Integration

This document describes the AWS Amplify Gen2 integration for the AI Implementation Tracker application.

## Overview

The application has been integrated with AWS Amplify Gen2 to provide:
- **AWS AppSync** for GraphQL API and data management
- **Amazon S3** for storing markdown files (.md) for specifications and tickets
- **Public API** with no authentication required

## Architecture

### Data Models

The application uses three main data models managed by AppSync:

1. **Project**
   - Basic project information
   - Has many Specifications

2. **Specification**
   - Specification details (ANALYSIS, FIXES, PLANS, REVIEWS)
   - Belongs to a Project
   - Has many Tickets
   - Contains optional reference to markdown file in S3

3. **Ticket**
   - Ticket information with status tracking
   - Belongs to a Specification (optional)
   - Contains optional reference to markdown file in S3

### Storage

Amazon S3 is used to store markdown files for:
- Specifications: `specs/*.md`
- Tickets: `tickets/*.md`

All files are publicly accessible (no authentication required).

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- AWS account with appropriate permissions
- AWS CLI configured (optional, but recommended)

### 1. Install Dependencies

Dependencies are already installed via `npm install`.

### 2. Configure AWS Amplify Backend

The Amplify backend is configured in the `amplify/` directory:
- `amplify/backend.ts` - Main backend configuration
- `amplify/data/resource.ts` - AppSync data schema
- `amplify/storage/resource.ts` - S3 storage configuration

### 3. Deploy the Backend

To deploy the Amplify backend to AWS:

```bash
cd amplify
npm run sandbox
```

This will:
1. Deploy AppSync API with the data schema
2. Create S3 bucket for file storage
3. Generate `amplify_outputs.json` with connection details

For production deployment:

```bash
cd amplify
npm run deploy
```

### 4. Update Configuration

After deployment, copy the generated `amplify_outputs.json` to the project root:

```bash
cp amplify/amplify_outputs.json ../amplify_outputs.json
```

### 5. Run the Application

```bash
npm run dev
```

The application will now use AWS AppSync for data and S3 for file storage.

## File Structure

```
amplify/
├── backend.ts              # Main backend configuration
├── data/
│   └── resource.ts         # AppSync data schema
├── storage/
│   └── resource.ts         # S3 storage configuration
├── package.json
└── tsconfig.json

lib/
├── amplify-config.ts       # Amplify client configuration
├── api/
│   ├── amplify.ts         # AppSync API utilities
│   ├── storage.ts         # S3 storage utilities
│   └── claude.ts          # Mock Claude CLI integration
└── types/
    └── index.ts           # TypeScript type definitions

components/
└── AmplifyProvider.tsx    # Amplify context provider
```

## API Usage

### Projects

```typescript
import { projectAPI } from '@/lib/api/amplify';

// List all projects
const projects = await projectAPI.list();

// Create a project
const project = await projectAPI.create({
  name: 'My Project',
  description: 'Project description',
});

// Get a project
const project = await projectAPI.get(projectId);

// Update a project
const updated = await projectAPI.update(projectId, {
  name: 'Updated Name',
});

// Delete a project
await projectAPI.delete(projectId);
```

### Specifications

```typescript
import { specificationAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath } from '@/lib/api/storage';

// Create a specification with markdown file
const content = '# Specification\n\nDetails...';
const filePath = generateFilePath('specs', 'my-spec.md');
await uploadMarkdownFile(filePath, content);

const spec = await specificationAPI.create({
  type: 'ANALYSIS',
  content: content,
  fileKey: filePath,
  projectId: projectId,
});

// List specifications
const specs = await specificationAPI.list();

// List specifications for a project
const projectSpecs = await specificationAPI.list(projectId);
```

### Tickets

```typescript
import { ticketAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath } from '@/lib/api/storage';

// Create a ticket with markdown file
const content = '# Ticket\n\nTask details...';
const filePath = generateFilePath('tickets', 'my-ticket.md');
await uploadMarkdownFile(filePath, content);

const ticket = await ticketAPI.create({
  title: 'My Ticket',
  description: 'Ticket description',
  status: 'todo',
  specType: 'ANALYSIS',
  fileKey: filePath,
  specificationId: specId,
});

// List all tickets
const tickets = await ticketAPI.list();

// Update ticket status
await ticketAPI.update(ticketId, {
  status: 'done',
});
```

### Storage Operations

```typescript
import {
  uploadMarkdownFile,
  downloadMarkdownFile,
  deleteFile,
  listFiles,
  generateFilePath,
} from '@/lib/api/storage';

// Upload a file
const path = generateFilePath('specs', 'analysis.md');
await uploadMarkdownFile(path, '# Analysis\n\nContent...');

// Download a file
const content = await downloadMarkdownFile(path);

// Delete a file
await deleteFile(path);

// List files in a directory
const files = await listFiles('specs/');
```

## Authorization

The application uses API Key authorization mode with public access. No authentication is required.

To modify authorization settings, edit `amplify/data/resource.ts`:

```typescript
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
```

## Environment Variables

The application uses `amplify_outputs.json` for configuration. This file is generated after deploying the backend and should not be committed to version control in production (it's already in `.gitignore`).

## Development vs Production

### Development
- Use `npm run sandbox` in the `amplify/` directory
- Uses temporary cloud resources
- Ideal for testing and development

### Production
- Use `npm run deploy` in the `amplify/` directory
- Creates permanent cloud resources
- Recommended for production deployments

## Troubleshooting

### Error: "Failed to load projects/specifications/tickets"

This error appears when:
1. The Amplify backend hasn't been deployed yet
2. The `amplify_outputs.json` file is missing or incorrect

**Solution**: Deploy the backend using `npm run sandbox` or `npm run deploy` in the `amplify/` directory.

### Error: "Module not found: amplify_outputs.json"

The application includes a placeholder `amplify_outputs.json` file. To use the actual backend:

1. Deploy the backend: `cd amplify && npm run sandbox`
2. Copy the generated outputs: `cp amplify_outputs.json ../`

### Storage Upload Errors

Ensure the S3 bucket has been created and has the correct permissions:
- Check `amplify/storage/resource.ts` for configuration
- Verify guest access is enabled for `specs/*` and `tickets/*` paths

## Next Steps

1. Deploy the Amplify backend to AWS
2. Test CRUD operations for projects, specifications, and tickets
3. Test file upload/download for markdown files
4. Consider adding authentication for production use
5. Implement real-time subscriptions for collaborative features

## Additional Resources

- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/react/)
- [AppSync GraphQL API](https://docs.aws.amazon.com/appsync/)
- [S3 Storage](https://docs.aws.amazon.com/s3/)
