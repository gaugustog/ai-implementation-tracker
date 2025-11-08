# Ticket Generation - Usage Examples

## Integration with Specifications Page

To add ticket generation to the specifications page, follow these steps:

### 1. Import the TicketGenerator Component

```typescript
import { TicketGenerator } from '@/components/tickets/TicketGenerator';
```

### 2. Add Ticket Generation Button to Specification Card

```typescript
// In the specification card/list view
<Card>
  <CardContent>
    <Typography variant="h6">{specification.type}</Typography>
    <Typography variant="body2">{specification.content}</Typography>
    
    {/* Add this button */}
    <Button
      startIcon={<Sparkles />}
      onClick={() => handleGenerateTickets(specification)}
    >
      Gerar Tickets com IA
    </Button>
  </CardContent>
</Card>
```

### 3. Add Dialog with TicketGenerator

```typescript
const [ticketGenDialog, setTicketGenDialog] = useState(false);
const [selectedSpecForTickets, setSelectedSpecForTickets] = useState<Specification | null>(null);

const handleGenerateTickets = (spec: Specification) => {
  setSelectedSpecForTickets(spec);
  setTicketGenDialog(true);
};

return (
  <>
    {/* Your existing UI */}
    
    <Dialog
      open={ticketGenDialog}
      onClose={() => setTicketGenDialog(false)}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        Gerar Tickets - {selectedSpecForTickets?.type}
      </DialogTitle>
      <DialogContent>
        {selectedSpecForTickets && (
          <TicketGenerator
            specificationId={selectedSpecForTickets.id}
            specificationContent={selectedSpecForTickets.content || ''}
            projectContext={projectContext} // If you have project context
            onComplete={(generation) => {
              console.log('Tickets generated:', generation);
              setTicketGenDialog(false);
              // Optionally refresh tickets list
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  </>
);
```

## Standalone Page Example

Create a new page at `app/specifications/[id]/generate-tickets/page.tsx`:

```typescript
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Container, Typography, Box, Button } from '@mui/material';
import { ArrowBack } from 'lucide-react';
import Link from 'next/link';
import { TicketGenerator } from '@/components/tickets/TicketGenerator';
import { specificationAPI } from '@/lib/api/amplify';
import type { Specification } from '@/lib/types';

export default function GenerateTicketsPage() {
  const params = useParams();
  const [specification, setSpecification] = useState<Specification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpecification();
  }, [params.id]);

  const loadSpecification = async () => {
    try {
      const spec = await specificationAPI.get(params.id as string);
      setSpecification(spec);
    } catch (error) {
      console.error('Failed to load specification:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!specification) return <div>Specification not found</div>;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Link href="/specifications">
          <Button startIcon={<ArrowBack />}>
            Voltar para Especificações
          </Button>
        </Link>

        <Typography variant="h4" sx={{ mt: 2, mb: 4 }}>
          Gerar Tickets - {specification.type}
        </Typography>

        <TicketGenerator
          specificationId={specification.id}
          specificationContent={specification.content || ''}
          onComplete={(generation) => {
            console.log('Generation complete:', generation);
            // Navigate to tickets page or show success message
          }}
        />
      </Box>
    </Container>
  );
}
```

## API Usage Example

### Direct API Call from Frontend

```typescript
const generateTickets = async (specificationId: string, content: string) => {
  try {
    const response = await fetch('/api/tickets/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        specificationId,
        specificationContent: content,
        projectContext: {
          techStack: {
            languages: ['TypeScript', 'Python'],
            frameworks: ['Next.js', 'FastAPI'],
          },
        },
        language: 'pt-BR',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate tickets');
    }

    const result = await response.json();
    
    console.log('Tickets:', result.tickets);
    console.log('Summary:', result.summaryPath);
    console.log('Execution Plan:', result.executionPlanPath);
    console.log('Cost:', result.totalCost);
    
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### Lambda Direct Invocation

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: 'us-east-1' });

const generateTicketsViaLambda = async (spec: Specification) => {
  const payload = {
    body: JSON.stringify({
      specificationId: spec.id,
      specificationContent: spec.content,
      language: 'pt-BR',
    }),
  };

  const command = new InvokeCommand({
    FunctionName: 'ticket-generation',
    Payload: JSON.stringify(payload),
  });

  const response = await lambda.send(command);
  const result = JSON.parse(Buffer.from(response.Payload).toString());
  
  return JSON.parse(result.body);
};
```

## Programmatic Usage Example

### Batch Generate Tickets for Multiple Specifications

```typescript
const batchGenerateTickets = async (specifications: Specification[]) => {
  const results = [];
  
  for (const spec of specifications) {
    try {
      console.log(`Generating tickets for ${spec.id}...`);
      
      const result = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specificationId: spec.id,
          specificationContent: spec.content,
          language: 'pt-BR',
        }),
      }).then(res => res.json());
      
      results.push({ specId: spec.id, ...result });
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed for ${spec.id}:`, error);
      results.push({ specId: spec.id, error: error.message });
    }
  }
  
  return results;
};
```

## Download Generated Documents

```typescript
import { downloadMarkdownFile } from '@/lib/api/storage';

