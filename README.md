# Spec-Driven Development Tracker

A Next.js dashboard application for managing spec-driven development projects with AWS Amplify Gen2 integration.

## Features

- 🎨 **Modern UI**: Built with Material UI 7.2+ and Tailwind CSS v4
- 🌙 **Dark Mode**: Full dark theme with zinc and rose color palette
- 📊 **Dashboard**: Overview of projects, specifications, and tickets
- 📁 **Project Management**: Create and manage development projects
- 📝 **Specification Management**: Organize specs by type (ANALYSIS, FIXES, PLANS, REVIEWS)
- 🎫 **Ticket System**: Break down specifications into actionable tickets
- 🤖 **AI-Powered Specifications**: Interactive specification builder with Amazon Bedrock
- 🎯 **AI Ticket Generation**: Automated ticket generation with Claude Opus, Sonnet, and Haiku
- 📋 **Epic Management**: Intelligent grouping of related tickets
- 🔄 **Dependency Tracking**: Automated dependency analysis and critical path identification
- 🚀 **Execution Planning**: AI-generated implementation roadmaps with parallelization strategies
- 🔗 **Git Integration**: Connect GitHub repositories for context-aware AI assistance
- ☁️ **AWS Amplify Gen2**: Backend powered by AppSync and S3 storage
- 📄 **Markdown Files**: Store specifications and tickets as .md files in S3
- 💰 **Cost Tracking**: Token usage and cost estimation for Bedrock operations

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router)
- **UI Library**: Material UI 7.2+
- **Styling**: Tailwind CSS v4 with dark mode
- **Icons**: Lucide React
- **Language**: TypeScript
- **Backend**: AWS Amplify Gen2
- **API**: AWS AppSync (GraphQL)
- **Storage**: Amazon S3

## Getting Started

### Prerequisites

- Node.js 18+ installed
- AWS account (for backend deployment)
- AWS CLI configured (optional)

### Installation

First, install dependencies:

```bash
npm install
```

### AWS Amplify Setup

To use the full backend capabilities, you need to deploy the AWS Amplify backend:

```bash
cd amplify
npm run sandbox
```

This will deploy:
- AppSync GraphQL API for data management
- S3 bucket for markdown file storage
- API key for public access (no authentication)

After deployment, the generated `amplify_outputs.json` will be automatically used by the application.

For detailed setup instructions, see [AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md).

