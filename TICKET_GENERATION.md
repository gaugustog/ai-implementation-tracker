# Ticket Generation System - Complete Implementation Guide

## Overview

This document describes the comprehensive ticket generation system powered by Amazon Bedrock Claude models. The system automatically breaks down specifications into atomic, implementable tickets with detailed execution plans.

## Architecture

### Components

1. **Lambda Function** (`amplify/functions/ticket-generation/`)
   - Multi-step processing pipeline
   - Bedrock integration with multiple Claude models
   - S3 file management
   - Retry logic and error handling

2. **API Route** (`app/api/ticket-generation/`)
   - Next.js API endpoint
   - Request proxying to Lambda
   - Mock responses for development

3. **React Hooks** (`lib/hooks/useTicketGeneration.ts`)
   - `useTicketGeneration` - Main hook for ticket generation
   - `useTicketApproval` - Hook for managing ticket approval and editing

4. **UI Components** (`components/tickets/`)
   - `TicketGenerationView` - Main view for ticket generation workflow
   - `TicketCard` - Individual ticket display and editing

5. **Utilities** (`lib/utils/cost-tracking.ts`)
   - Cost estimation and tracking
   - Token optimization strategies
   - CloudWatch metrics helpers

## Data Schema

### Epic Model

```typescript
Epic: {
  title: string (required)
  epicNumber: integer (required)
  description: string
  specificationId: id (required)
  specification: belongsTo('Specification')
  tickets: hasMany('Ticket')
  createdAt: datetime
  updatedAt: datetime
}
```

### Enhanced Ticket Model

```typescript
Ticket: {
  title: string (required)
  ticketNumber: integer (required)
  epicNumber: integer
  description: string
  s3MdFileObjectKey: string // S3 file key for markdown file
  acceptanceCriteria: string[] // Array of strings
  estimatedMinutes: integer
  complexity: enum('simple', 'medium', 'complex')
  parallelizable: boolean (default: false)
  aiAgentCapable: boolean (default: false)
  requiredExpertise: string[] // Array of strings
  testingStrategy: string
  rollbackPlan: string
  status: enum('todo', 'in_progress', 'done')
  specType: enum('ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS')
  fileKey: string // S3 file key for markdown file
  specificationId: id
  specification: belongsTo('Specification')
  dependencies: hasMany('TicketDependency', 'ticketId')
  dependentTickets: hasMany('TicketDependency', 'dependsOnId')
  createdAt: datetime
  updatedAt: datetime
}
```

### TicketDependency Model

```typescript
TicketDependency: {
  ticketId: id (required)
  ticket: belongsTo('Ticket')
  dependsOnId: id (required)
  dependsOn: belongsTo('Ticket')
  dependencyType: enum('blocks', 'requires', 'relates_to') (default: 'blocks')
  createdAt: datetime
}
```

## Pipeline Steps

The ticket generation pipeline executes the following steps:

### Step 1: Parse Specification
- **Model**: Claude Opus (complex analysis)
- **Purpose**: Extract key requirements, components, dependencies, and risks
- **Output**: Structured analysis in JSON format

### Step 2: Identify Components
- **Model**: Claude Opus
- **Purpose**: Identify components/modules that need implementation or modification
- **Output**: Array of components with complexity and dependencies

### Step 3: Generate Tickets
- **Model**: Claude Sonnet (ticket generation)
- **Purpose**: Create atomic, implementable tickets from components
- **Requirements**:
  - Each ticket ≤ 3 days of work (1440 minutes)
  - Clear acceptance criteria
  - Portuguese (pt-BR) language
- **Output**: Array of GeneratedTicket objects

### Step 4: Group into Epics
- **Model**: Claude Opus
- **Purpose**: Group related tickets into logical epics
- **Criteria**:
  - Related components/modules
  - Similar objectives
  - Complete functionality
  - Max 10 tickets per epic
- **Output**: Array of Epic objects

### Step 5: Analyze Dependencies
- **Model**: Claude Opus
- **Purpose**: Identify technical dependencies and critical path
- **Output**: Dependency graph with:
  - Dependency matrix
  - Critical path
  - Parallel groups
  - Blockers

### Step 6: Optimize Parallelization
- **Model**: Claude Opus
- **Purpose**: Optimize for parallel execution with AI agents
- **Considerations**:
  - Claude model recommendations (Opus/Sonnet/Haiku)
  - Parallelization capability
  - Dependencies
  - Load balancing
- **Output**: Optimized tickets with recommendations

### Step 7: Generate SUMMARY.md
- **Model**: Claude Sonnet
- **Purpose**: Create executive summary document
- **Content**:
  1. Executive summary (2-3 paragraphs)
  2. Ticket breakdown (by type, complexity, AI capability)
  3. Critical path identification
  4. Risk assessment matrix
  5. Resource requirements
  6. Timeline estimation (with confidence levels)
- **Language**: Portuguese (pt-BR)

### Step 8: Generate EXECUTION_PLAN.md
- **Model**: Claude Sonnet
- **Purpose**: Create detailed implementation roadmap
- **Content**:
  1. Parallel execution tracks (AI agents, human devs, stakeholders)
  2. Sequential dependencies mapping
  3. Agent assignment recommendations
  4. Integration and sync points
  5. Testing and validation checkpoints
  6. Rollback strategies
  7. Visual timeline
