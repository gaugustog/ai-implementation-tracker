# Ticket Generation - Usage Examples

This document provides practical examples of using the ticket generation system.

## Example 1: Basic Ticket Generation

### Scenario
Generate tickets for a user authentication specification.

### Code

```typescript
import { useTicketGeneration } from '@/lib/hooks/useTicketGeneration';

function AuthenticationSpec() {
  const { generateTickets, isGenerating, result, error } = useTicketGeneration();

  const handleGenerate = async () => {
    const specContent = `
# Especificação: Sistema de Autenticação

## Requisitos
1. Login com email e senha
2. Registro de novos usuários
3. Recuperação de senha
4. Autenticação JWT
5. Refresh tokens
6. Proteção contra brute force

## Segurança
- Senhas devem ser hasheadas com bcrypt
- Tokens JWT com expiração de 15 minutos
- Refresh tokens com expiração de 7 dias
- Rate limiting: 5 tentativas por minuto

## Integrações
- AWS Cognito para gerenciamento de usuários
- SendGrid para envio de emails
- Redis para rate limiting
    `;

    await generateTickets({
      specificationId: 'auth-spec-001',
      specificationContent: specContent,
      specType: 'ANALYSIS',
      planNamePrefix: 'AU', // Authentication
    });
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (result) {
    return (
      <div>
        <h2>Generated {result.tickets.length} tickets</h2>
        <h3>Epics: {result.epics.length}</h3>
        <ul>
          {result.tickets.map(ticket => (
            <li key={ticket.ticketNumber}>
              {ticket.title} ({ticket.complexity}, {ticket.estimatedMinutes}min)
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <button onClick={handleGenerate} disabled={isGenerating}>
      {isGenerating ? 'Generating...' : 'Generate Tickets'}
    </button>
  );
}
```

### Expected Output

**Tickets Generated**: 8-12 tickets

**Sample Tickets**:
1. AU-001-01-configurar-cognito.md
   - Setup AWS Cognito user pool
   - Complexity: medium
   - Estimated: 4 hours

2. AU-002-01-implementar-login.md
   - Implement login endpoint with JWT
   - Complexity: medium
   - Estimated: 6 hours

3. AU-003-02-adicionar-rate-limiting.md
   - Add Redis-based rate limiting
   - Complexity: medium
   - Estimated: 4 hours

**Epics**:
- Epic 1: Authentication Core (tickets 1-4)
- Epic 2: Security Features (tickets 5-8)

## Example 2: Bug Fix Specification

### Scenario
Generate tickets for fixing a performance issue.

### Code

```typescript
const bugFixSpec = `
# Bug: Slow API Response Times

## Problema
A API de listagem de produtos está demorando >5 segundos para responder.

## Análise Inicial
- Query ao banco está sem índice
- N+1 query problem nas relações
- Cache não está sendo utilizado
- Sem paginação

## Impacto
- Alta latência para usuários
- Timeout em mobile apps
- Custos elevados de infraestrutura

## Requisitos da Solução
1. Adicionar índices apropriados
2. Implementar eager loading
3. Adicionar cache Redis
4. Implementar paginação
5. Monitoramento de performance
`;

await generateTickets({
  specificationId: 'perf-fix-001',
  specificationContent: bugFixSpec,
  specType: 'FIXES',
  planNamePrefix: 'PF', // Performance Fix
  projectContext: {
    techStack: {
      languages: ['TypeScript', 'Python'],
      frameworks: ['Next.js', 'FastAPI'],
      databases: ['PostgreSQL', 'Redis'],
    },
  },
});
```

### Expected Output

**Sample Tickets**:
1. PF-001-01-adicionar-indices-database.md
2. PF-002-01-implementar-eager-loading.md
3. PF-003-02-configurar-cache-redis.md
4. PF-004-02-adicionar-paginacao.md
5. PF-005-03-adicionar-monitoring.md

## Example 3: Complete Component with Ticket Approval

### Scenario
Full component with generation, review, and approval workflow.

### Code

