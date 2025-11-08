# Ticket Generation System - Complete Guide

## Overview

The Intelligent Ticket Generation System uses Amazon Bedrock with Claude AI to automatically break down project specifications into implementable, well-structured tickets. The system analyzes dependencies, optimizes for parallel execution, and generates comprehensive documentation in Portuguese (pt-BR).

## Key Features

### 1. **Atomic Ticket Generation**
- Breaks specifications into 1-3 day implementable tasks
- Each ticket includes detailed acceptance criteria
- Estimates complexity and effort
- Identifies required expertise

### 2. **Intelligent Dependency Analysis**
- Automatically identifies dependencies between tickets
- Creates dependency graphs
- Identifies critical path
- Suggests optimal execution order

### 3. **AI Agent Optimization**
- Identifies tickets that can be implemented by AI agents (like Claude Code)
- Optimizes parallel execution tracks
- Balances workload across available agents
- Recommends agent assignments

### 4. **Comprehensive Documentation**
- **SUMMARY.md**: Executive summary with risk assessment and timeline
- **EXECUTION_PLAN.md**: Detailed implementation roadmap with parallelization strategies
- **Individual Ticket Files**: TICKET-001.md, TICKET-002.md, etc.

### 5. **Portuguese Language Support**
All generated content is in Portuguese (pt-BR) for the ONS team.

## Architecture

### Backend Pipeline (6 Steps)

```typescript
interface TicketGenerationPipeline {
  steps: [
    'parseSpecification',      // Extract key information
    'identifyComponents',      // Break into logical components
    'generateTickets',         // Create detailed tickets
    'analyzeDependencies',     // Analyze relationships
    'optimizeParallelization', // Optimize for AI agents
    'generateDocuments'        // Create markdown files
  ];
}
```

### Bedrock Models Used

1. **Claude 3.5 Sonnet** - Used for:
   - Specification parsing
   - Component identification
   - Ticket generation
   - Dependency analysis
   - Cost-effective for bulk operations

2. **Claude 3 Opus** - Used for:
   - Parallelization optimization (complex reasoning)
   - Document generation (high-quality output)
   - Strategic planning decisions

### S3 File Organization

```
/specs/{spec-id}/
  ├── specification.md        # Original specification
  ├── SUMMARY.md             # Executive summary
  ├── EXECUTION_PLAN.md      # Implementation roadmap
  └── tickets/
      ├── TICKET-001.md      # First ticket
      ├── TICKET-002.md      # Second ticket
      └── ...
```

## Usage

### 1. Frontend Integration

```typescript
import { TicketGenerator } from '@/components/tickets/TicketGenerator';

function SpecificationPage({ specification }) {
  return (
    <TicketGenerator
      specificationId={specification.id}
      specificationContent={specification.content}
      projectContext={specification.project.context}
      onComplete={(generation) => {
        console.log('Generated tickets:', generation.tickets);
        console.log('Cost:', generation.totalCost);
      }}
    />
  );
}
```

### 2. Direct API Call

```bash
curl -X POST https://your-api.com/api/tickets/generate \
  -H "Content-Type: application/json" \
  -d '{
    "specificationId": "spec-123",
    "specificationContent": "# My Specification\n...",
    "projectContext": {
      "techStack": { "languages": ["TypeScript", "Python"] }
    },
    "language": "pt-BR"
  }'
```

### 3. Lambda Function Direct Invocation

```bash
aws lambda invoke \
  --function-name ticket-generation \
  --payload '{"body":"{\"specificationId\":\"spec-123\",...}"}' \
  response.json
```

## Generated Ticket Structure

Each ticket includes:

```typescript
interface GeneratedTicket {
  title: string;                    // Clear, concise title
  description: string;              // Detailed work description
  acceptanceCriteria: string[];     // Verifiable criteria
  estimatedHours: number;           // 8-72 hours (1-3 days)
  complexity: 'simple' | 'medium' | 'complex';
  dependencies: string[];           // Other ticket IDs
  parallelizable: boolean;          // Can run in parallel
  aiAgentCapable: boolean;          // AI can implement
  requiredExpertise: string[];      // Skills needed
  testingStrategy: string;          // How to test
  rollbackPlan: string;             // Recovery strategy
}
```

