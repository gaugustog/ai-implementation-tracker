# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 16 dashboard application for spec-driven development tracking with AWS Amplify Gen2 backend. Uses AppSync (GraphQL) for data management and S3 for markdown file storage.

## Commands

### Development
```bash
npm run dev        # Start Next.js dev server on http://localhost:3000
npm run build      # Build for production
npm start          # Run production server
npm run lint       # Run ESLint
```

### AWS Amplify Backend
```bash
cd amplify && npm run sandbox    # Deploy to AWS sandbox environment
cd amplify && npm run deploy     # Deploy to production environment
```

After deploying, the `amplify_outputs.json` file is auto-generated in the amplify directory and should be copied to the root if needed.

## Architecture

### Tech Stack
- **Framework**: Next.js 16.0.1 with App Router
- **UI**: Material UI 7.2+ (dark mode with zinc/rose palette) + Tailwind CSS v4
- **Backend**: AWS Amplify Gen2 (AppSync + S3)
- **Auth**: Public API Key (no user authentication)
- **TypeScript**: Strict mode enabled

### Data Model Architecture
Three interconnected models in `amplify/data/resource.ts`:

1. **Project** → has many **Specification** → has many **Ticket**
2. Specifications and Tickets store metadata in AppSync (DynamoDB) and full content as markdown files in S3
3. S3 paths: `specs/*.md` for specifications, `tickets/*.md` for tickets

### Key Files Structure
- `amplify/backend.ts` - Amplify backend configuration (data + storage)
- `amplify/data/resource.ts` - GraphQL schema with Project/Specification/Ticket models
- `amplify/storage/resource.ts` - S3 storage config with guest access for specs/ and tickets/
- `lib/amplify-config.ts` - Client-side Amplify configuration
- `lib/api/amplify.ts` - CRUD operations for projects, specifications, tickets (uses generated client)
- `lib/api/storage.ts` - S3 file operations (upload/download/delete markdown files)
- `components/AmplifyProvider.tsx` - Client-side Amplify provider wrapper
- `components/ThemeRegistry.tsx` - Material UI theme config

### Specification Types
Four enum types: `ANALYSIS`, `FIXES`, `PLANS`, `REVIEWS`

Ticket statuses: `todo`, `in-progress`, `done`

### Path Alias
`@/*` maps to the root directory (configured in tsconfig.json)

## AWS Amplify Integration

### Working with Data
API utilities are in `lib/api/amplify.ts`:
```typescript
import { projectAPI, specificationAPI, ticketAPI } from '@/lib/api/amplify';

// All APIs have: list(), create(), get(id), update(id, updates), delete(id)
const projects = await projectAPI.list();
const project = await projectAPI.create({ name: 'Name', description: 'Desc' });
```

### Working with Storage
Storage utilities in `lib/api/storage.ts`:
```typescript
import { uploadMarkdownFile, downloadMarkdownFile, generateFilePath } from '@/lib/api/storage';

const path = generateFilePath('specs', 'my-spec.md');
await uploadMarkdownFile(path, '# Content');
const content = await downloadMarkdownFile(path);
```

### Important Notes
- All data operations use generated Amplify client from `aws-amplify/data`
- File paths are auto-sanitized and timestamped by `generateFilePath()`
- Public API Key auth means no per-user permissions
- `amplify_outputs.json` must exist (deploy backend first) but is gitignored

## Security Considerations

From SECURITY.md:
- Current setup uses **public API key** - suitable for dev/demo only
- For production: implement Cognito auth, add file size limits, enable rate limiting
- No hardcoded secrets - all config in `amplify_outputs.json`
- S3 access restricted to `specs/*` and `tickets/*` paths only
- File names are sanitized before upload to prevent path injection

## Development Notes

- Next.js uses App Router (not Pages Router)
- All components are client components (`'use client'`) when using Amplify hooks
- Material UI theme uses dark mode by default (zinc/rose palette)
- TypeScript is in strict mode - null checks required
- Error handling pattern: check for `errors` array first, then check for `data`
