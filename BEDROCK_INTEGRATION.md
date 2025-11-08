# Amazon Bedrock Claude Integration - Specification Assistant

This document describes the Amazon Bedrock Claude integration for AI-powered specification building.

## Overview

The Specification Assistant uses Amazon Bedrock with Claude to provide an interactive, conversational interface for building comprehensive specifications. Users can chat with the AI to iteratively develop specifications, with real-time markdown preview and editing capabilities.

## Features

### 1. Interactive Specification Builder
- **Conversational Interface**: Chat-based UI for natural specification development
- **Real-time Preview**: See specification content build as you chat
- **Markdown Editor**: Direct editing with preview mode
- **Multi-Type Support**: Tailored assistance for ANALYSIS, FIXES, PLANS, and REVIEWS

### 2. Context-Aware AI
- **Project Context**: AI understands project details and history
- **Session Management**: Maintains conversation context across interactions
- **Type-Specific Prompts**: Different AI behavior for each specification type
- **Smart Suggestions**: Contextual recommendations based on conversation

### 3. Specification Evolution
- **Iterative Refinement**: Build specifications through multiple chat turns
- **Direct Editing**: Manually edit AI-generated content
- **Version Control**: Track conversation history and drafts
- **Export Options**: Download as markdown or save to database

## Architecture

### Backend Components

#### 1. Lambda Function (`amplify/functions/specification-conversation/`)
```
specification-conversation/
├── handler.ts          # Main Bedrock integration logic
├── resource.ts         # CDK resource definition
└── package.json        # Dependencies
```

**Key Features:**
- Integrates with Amazon Bedrock Runtime
- Uses Claude 3.5 Sonnet model
- Handles conversation history
- Type-specific system prompts
- Error handling and logging

#### 2. Data Schema (`amplify/data/resource.ts`)
New `SpecificationDraft` model:
```typescript
SpecificationDraft: a.model({
  content: a.string(),
  conversationHistory: a.json(),
  aiSuggestions: a.json(),
  version: a.integer(),
  projectId: a.id().required(),
  project: a.belongsTo('Project', 'projectId'),
  status: a.enum(['draft', 'reviewing', 'finalized']),
  type: a.enum(['ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS']),
  sessionId: a.string(),
  createdAt: a.datetime(),
  updatedAt: a.datetime(),
})
```

#### 3. Backend Configuration (`amplify/backend.ts`)
- Function definition with Bedrock permissions
- IAM policies for `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`
- Function URL for HTTP access
- CORS configuration

### Frontend Components

#### 1. API Route (`app/api/conversation/route.ts`)
- Next.js Edge API route
- Proxies requests to Lambda function
- Mock responses for development
- CORS handling

#### 2. React Hook (`lib/hooks/useSpecificationConversation.ts`)
```typescript
useSpecificationConversation({
  context: SpecificationContext,
  sessionId?: string,
  initialMessages?: ConversationMessage[],
  onMessage?: (message: ConversationMessage) => void
})
```

**Returns:**
- `messages`: Conversation history
- `isLoading`: Request status
- `error`: Error messages
- `sendMessage`: Send a message to AI
- `clearMessages`: Clear conversation
- `currentDraft`: Current specification content
- `sessionId`: Session identifier

#### 3. UI Components (`components/specification/`)

**SpecificationChat**
- Chat interface with message bubbles
- Input field with send button
- Auto-scroll to latest message
- Loading and error states

**MarkdownEditor**
- Tab-based editor/preview interface
- Syntax highlighting (basic)
- Full-height editor
- Preview rendering

**SpecificationBuilder**
- Main container component
- Project selector
- Type selector
- Save/Download actions
- Split view: Chat + Editor
- Quick start prompts

## Usage

### Basic Usage

```typescript
import { SpecificationBuilder } from '@/components/specification/SpecificationBuilder';

function MyPage() {
  const project = { /* project data */ };

  const handleSave = async (content: string, type: SpecType) => {
    // Save to database and S3
    await saveSpecification(content, type);
  };

  return (
    <SpecificationBuilder
      project={project}
      onSave={handleSave}
      initialContent=""
      initialType="ANALYSIS"
    />
  );
}
```

### Using the Hook Directly

```typescript
import { useSpecificationConversation } from '@/lib/hooks/useSpecificationConversation';

function MyComponent() {
  const { messages, sendMessage, isLoading } = useSpecificationConversation({
    context: {
      projectId: 'proj-123',
      projectName: 'My Project',
      specType: 'ANALYSIS',
    },
  });

  const handleSend = async () => {
    await sendMessage('Help me define requirements');
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}
```

## Deployment

### Prerequisites

1. **AWS Account** with permissions for:
   - Amazon Bedrock
   - Lambda
   - IAM
   - AppSync
   - S3

2. **Bedrock Model Access**:
   - Navigate to Amazon Bedrock console
   - Request access to Claude 3.5 Sonnet model
   - Wait for approval (usually immediate for most regions)

### Deployment Steps

1. **Deploy Amplify Backend**:
```bash
cd amplify
npm run sandbox  # For development
# or
npm run deploy   # For production
```