## SUMMARY.md Structure

The generated summary includes:

1. **Resumo Executivo** (2-3 paragraphs)
   - Project overview
   - Main objectives
   - Key challenges

2. **Breakdown de Tickets**
   - Total count
   - Distribution by complexity
   - Distribution by type

3. **Caminho Crítico**
   - Critical path tickets
   - Estimated duration
   - Bottlenecks

4. **Matriz de Risco**
   | Risco | Probabilidade | Impacto | Mitigação |
   |-------|---------------|---------|-----------|
   | ...   | ...           | ...     | ...       |

5. **Requisitos de Recursos**
   - Developers needed
   - AI agents needed
   - Required specialties

6. **Estimativa de Timeline**
   - Sequential duration
   - Parallel duration
   - Confidence level

## EXECUTION_PLAN.md Structure

The execution plan includes:

1. **Trilhas de Execução Paralela**
   - Track 1: Frontend tickets
   - Track 2: Backend tickets
   - Track 3: Infrastructure tickets

2. **Dependências Sequenciais**
   - Dependency graph
   - Sequential constraints

3. **Recomendações de Atribuição de Agentes**
   | Ticket | Agente Recomendado | Motivo |
   |--------|-------------------|--------|
   | ...    | ...               | ...    |

4. **Pontos de Integração e Sincronização**
   - Where tracks must synchronize
   - Integration testing points

5. **Checkpoints de Teste e Validação**
   - Phase-by-phase testing
   - Success criteria

6. **Estratégias de Rollback por Fase**
   - Phase 1 rollback plan
   - Phase 2 rollback plan
   - etc.

## Error Handling and Retry Logic

### Automatic Retries

The system implements exponential backoff for:
- Bedrock throttling errors
- Network timeouts
- Temporary service issues

```typescript
// Retry configuration
maxRetries: 3
initialDelay: 1000ms
exponentialBackoff: delay * 2^attempt
jitter: random(0-1000ms)
```

### Large Specification Handling

For specifications exceeding token limits:
1. **Validation**: Checks size before processing
2. **Chunking**: Breaks into manageable pieces
3. **Incremental Processing**: Processes chunks sequentially
4. **Result Merging**: Combines results intelligently

### Error Responses

```typescript
// Error response format
{
  error: string;           // Error type
  details: string;         // Detailed message
  retryable: boolean;      // Can retry?
  timestamp: string;       // When it occurred
}
```

## Cost Optimization

### Token Usage Tracking

```typescript
interface CostTracking {
  tokensUsed: number;        // Total tokens consumed
  totalCost: number;         // Estimated cost in USD
  modelBreakdown: {
    sonnet: number;          // Tokens used by Sonnet
    opus: number;            // Tokens used by Opus
  };
}
```

### Cost Optimization Strategies

1. **Model Selection**
   - Use Sonnet for bulk operations (~$3/M tokens)
   - Use Opus only for complex reasoning (~$15/M tokens)

2. **Batch Processing**
   - Process tickets in batches of 5
   - Reduces API calls
   - Maintains context efficiency

3. **Response Caching** (Future)
   - Cache common patterns
   - Reuse component analysis
   - Share across similar specs

4. **Token Estimation**
   - Pre-validate specification size
   - Estimate costs before processing
   - Warn on expensive operations

### Expected Costs

| Specification Size | Tickets Generated | Estimated Cost |
|-------------------|------------------|----------------|
| Small (< 1000 words) | 3-5 tickets | $0.05 - $0.15 |
| Medium (1000-5000) | 5-15 tickets | $0.15 - $0.50 |
| Large (5000-10000) | 15-30 tickets | $0.50 - $1.50 |
| Very Large (>10000) | 30+ tickets | $1.50 - $5.00 |

## Monitoring and Debugging

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/ticket-generation --follow

# Filter for errors
aws logs filter-pattern "ERROR" \
  --log-group-name /aws/lambda/ticket-generation