- **Language**: Portuguese (pt-BR)

### Step 9: Save Ticket Files to S3
- **Purpose**: Store individual ticket markdown files
- **Naming Convention**: `{CC}-{NNN}-{EE}-{description}.md`
  - CC: 2-letter plan name prefix
  - NNN: 3-digit ticket number (001-999)
  - EE: 2-digit epic number (01-99)
  - description: Slugified short description (max 50 chars)
- **Example**: `AU-001-01-configurar-estrutura.md`

## S3 File Organization

```
/specs/{spec-id}/
  ├── specification.md         # Original specification
  ├── SUMMARY.md              # Executive summary
  ├── EXECUTION_PLAN.md       # Detailed execution plan
  └── tickets/
      ├── AU-001-01-scaffolding.md
      ├── AU-002-01-form-creation.md
      ├── AU-003-02-validation.md
      └── ...
```

## Model Selection Strategy

### Claude Opus 4 (anthropic.claude-opus-4-20250514-v1:0)
**Use for**: Complex analysis and strategic planning
- Specification parsing
- Component identification
- Dependency analysis
- Parallelization optimization
- Epic grouping

**Pricing**: $15/M input tokens, $75/M output tokens

### Claude Sonnet 3.5 (anthropic.claude-3-5-sonnet-20241022-v2:0)
**Use for**: Content generation and implementation planning
- Ticket description generation
- SUMMARY.md creation
- EXECUTION_PLAN.md creation
- Standard documentation

**Pricing**: $3/M input tokens, $15/M output tokens

### Claude Haiku 3.5 (anthropic.claude-3-5-haiku-20241022-v1:0)
**Use for**: Simple code exploration and basic tasks
- File navigation
- Simple code analysis
- Quick validations

**Pricing**: $0.8/M input tokens, $4/M output tokens

## Cost Optimization

### Token Optimization Strategies

1. **Truncation**: Limit content to token budget
2. **Summarization**: Compress conversation history
3. **Context Pruning**: Remove less critical information
4. **Selective History**: Include only relevant messages

### Estimated Costs

For a typical specification (2000 tokens):
- **Total Pipeline Cost**: ~$1.50 - $3.00 USD
- **Breakdown**:
  - Parse Specification: $0.30
  - Identify Components: $0.25
  - Generate Tickets: $0.40
  - Group into Epics: $0.20
  - Analyze Dependencies: $0.25
  - Optimize Parallelization: $0.30
  - Generate Summary: $0.25
  - Generate Execution Plan: $0.25

## API Usage

### Request Format

```typescript
POST /api/ticket-generation

{
  specificationId: string;
  specificationContent: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  planNamePrefix: string; // e.g., "AU" for Authentication
  projectContext?: {
    techStack?: any;
    patterns?: any;
    integrationPoints?: any;
  };
}
```

### Response Format

```typescript
{
  tickets: GeneratedTicket[];
  epics: Epic[];
  summaryPath: string; // S3 path
  executionPlanPath: string; // S3 path
  dependencyGraph: {
    dependencyMatrix: number[][];
    criticalPath: number[];
    parallelGroups: number[][];
    blockers: number[];
  };
}
```

## React Hook Usage

### Basic Usage

```typescript
import { useTicketGeneration } from '@/lib/hooks/useTicketGeneration';

function MyComponent() {
  const { generateTickets, isGenerating, result, error } = useTicketGeneration({
    onSuccess: (result) => {
      console.log('Generated tickets:', result.tickets);
    },
    onError: (error) => {
      console.error('Generation failed:', error);
    },
  });

  const handleGenerate = async () => {
    await generateTickets({
      specificationId: 'spec-123',
      specificationContent: 'My specification content...',
      specType: 'ANALYSIS',
      planNamePrefix: 'AU',
    });
  };

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Tickets'}
    </button>
  );
}
```

### Ticket Approval Hook

```typescript
import { useTicketApproval } from '@/lib/hooks/useTicketGeneration';

function TicketReview({ tickets }) {
  const {
    editedTickets,
    approvedTickets,
    updateTicket,
    approveTicket,
    approveAll,
    allApproved,
  } = useTicketApproval(tickets);

  return (
    <div>
      <button onClick={approveAll} disabled={allApproved}>
        Approve All
      </button>
      {editedTickets.map(ticket => (
        <div key={ticket.ticketNumber}>
          <h3>{ticket.title}</h3>
          <button onClick={() => approveTicket(ticket.ticketNumber)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}
```

## UI Components

### TicketGenerationView

Main container component for the entire ticket generation workflow.

**Props:**
```typescript
{
  specificationId: string;
  specificationContent: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  planNamePrefix: string;
  projectContext?: any;
  onSave?: (tickets: GeneratedTicket[], epics: Epic[]) => Promise<void>;
}
```

**Features:**
- Cost estimation display
- Ticket generation trigger
- Progress indication
- Ticket review and approval
- Summary and execution plan download
- Dependency graph visualization