const downloadGeneratedDocs = async (generation: TicketGeneration) => {
  try {
    // Download summary
    const summaryContent = await downloadMarkdownFile(generation.summaryFileKey);
    console.log('Summary:', summaryContent);
    
    // Download execution plan
    const planContent = await downloadMarkdownFile(generation.executionPlanFileKey);
    console.log('Execution Plan:', planContent);
    
    // Download individual tickets
    for (let i = 0; i < generation.tickets.length; i++) {
      const ticketNumber = String(i + 1).padStart(3, '0');
      const ticketKey = `specs/${generation.specificationId}/tickets/TICKET-${ticketNumber}.md`;
      const ticketContent = await downloadMarkdownFile(ticketKey);
      console.log(`Ticket ${ticketNumber}:`, ticketContent);
    }
  } catch (error) {
    console.error('Failed to download documents:', error);
  }
};
```

## Integration with Project Context

```typescript
import { codeAnalyzerAPI } from '@/lib/api/code-analyzer';

const generateTicketsWithContext = async (spec: Specification, project: Project) => {
  // Get codebase context if available
  let projectContext = null;
  
  if (project.gitRepository) {
    try {
      const context = await codeAnalyzerAPI.getContext(project.id);
      projectContext = context;
    } catch (error) {
      console.warn('Could not load project context:', error);
    }
  }
  
  // Generate tickets with context
  const response = await fetch('/api/tickets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      specificationId: spec.id,
      specificationContent: spec.content,
      projectContext,
      language: 'pt-BR',
    }),
  });
  
  return response.json();
};
```

## Save Generated Tickets to Database

```typescript
import { ticketAPI } from '@/lib/api/amplify';

const saveGeneratedTickets = async (
  generation: TicketGeneration,
  specificationId: string
) => {
  const savedTickets = [];
  
  for (const ticket of generation.tickets) {
    try {
      const saved = await ticketAPI.create({
        title: ticket.title,
        description: ticket.description,
        status: 'todo',
        specificationId,
        acceptanceCriteria: ticket.acceptanceCriteria,
        estimatedHours: ticket.estimatedHours,
        complexity: ticket.complexity,
        dependencies: ticket.dependencies,
        parallelizable: ticket.parallelizable,
        aiAgentCapable: ticket.aiAgentCapable,
        requiredExpertise: ticket.requiredExpertise,
        testingStrategy: ticket.testingStrategy,
        rollbackPlan: ticket.rollbackPlan,
        ticketGenerationId: generation.id,
      });
      
      savedTickets.push(saved);
    } catch (error) {
      console.error('Failed to save ticket:', error);
    }
  }
  
  return savedTickets;
};
```

## Cost Monitoring Example

```typescript
const monitorGenerationCosts = async () => {
  // Track costs over time
  const generations = await ticketGenerationAPI.list();
  
  const totalCost = generations.reduce((sum, gen) => sum + (gen.totalCost || 0), 0);
  const totalTokens = generations.reduce((sum, gen) => sum + (gen.tokensUsed || 0), 0);
  const avgCostPerSpec = totalCost / generations.length;
  const avgTokensPerSpec = totalTokens / generations.length;
  
  console.log('Cost Summary:');
  console.log('- Total Cost:', `$${totalCost.toFixed(2)}`);
  console.log('- Total Tokens:', totalTokens.toLocaleString());
  console.log('- Avg Cost/Spec:', `$${avgCostPerSpec.toFixed(2)}`);
  console.log('- Avg Tokens/Spec:', avgTokensPerSpec.toLocaleString());
  
  return {
    totalCost,
    totalTokens,
    avgCostPerSpec,
    avgTokensPerSpec,
    generationCount: generations.length,
  };
};
```

## Error Handling Example

```typescript
const generateTicketsWithRetry = async (
  spec: Specification,
  maxRetries = 3
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/tickets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specificationId: spec.id,
          specificationContent: spec.content,
          language: 'pt-BR',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

## Testing Example

```typescript
// Mock usage for testing without AWS
const testTicketGeneration = async () => {
  // Without TICKET_GENERATION_URL set, the API will return mock data
  const mockSpec = {
    id: 'test-spec-123',
    content: `
      # Sistema de Autenticação
      
      ## Requisitos
      - Login com email e senha
      - Integração OAuth
      - Reset de senha
    `,
  };
  
  const result = await fetch('/api/tickets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      specificationId: mockSpec.id,
      specificationContent: mockSpec.content,
      language: 'pt-BR',
    }),
  }).then(res => res.json());
  
  console.log('Mock Result:', result);
  // Will return 3 pre-defined mock tickets
};
```

## Notes

- Always check if `TICKET_GENERATION_URL` is set before deploying to production
- The system uses mock responses when the Lambda URL is not configured
- Cost estimation is approximate and based on simplified token pricing
- Generation can take 1-5 minutes depending on specification size
- Large specifications (>10,000 words) may be rejected