### Run Development Server

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
├── app/                      # Next.js app directory
│   ├── projects/            # Projects page
│   ├── specifications/      # Specifications page
│   ├── tickets/             # Tickets page
│   ├── settings/            # Settings page
│   ├── layout.tsx           # Root layout with sidebar and header
│   └── page.tsx             # Dashboard home page
├── amplify/                 # AWS Amplify Gen2 backend
│   ├── backend.ts          # Backend configuration
│   ├── data/               # AppSync data schema
│   ├── storage/            # S3 storage configuration
│   └── functions/          # Lambda functions
│       ├── specification-conversation/  # Bedrock AI integration
│       ├── git-integration/            # Git repository operations
│       ├── code-analyzer/              # Codebase analysis
│       └── ticket-generation/          # AI ticket generation pipeline
├── components/
│   ├── layout/              # Layout components
│   │   ├── Header.tsx       # Top navigation bar
│   │   └── Sidebar.tsx      # Side navigation menu
│   ├── git/                 # Git integration components
│   │   ├── GitIntegrationPanel.tsx    # Repository connection UI
│   │   └── CodebaseContextViewer.tsx  # Analysis results viewer
│   ├── specification/       # Specification components
│   │   ├── SpecificationBuilder.tsx   # Main builder with AI chat
│   │   ├── SpecificationChat.tsx      # Chat interface
│   │   └── MarkdownEditor.tsx         # Editor with preview
│   ├── tickets/             # Ticket components
│   │   ├── TicketGenerationView.tsx   # Main ticket generation UI
│   │   └── TicketCard.tsx             # Individual ticket display
│   ├── AmplifyProvider.tsx  # Amplify context provider
│   └── ThemeRegistry.tsx    # Material UI theme provider
├── lib/
│   ├── amplify-config.ts    # Amplify client configuration
│   ├── api/                 # API utilities
│   │   ├── amplify.ts       # AppSync API operations
│   │   ├── storage.ts       # S3 storage operations
│   │   └── claude.ts        # Claude CLI integration (mock)
│   ├── hooks/               # React hooks
│   │   ├── useSpecificationConversation.ts  # AI chat hook
│   │   └── useTicketGeneration.ts           # Ticket generation hook
│   ├── utils/               # Utility functions
│   │   └── cost-tracking.ts # Cost and token optimization
│   └── types/               # TypeScript type definitions
│       └── index.ts
└── public/                  # Static assets
```

## Specification Types

The application manages four types of specifications:

- **ANALYSIS**: Requirements analysis and system design
- **FIXES**: Bug fixes and issue resolutions
- **PLANS**: Implementation plans and roadmaps
- **REVIEWS**: Code and design reviews

Each specification:
- Can be stored as a markdown file in S3
- Can be broken down into multiple tickets
- Is associated with a project

## Data Management

### Local Development
Without AWS backend deployment, the app will show placeholder messages. Deploy the Amplify backend to enable full functionality.

### With AWS Backend
- **Projects**: Stored in AppSync (DynamoDB)
- **Specifications**: Metadata in AppSync, content in S3 as .md files
- **Tickets**: Metadata in AppSync, content in S3 as .md files
- **No Authentication**: Public API key access for simplicity

## AWS Amplify Integration

The application uses AWS Amplify Gen2 with:
- **AppSync**: GraphQL API for managing projects, specifications, and tickets
- **S3**: Storage for markdown files and codebase snapshots
- **Lambda**: Serverless functions for AI chat and Git integration
- **API Key**: Public access without authentication
- **Bedrock**: Amazon Bedrock with Claude for AI-powered specifications

See [AMPLIFY_SETUP.md](./AMPLIFY_SETUP.md) for detailed setup instructions.
See [BEDROCK_INTEGRATION.md](./BEDROCK_INTEGRATION.md) for Bedrock integration details.
See [GIT_INTEGRATION.md](./GIT_INTEGRATION.md) for Git integration guide.
See [TICKET_GENERATION.md](./TICKET_GENERATION.md) for AI ticket generation system.

## AI-Powered Ticket Generation

The application includes a comprehensive AI-powered ticket generation system that automatically breaks down specifications into atomic, implementable tickets with detailed execution plans.

### Key Features:
- **8-Step Pipeline**: Automated analysis, component identification, ticket generation, dependency mapping, and optimization
- **Multi-Model Strategy**: Uses Claude Opus for complex analysis, Sonnet for content generation, and Haiku for exploration
- **Intelligent Grouping**: Automatically organizes tickets into logical epics
- **Dependency Analysis**: Identifies dependencies and generates critical path
- **Parallelization Optimization**: Recommends parallel execution strategies for AI agents
- **Cost Tracking**: Estimates and tracks token usage and costs
- **Portuguese Support**: All generated content in pt-BR

### Generated Outputs:
1. **Atomic Tickets**: Small, implementable tasks (max 3 days each)
2. **SUMMARY.md**: Executive summary with ticket breakdown and risk assessment
3. **EXECUTION_PLAN.md**: Detailed implementation roadmap with parallel tracks

### Usage:
```typescript
import { useTicketGeneration } from '@/lib/hooks/useTicketGeneration';

const { generateTickets, result } = useTicketGeneration();

await generateTickets({
  specificationId: 'spec-001',
  specificationContent: 'Your specification...',
  specType: 'ANALYSIS',
  planNamePrefix: 'AU',
});
```

For comprehensive documentation and examples, see:
- [TICKET_GENERATION.md](./TICKET_GENERATION.md) - Complete implementation guide
- [TICKET_GENERATION_EXAMPLES.md](./TICKET_GENERATION_EXAMPLES.md) - Usage examples
- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Implementation summary

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Start Production Server

```bash
npm start
```

## Customization

### Theme Colors

The application uses a zinc and rose color palette. To customize:

Edit `app/globals.css` to change CSS variables:
- `--primary`: Rose accent color (default: #f43f5e)
- `--background`: Main background (default: #18181b)
- `--card`: Card background (default: #27272a)

### Material UI Theme

Edit `components/ThemeRegistry.tsx` to customize Material UI theme settings.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## License

MIT