### TicketCard

Individual ticket display and editing component.

**Props:**
```typescript
{
  ticket: GeneratedTicket;
  isApproved: boolean;
  onApprove: (ticketNumber: number) => void;
  onUnapprove: (ticketNumber: number) => void;
  onUpdate: (ticketNumber: number, updates: Partial<GeneratedTicket>) => void;
  showDependencies?: boolean;
}
```

**Features:**
- Inline editing
- Approval/unapproval
- Collapsible acceptance criteria
- Complexity and time indicators
- Dependency display

## Deployment

### Prerequisites

1. **AWS Account** with permissions for:
   - Amazon Bedrock
   - Lambda
   - S3
   - IAM
   - CloudWatch

2. **Bedrock Model Access**:
   - Navigate to Amazon Bedrock console
   - Request access to:
     - Claude Opus 4
     - Claude Sonnet 3.5
     - Claude Haiku 3.5
   - Wait for approval

### Deployment Steps

1. **Deploy Amplify Backend**:
```bash
cd amplify
npm install
npm run sandbox  # For development
# or
npm run deploy   # For production
```

2. **Configure Environment Variables**:
```bash
# .env.local
TICKET_GENERATION_LAMBDA_URL=https://your-function-url.lambda-url.us-east-1.on.aws/
STORAGE_BUCKET_NAME=your-s3-bucket-name
```

3. **Verify Deployment**:
- Check Lambda function is created
- Verify IAM permissions (Bedrock, S3, DynamoDB)
- Test function URL with curl or Postman

### Testing the Lambda Function

```bash
curl -X POST https://your-function-url.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "specificationId": "test-123",
    "specificationContent": "Implementar sistema de autenticação...",
    "specType": "ANALYSIS",
    "planNamePrefix": "AU"
  }'
```

## Development Mode

In development (without AWS deployment), the system uses mock responses:

1. API route detects missing `TICKET_GENERATION_LAMBDA_URL`
2. Returns contextual mock responses
3. Full UI functionality works without Bedrock

**Benefits:**
- Develop UI without AWS costs
- Test ticket review workflow
- Demo the feature

**Limitations:**
- No real AI generation
- Fixed response templates
- No actual S3 storage

## Monitoring and Debugging

### Lambda Logs

```bash
# View logs in CloudWatch
aws logs tail /aws/lambda/ticket-generation --follow
```

### Cost Tracking

The system automatically tracks:
- Token usage per operation
- Cost per model
- Total cost per generation

**CloudWatch Metrics:**
- `BedrockCost` - Cost per operation
- `BedrockTokens_input` - Input tokens used
- `BedrockTokens_output` - Output tokens generated

### Common Issues

**Issue**: "Bedrock access denied"
- **Solution**: Check IAM permissions and Bedrock model access

**Issue**: "Lambda timeout"
- **Solution**: Increase timeout (current: 900s) or optimize prompts

**Issue**: "Failed to parse Bedrock response"
- **Solution**: Check CloudWatch logs for raw response, adjust parsing logic

**Issue**: "S3 upload failed"
- **Solution**: Verify S3 bucket permissions and `STORAGE_BUCKET_NAME` env var

## Quality Validation

The system ensures:

1. **Ticket Size**: No ticket exceeds 1440 minutes (3 days)
2. **Atomicity**: Each ticket is independently implementable
3. **Clarity**: All tickets have clear acceptance criteria
4. **Dependencies**: Accurately identified and mapped
5. **Optimization**: Critical path is minimized
6. **Language**: All content in Portuguese (pt-BR)

## Error Handling

### Retry Logic

- **Attempts**: 3 retries per Bedrock call
- **Backoff**: Exponential (2^attempt * 1000ms)
- **Errors Caught**: Network, throttling, service errors

### Fallback Strategies

1. **Token Limit Exceeded**: Truncate content, retry
2. **Model Unavailable**: Switch to alternative model
3. **Parse Error**: Extract JSON from markdown code blocks
4. **S3 Upload Failure**: Continue pipeline, log error

## Security Considerations

1. **IAM Permissions**: Lambda has minimal required permissions
2. **Function URL**: Public access - add authentication for production
3. **Input Validation**: All inputs validated in API route
4. **Error Messages**: Sensitive information not exposed
5. **S3 Bucket**: Ensure proper bucket policies and encryption

## Future Enhancements

1. **Streaming Responses**: Real-time token streaming for better UX
2. **Advanced Visualizations**: Interactive dependency graphs (D3.js, Mermaid)
3. **Template Library**: Pre-built ticket templates
4. **Version History**: Track and restore previous generations
5. **Collaboration**: Multi-user review and approval
6. **Auto-save**: Periodic saving of progress
7. **Export Formats**: PDF, DOCX, HTML exports
8. **Fine-tuning**: Custom models for specific domains
9. **Integration**: Jira, GitHub Issues, Azure DevOps sync
10. **Analytics**: Dashboard for ticket metrics and trends

## License

This implementation follows the same license as the main project (MIT).

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Review this documentation
3. Check AWS Bedrock service status
4. Open an issue in the repository
