# Quick Start Guide - AWS Amplify Integration

This guide helps you quickly get started with the AWS Amplify Gen2 integration.

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Deploy Amplify Backend
```bash
cd amplify
npm run sandbox
```

Wait for deployment to complete (~3-5 minutes). This creates:
- AppSync GraphQL API
- S3 bucket for files
- API key for access

### Step 3: Run the App
```bash
cd ..
npm run dev
```

Visit http://localhost:3000

## 📊 What You Get

### Without Backend Deployment
- ✅ UI works perfectly
- ⚠️ Shows "placeholder configuration" warnings
- ❌ Cannot save data

### With Backend Deployed
- ✅ Full functionality
- ✅ Data persists in AWS
- ✅ File uploads to S3
- ✅ Real-time updates

## 🎯 Key Features

### Projects
- Create and manage projects
- View project listings
- All data stored in AppSync/DynamoDB

### Specifications
- Four types: ANALYSIS, FIXES, PLANS, REVIEWS
- Upload markdown content
- Files stored in S3 at `specs/*.md`
- Metadata in AppSync

### Tickets
- Track todo, in-progress, done status
- Optional markdown files
- Files stored in S3 at `tickets/*.md`
- Link to specifications

## 🔑 API Usage Examples

### Create a Project
```typescript
import { projectAPI } from '@/lib/api/amplify';

const project = await projectAPI.create({
  name: 'My Project',
  description: 'A new project'
});
```

### Create a Specification with File
```typescript
import { specificationAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath } from '@/lib/api/storage';

// Upload markdown file
const content = '# Analysis\n\n## Overview\nDetails...';
const filePath = generateFilePath('specs', 'analysis.md');
await uploadMarkdownFile(filePath, content);

// Create specification record
const spec = await specificationAPI.create({
  type: 'ANALYSIS',
  content: content,
  fileKey: filePath,
  projectId: project.id
});
```

### Create a Ticket
```typescript
import { ticketAPI } from '@/lib/api/amplify';

const ticket = await ticketAPI.create({
  title: 'Implement feature X',
  description: 'Details about the task',
  status: 'todo',
  specType: 'PLANS',
  specificationId: spec.id
});
```

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Deploy Amplify backend (sandbox)
cd amplify && npm run sandbox

# Deploy Amplify backend (production)
cd amplify && npm run deploy
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `amplify/backend.ts` | Main backend configuration |
| `amplify/data/resource.ts` | AppSync data schema |
| `amplify/storage/resource.ts` | S3 storage config |
| `lib/api/amplify.ts` | API operations |
| `lib/api/storage.ts` | File operations |
| `amplify_outputs.json` | Generated config (don't commit) |

## ⚠️ Common Issues

### "Failed to load projects"
**Cause**: Backend not deployed  
**Solution**: Run `cd amplify && npm run sandbox`

### "Module not found: amplify_outputs.json"
**Cause**: Backend not deployed  
**Solution**: Deploy backend, or use placeholder file

### Storage upload errors
**Cause**: S3 bucket not created  
**Solution**: Ensure backend deployment completed successfully

## 🔒 Security Note

**Current Setup**: Public API with no authentication
- Anyone with the API key can access data
- Suitable for development/demo
- **For production**: Add Cognito authentication

To add authentication:
1. Update `amplify/data/resource.ts`
2. Change authorization mode from `apiKey` to `userPool`
3. Add Cognito user pool configuration

## 📚 Learn More

- [Full Setup Guide](./AMPLIFY_SETUP.md)
- [Main README](./README.md)
- [AWS Amplify Docs](https://docs.amplify.aws/react/)

## 🎉 You're Ready!

Your application is now integrated with AWS Amplify Gen2. Deploy the backend and start building!