```typescript
import { useState } from 'react';
import { TicketGenerationView } from '@/components/tickets/TicketGenerationView';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

export function SpecificationDetailPage({ specId }: { specId: string }) {
  const [specification, setSpecification] = useState<any>(null);

  // Load specification
  useEffect(() => {
    async function loadSpec() {
      const { data } = await client.models.Specification.get({ id: specId });
      setSpecification(data);
    }
    loadSpec();
  }, [specId]);

  const handleSaveTickets = async (tickets, epics) => {
    try {
      // Save epics first
      for (const epic of epics) {
        await client.models.Epic.create({
          title: epic.title,
          epicNumber: epic.epicNumber,
          description: epic.description,
          specificationId: specId,
        });
      }

      // Save tickets
      for (const ticket of tickets) {
        await client.models.Ticket.create({
          title: ticket.title,
          ticketNumber: ticket.ticketNumber,
          epicNumber: ticket.epicNumber,
          description: ticket.description,
          s3MdFileObjectKey: ticket.s3MdFileObjectKey,
          acceptanceCriteria: ticket.acceptanceCriteria,
          estimatedMinutes: ticket.estimatedMinutes,
          complexity: ticket.complexity,
          parallelizable: ticket.parallelizable,
          aiAgentCapable: ticket.aiAgentCapable,
          requiredExpertise: ticket.requiredExpertise,
          testingStrategy: ticket.testingStrategy,
          rollbackPlan: ticket.rollbackPlan,
          status: 'todo',
          specType: specification.type,
          specificationId: specId,
        });
      }

      // Create dependencies
      for (const ticket of tickets) {
        if (ticket.dependencies?.length > 0) {
          for (const depTicketNum of ticket.dependencies) {
            const dependsOnTicket = tickets.find(t => t.ticketNumber === depTicketNum);
            if (dependsOnTicket?.id) {
              await client.models.TicketDependency.create({
                ticketId: ticket.id!,
                dependsOnId: dependsOnTicket.id,
                dependencyType: 'blocks',
              });
            }
          }
        }
      }

      alert('Tickets saved successfully!');
    } catch (error) {
      console.error('Error saving tickets:', error);
      alert('Failed to save tickets');
    }
  };

  if (!specification) {
    return <div>Loading...</div>;
  }

  return (
    <TicketGenerationView
      specificationId={specId}
      specificationContent={specification.content || ''}
      specType={specification.type}
      planNamePrefix="AU"
      onSave={handleSaveTickets}
    />
  );
}
```

## Example 4: Cost Estimation

### Scenario
Estimate costs before generating tickets.

### Code

```typescript
import { estimateTicketGenerationCost, formatCost } from '@/lib/utils/cost-tracking';

function CostEstimator({ specContent }: { specContent: string }) {
  const estimate = estimateTicketGenerationCost(specContent);

  return (
    <div>
      <h3>Cost Estimate</h3>
      <p>Total: {formatCost(estimate.estimated.totalCost)}</p>
      
      <h4>Breakdown:</h4>
      <ul>
        {estimate.breakdown.map((item, i) => (
          <li key={i}>
            {item.step} ({item.model}): {formatCost(item.cost.totalCost)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Example Output

```
Cost Estimate
Total: $2.45

Breakdown:
- Parse Specification (Opus): $0.32
- Identify Components (Opus): $0.28
- Generate Tickets (Sonnet): $0.45
- Group into Epics (Opus): $0.22
- Analyze Dependencies (Opus): $0.27
- Optimize Parallelization (Opus): $0.31
- Generate Summary (Sonnet): $0.28
- Generate Execution Plan (Sonnet): $0.32
```

## Example 5: Manual Ticket Editing

### Scenario
Allow users to edit generated tickets before approval.

### Code

```typescript
import { useState } from 'react';
import { useTicketApproval } from '@/lib/hooks/useTicketGeneration';
import { TicketCard } from '@/components/tickets/TicketCard';