2. **Configure Environment Variables**:
After deployment, the Lambda function URL will be in the outputs. Set it:
```bash
# .env.local
BEDROCK_LAMBDA_URL=https://your-function-url.lambda-url.us-east-1.on.aws/
```

3. **Verify Deployment**:
- Check Lambda function is created
- Verify IAM permissions
- Test function URL with curl or Postman

### Testing the Lambda Function

```bash
curl -X POST https://your-function-url.lambda-url.us-east-1.on.aws/ \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Help me create an analysis specification",
    "conversationHistory": [],
    "context": {
      "projectId": "test-123",
      "projectName": "Test Project",
      "specType": "ANALYSIS"
    },
    "sessionId": "test-session"
  }'
```

## Development Mode

In development (without AWS deployment), the system uses mock responses:

1. API route detects missing `BEDROCK_LAMBDA_URL`
2. Returns contextual mock responses based on spec type
3. Full UI functionality works without Bedrock

**Benefits:**
- Develop UI without AWS costs
- Test conversation flow
- Demo the feature

**Limitations:**
- No real AI assistance
- Fixed response templates
- No conversation memory

## Specification Types

### ANALYSIS
**Purpose**: Requirements analysis and system design

**AI Behavior**:
- Asks clarifying questions about requirements
- Identifies missing or ambiguous requirements
- Suggests technical considerations
- Structures analysis with standard sections

**Example Prompts**:
- "Help me define the functional requirements"
- "What technical constraints should I consider?"
- "Help me create user stories"

### FIXES
**Purpose**: Bug fixes and issue resolutions

**AI Behavior**:
- Helps identify root causes
- Suggests comprehensive fix approaches
- Considers edge cases and side effects
- Structures fix documentation

**Example Prompts**:
- "Help me describe the problem in detail"
- "Let's analyze the root cause"
- "What testing should we do?"

### PLANS
**Purpose**: Implementation plans and roadmaps

**AI Behavior**:
- Breaks down work into logical phases
- Identifies dependencies and risks
- Suggests realistic timelines
- Structures plan with standard sections

**Example Prompts**:
- "Help me break this into phases"
- "What risks should we consider?"
- "Help me plan resources and timeline"

### REVIEWS
**Purpose**: Code and design reviews

**AI Behavior**:
- Identifies potential issues and improvements
- Suggests best practices
- Considers maintainability and scalability
- Structures review with findings

**Example Prompts**:
- "Help me review the code quality"
- "Let's review the architecture"
- "What security concerns should we check?"

## Token Optimization

The system implements several token optimization strategies:

1. **Conversation Summarization**: Long conversations can be summarized
2. **Context Pruning**: Old messages can be removed while preserving key context
3. **Selective History**: Only relevant turns included in API calls
4. **Efficient Prompts**: System prompts are concise but comprehensive

## Security Considerations

1. **IAM Permissions**: Lambda has minimal required Bedrock permissions
2. **Function URL**: Public access - consider adding authentication for production
3. **API Key**: AppSync uses API key - secure for appropriate use cases
4. **Input Validation**: API route validates all inputs
5. **Error Handling**: Sensitive information not exposed in errors

## Cost Optimization

1. **Model Selection**: Claude 3.5 Sonnet balances cost and performance
2. **Token Limits**: Maximum 4096 tokens per response
3. **Caching**: Consider implementing response caching
4. **Development Mode**: Use mocks to avoid costs during development

## Monitoring and Debugging

### Lambda Logs
```bash
# View logs in CloudWatch
aws logs tail /aws/lambda/specification-conversation --follow
```

### Frontend Debugging
- Browser console shows API calls
- Network tab shows request/response
- React DevTools for component state

### Common Issues

**Issue**: "Lambda function URL not configured"
- **Solution**: Set `BEDROCK_LAMBDA_URL` environment variable

**Issue**: "Bedrock access denied"
- **Solution**: Check IAM permissions and Bedrock model access

**Issue**: "No response from AI"
- **Solution**: Check Lambda logs for errors

## Future Enhancements

1. **Streaming Responses**: Real-time token streaming for better UX
2. **Conversation Branching**: Create multiple draft versions
3. **Template Library**: Pre-built specification templates
4. **Collaboration**: Multi-user editing and commenting
5. **Version History**: Track and restore previous versions
6. **Auto-save**: Periodic saving of drafts
7. **Export Formats**: PDF, DOCX, HTML export options
8. **AI Improvements**: Fine-tuned models for specific domains

## API Reference

### POST /api/conversation

**Request:**
```typescript
{
  message: string;
  conversationHistory: ConversationMessage[];
  context: SpecificationContext;
  sessionId: string;
}
```

**Response:**
```typescript
{
  response: string;
  sessionId: string;
  timestamp: string;
}
```

**Error Response:**
```typescript
{
  error: string;
  details?: string;
}
```

## License

This integration follows the same license as the main project (MIT).

## Support

For issues or questions:
1. Check CloudWatch logs for Lambda errors
2. Review this documentation
3. Check AWS Bedrock service status
4. Open an issue in the repository