```

### Key Metrics to Monitor

1. **Success Rate**
   - Percentage of successful generations
   - Track failures by error type

2. **Token Usage**
   - Average tokens per specification
   - Track by model (Sonnet vs Opus)

3. **Generation Time**
   - Average duration
   - P50, P90, P99 latency

4. **Cost**
   - Daily/weekly/monthly spend
   - Cost per specification
   - Cost per ticket

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Specification too large" | Exceeds token limits | Break into smaller specs |
| "Throttling error" | Rate limit exceeded | Automatic retry handles this |
| "Invalid JSON response" | Model formatting error | Retry usually resolves |
| "No tickets generated" | Spec too vague | Improve specification detail |

## Quality Assurance

### Ticket Validation

Generated tickets are validated for:
- ✅ Title is clear and concise
- ✅ Description is detailed and actionable
- ✅ Acceptance criteria are verifiable
- ✅ Estimated hours are reasonable (8-72)
- ✅ Complexity matches estimated hours
- ✅ Dependencies are valid
- ✅ Testing strategy is defined
- ✅ Rollback plan exists

### Quality Metrics

Track these metrics:
- Average ticket quality score
- Percentage of tickets requiring rework
- Implementation success rate
- Time to completion vs estimate

## Development Mode

For local development without AWS:

```typescript
// Set in .env.local
TICKET_GENERATION_URL=

// System will use mock responses
const mockTickets = [
  {
    title: 'Implementar autenticação',
    // ... mock data
  }
];
```

## Deployment

### Prerequisites

1. AWS account with:
   - Bedrock model access (Claude 3 Opus & Sonnet)
   - Lambda permissions
   - S3 bucket access
   - IAM role creation

2. Request Bedrock model access:
   ```bash
   # In AWS Console
   Services > Bedrock > Model access > Request access
   Select: Claude 3 Opus, Claude 3.5 Sonnet
   ```

### Deployment Steps

1. **Deploy Amplify Backend**
   ```bash
   cd amplify
   npm install
   npm run sandbox  # For development
   # or
   npm run deploy   # For production
   ```

2. **Configure Environment Variables**
   ```bash
   # Get Lambda URL from deployment output
   TICKET_GENERATION_URL=https://your-function-url.lambda-url.us-east-1.on.aws/
   ```

3. **Verify Deployment**
   ```bash
   # Test the function
   curl -X POST $TICKET_GENERATION_URL \
     -H "Content-Type: application/json" \
     -d '{"specificationId":"test","specificationContent":"Test spec"}'
   ```

### Production Checklist

- [ ] Bedrock model access approved
- [ ] Lambda function deployed
- [ ] S3 bucket configured
- [ ] IAM policies attached
- [ ] Environment variables set
- [ ] CloudWatch alarms configured
- [ ] Cost alerts set up
- [ ] Monitoring dashboard created
- [ ] Error tracking enabled
- [ ] Documentation updated

## Security Considerations

1. **API Access**
   - Function URL is public (no auth)
   - Consider adding API Gateway + Cognito for production

2. **Data Storage**
   - Specifications and tickets stored in S3
   - Use encryption at rest
   - Consider versioning for audit trail

3. **IAM Permissions**
   - Lambda has minimal required permissions
   - Bedrock: InvokeModel only
   - S3: PutObject on specific bucket

4. **Input Validation**
   - Specification size checked
   - Content sanitized
   - JSON parsing protected

## Future Enhancements

1. **Streaming Responses**
   - Real-time token streaming
   - Progressive ticket generation
   - Live progress updates

2. **Smart Chunking**
   - Semantic specification splitting
   - Context-aware chunking
   - Better handling of large specs

3. **Learning from Feedback**
   - Track ticket quality
   - Learn from corrections
   - Improve prompts over time

4. **Integration with PM Tools**
   - Export to Jira
   - Sync with GitHub Issues
   - Linear integration

5. **Advanced Analytics**
   - Ticket completion predictions
   - Team velocity tracking
   - Burndown charts

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review this documentation
3. Check AWS Bedrock service status
4. Open an issue in the repository

## License

This system follows the same license as the main project (MIT).