function TicketReviewWorkflow({ generatedTickets }) {
  const {
    editedTickets,
    approvedTickets,
    updateTicket,
    approveTicket,
    unapproveTicket,
    approveAll,
    allApproved,
  } = useTicketApproval(generatedTickets);

  const handleUpdateTicket = (ticketNumber, updates) => {
    updateTicket(ticketNumber, updates);
    console.log('Ticket updated:', ticketNumber, updates);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={approveAll} disabled={allApproved}>
          Approve All ({approvedTickets.size}/{editedTickets.length})
        </button>
      </div>

      {editedTickets.map(ticket => (
        <TicketCard
          key={ticket.ticketNumber}
          ticket={ticket}
          isApproved={approvedTickets.has(ticket.ticketNumber)}
          onApprove={approveTicket}
          onUnapprove={unapproveTicket}
          onUpdate={handleUpdateTicket}
        />
      ))}

      {allApproved && (
        <button onClick={() => console.log('Save', editedTickets)}>
          Save All Tickets
        </button>
      )}
    </div>
  );
}
```

## Example 6: Integration with Project Context

### Scenario
Use project context to generate better tickets.

### Code

```typescript
async function generateTicketsWithContext(specId: string, specContent: string) {
  // Load project context from code analyzer
  const { data: projectContext } = await client.models.ProjectContext.list({
    filter: { projectId: { eq: 'proj-123' } },
  });

  const context = projectContext[0];

  const result = await fetch('/api/ticket-generation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      specificationId: specId,
      specificationContent: specContent,
      specType: 'PLANS',
      planNamePrefix: 'IM', // Implementation
      projectContext: {
        techStack: context.techStack,
        patterns: context.patterns,
        integrationPoints: context.integrationPoints,
      },
    }),
  });

  return await result.json();
}
```

### Benefits

The AI will:
- Suggest tickets that follow existing patterns
- Recommend appropriate frameworks/libraries already in use
- Identify integration points with existing code
- Generate more accurate complexity estimates

## Example 7: Dependency Visualization

### Scenario
Display ticket dependencies as a graph.

### Code

```typescript
function DependencyGraphView({ tickets, dependencyGraph }) {
  const { criticalPath, parallelGroups, blockers } = dependencyGraph;

  return (
    <div>
      <h3>Critical Path</h3>
      <div style={{ display: 'flex', gap: '10px' }}>
        {criticalPath.map((ticketNum, index) => (
          <div key={ticketNum}>
            Ticket #{ticketNum}
            {index < criticalPath.length - 1 && ' → '}
          </div>
        ))}
      </div>

      <h3>Parallel Execution Groups</h3>
      {parallelGroups.map((group, i) => (
        <div key={i}>
          <h4>Group {i + 1} (can run in parallel)</h4>
          <ul>
            {group.map(ticketNum => {
              const ticket = tickets.find(t => t.ticketNumber === ticketNum);
              return (
                <li key={ticketNum}>
                  Ticket #{ticketNum}: {ticket?.title}
                  {ticket?.aiAgentCapable && ' 🤖'}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <h3>Blockers</h3>
      <p>These tickets block many others:</p>
      <ul>
        {blockers.map(ticketNum => {
          const ticket = tickets.find(t => t.ticketNumber === ticketNum);
          return (
            <li key={ticketNum}>
              Ticket #{ticketNum}: {ticket?.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

## Example 8: Downloading Generated Documents

### Scenario
Download SUMMARY.md and EXECUTION_PLAN.md from S3.

### Code

```typescript
import { getUrl } from 'aws-amplify/storage';

async function downloadDocument(s3Key: string, filename: string) {
  try {
    // Get pre-signed URL from S3
    const { url } = await getUrl({
      key: s3Key,
      options: {
        expiresIn: 3600, // 1 hour
      },
    });

    // Download file
    const response = await fetch(url.toString());
    const blob = await response.blob();
    
    // Trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Error downloading document:', error);
    alert('Failed to download document');
  }
}

// Usage
function DocumentDownloader({ summaryPath, executionPlanPath }) {
  return (
    <div>
      <button onClick={() => downloadDocument(summaryPath, 'SUMMARY.md')}>
        Download Summary
      </button>
      <button onClick={() => downloadDocument(executionPlanPath, 'EXECUTION_PLAN.md')}>
        Download Execution Plan
      </button>
    </div>
  );
}
```

## Example 9: Progressive Enhancement

### Scenario
Show generation progress with detailed status updates.

### Code

```typescript
function ProgressiveTicketGeneration() {
  const { generateTickets, isGenerating, progress } = useTicketGeneration();
  const [steps, setSteps] = useState<string[]>([]);

  useEffect(() => {
    if (progress) {
      setSteps(prev => [...prev, `${new Date().toLocaleTimeString()}: ${progress}`]);
    }
  }, [progress]);

  return (
    <div>
      <button onClick={handleGenerate} disabled={isGenerating}>
        Generate Tickets
      </button>

      {isGenerating && (
        <div style={{ marginTop: '20px' }}>
          <h4>Generation Progress:</h4>
          <ul>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Example 10: Error Handling and Retry

### Scenario
Handle errors gracefully with retry capability.

### Code

```typescript
function RobustTicketGeneration() {
  const [retryCount, setRetryCount] = useState(0);
  
  const { generateTickets, error, reset } = useTicketGeneration({
    onError: (err) => {
      console.error('Generation failed:', err);
      // Automatically retry up to 3 times
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          handleGenerate();
        }, 2000 * (retryCount + 1)); // Exponential backoff
      }
    },
  });

  const handleGenerate = async () => {
    reset();
    await generateTickets({
      specificationId: 'spec-001',
      specificationContent: '...',
      specType: 'ANALYSIS',
      planNamePrefix: 'AU',
    });
  };

  return (
    <div>
      {error && (
        <div style={{ color: 'red' }}>
          Error: {error}
          {retryCount < 3 && <div>Retrying... (attempt {retryCount + 1}/3)</div>}
          {retryCount >= 3 && (
            <button onClick={() => { setRetryCount(0); handleGenerate(); }}>
              Manual Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

## Tips and Best Practices

### 1. Specification Quality
- Be specific and detailed in requirements
- Include technical constraints
- Mention existing integrations
- Specify testing requirements

### 2. Cost Management
- Estimate costs before generation
- Use appropriate spec size (not too large)
- Review token usage in CloudWatch
- Consider batch processing for multiple specs

### 3. Ticket Review
- Always review generated tickets
- Adjust complexity estimates if needed
- Verify dependencies are correct
- Approve in batches by epic

### 4. Integration
- Load project context when available
- Save tickets to database after approval
- Create GitHub issues/Jira tickets
- Track execution progress

### 5. Error Handling
- Implement retry logic
- Show clear error messages
- Log errors for debugging
- Provide manual fallback options

## Common Issues and Solutions

### Issue: Generated tickets are too large
**Solution**: Adjust prompts to emphasize smaller, atomic tickets. Re-generate.

### Issue: Dependencies are incorrect
**Solution**: Manually edit dependencies in approval phase before saving.

### Issue: Cost is too high
**Solution**: Reduce specification size, use token optimization strategies.

### Issue: Portuguese quality is poor
**Solution**: Verify correct model versions, check prompt engineering.

### Issue: Tickets lack technical detail
**Solution**: Provide richer project context in request.

## Next Steps

1. **Try the examples** in your development environment
2. **Customize prompts** for your specific domain
3. **Add monitoring** to track costs and quality
4. **Integrate with your workflow** (Jira, GitHub, etc.)
5. **Collect feedback** from developers using generated tickets
6. **Iterate and improve** based on real usage

## Additional Resources

- [Main Documentation](./TICKET_GENERATION.md)
- [Cost Tracking Guide](./lib/utils/cost-tracking.ts)
- [API Reference](./app/api/ticket-generation/route.ts)
- [Lambda Function](./amplify/functions/ticket-generation/handler.ts)
