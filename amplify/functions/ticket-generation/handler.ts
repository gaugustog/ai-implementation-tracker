import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME;

// Type definitions matching the problem statement requirements
interface GeneratedTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  estimatedHours: number;
  complexity: 'simple' | 'medium' | 'complex';
  dependencies: string[]; // References to other ticket IDs
  parallelizable: boolean;
  aiAgentCapable: boolean;
  requiredExpertise: string[];
  testingStrategy: string;
  rollbackPlan: string;
}

interface TicketGenerationRequest {
  specificationId: string;
  specificationContent: string;
  projectContext?: any;
  language?: string; // Default: pt-BR
}

interface PipelineState {
  parseSpecification?: any;
  identifyComponents?: any;
  generateTickets?: GeneratedTicket[];
  analyzeDependencies?: any;
  optimizeParallelization?: any;
  generateDocuments?: {
    summaryPath: string;
    executionPlanPath: string;
  };
}

/**
 * Main handler for ticket generation pipeline
 */
export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const request: TicketGenerationRequest = typeof event.body === 'string' 
      ? JSON.parse(event.body) 
      : event.body;

    const { specificationId, specificationContent, projectContext, language = 'pt-BR' } = request;

    if (!specificationId || !specificationContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: specificationId or specificationContent' }),
      };
    }

    // Initialize pipeline state
    const pipelineState: PipelineState = {};
    let tokensUsed = 0;

    // Step 1: Parse Specification
    console.log('Step 1: Parsing specification...');
    const parseResult = await parseSpecification(specificationContent, language);
    pipelineState.parseSpecification = parseResult;
    tokensUsed += parseResult.tokensUsed || 0;

    // Step 2: Identify Components
    console.log('Step 2: Identifying components...');
    const componentsResult = await identifyComponents(parseResult.parsed, projectContext, language);
    pipelineState.identifyComponents = componentsResult;
    tokensUsed += componentsResult.tokensUsed || 0;

    // Step 3: Generate Tickets (using Sonnet for efficiency)
    console.log('Step 3: Generating tickets...');
    const ticketsResult = await generateTickets(componentsResult.components, parseResult.parsed, language);
    pipelineState.generateTickets = ticketsResult.tickets;
    tokensUsed += ticketsResult.tokensUsed || 0;

    // Step 4: Analyze Dependencies
    console.log('Step 4: Analyzing dependencies...');
    const dependenciesResult = await analyzeDependencies(ticketsResult.tickets, language);
    pipelineState.analyzeDependencies = dependenciesResult;
    tokensUsed += dependenciesResult.tokensUsed || 0;

    // Step 5: Optimize Parallelization
    console.log('Step 5: Optimizing parallelization...');
    const parallelizationResult = await optimizeParallelization(
      dependenciesResult.enhancedTickets,
      projectContext,
      language
    );
    pipelineState.optimizeParallelization = parallelizationResult;
    tokensUsed += parallelizationResult.tokensUsed || 0;

    // Step 6: Generate Documents
    console.log('Step 6: Generating documents...');
    const documentsResult = await generateDocuments(
      specificationId,
      parallelizationResult.finalTickets,
      parseResult.parsed,
      dependenciesResult.dependencyGraph,
      parallelizationResult.executionTracks,
      language
    );
    pipelineState.generateDocuments = documentsResult;
    tokensUsed += documentsResult.tokensUsed || 0;

    // Calculate estimated cost (approximate pricing for Claude)
    // Claude 3 Opus: $15 per million input tokens, $75 per million output tokens
    // Claude 3 Sonnet: $3 per million input tokens, $15 per million output tokens
    // Simplified: average $10 per million tokens
    const totalCost = (tokensUsed / 1000000) * 10;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'completed',
        tickets: parallelizationResult.finalTickets,
        summaryPath: documentsResult.summaryPath,
        executionPlanPath: documentsResult.executionPlanPath,
        intermediateResults: pipelineState,
        tokensUsed,
        totalCost,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in ticket generation:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to generate tickets',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Step 1: Parse Specification
 * Extracts key information from the specification
 */
async function parseSpecification(content: string, language: string) {
  const systemPrompt = language === 'pt-BR'
    ? `Você é um analisador de especificações técnicas. Analise a especificação fornecida e extraia:
- Objetivo principal do projeto
- Requisitos funcionais
- Requisitos não-funcionais
- Componentes identificados
- Restrições técnicas
- Critérios de sucesso

Forneça a resposta em JSON estruturado.`
    : `You are a technical specification analyzer. Analyze the provided specification and extract:
- Main project objective
- Functional requirements
- Non-functional requirements
- Identified components
- Technical constraints
- Success criteria

Provide the response in structured JSON.`;

  const command = new ConverseCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [
      {
        role: 'user',
        content: [{ text: `${systemPrompt}\n\nEspecificação:\n${content}` }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.3,
    },
  });

  const response: ConverseCommandOutput = await bedrockClient.send(command);
  const text = response.output?.message?.content?.[0]?.text || '{}';
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  return {
    parsed: JSON.parse(jsonText),
    tokensUsed: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
  };
}

/**
 * Step 2: Identify Components
 * Breaks down the specification into implementable components
 */
async function identifyComponents(parsedSpec: any, projectContext: any, language: string) {
  const contextInfo = projectContext
    ? `\n\nContexto do Projeto:\n- Tech Stack: ${JSON.stringify(projectContext.techStack || {})}\n- Padrões: ${JSON.stringify(projectContext.patterns || {})}`
    : '';

  const systemPrompt = language === 'pt-BR'
    ? `Você é um arquiteto de software especializado em quebrar projetos em componentes implementáveis.

Analise os requisitos e identifique componentes lógicos que podem ser implementados em 1-3 dias cada.
Considere:
- Separação de responsabilidades
- Dependências entre componentes
- Complexidade técnica
- Capacidade de paralelização

Forneça uma lista de componentes em JSON: { "components": [{ "name": string, "description": string, "estimatedDays": number, "dependencies": string[] }] }${contextInfo}`
    : `You are a software architect specialized in breaking projects into implementable components.

Analyze the requirements and identify logical components that can be implemented in 1-3 days each.
Consider:
- Separation of concerns
- Dependencies between components
- Technical complexity
- Parallelization capability

Provide a list of components in JSON: { "components": [{ "name": string, "description": string, "estimatedDays": number, "dependencies": string[] }] }${contextInfo}`;

  const command = new ConverseCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [
      {
        role: 'user',
        content: [{ text: `${systemPrompt}\n\nRequisitos:\n${JSON.stringify(parsedSpec, null, 2)}` }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.4,
    },
  });

  const response: ConverseCommandOutput = await bedrockClient.send(command);
  const text = response.output?.message?.content?.[0]?.text || '{}';
  
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  return {
    components: JSON.parse(jsonText).components || [],
    tokensUsed: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
  };
}

/**
 * Step 3: Generate Tickets
 * Creates detailed tickets from components
 */
async function generateTickets(components: any[], parsedSpec: any, language: string) {
  const tickets: GeneratedTicket[] = [];
  let totalTokens = 0;

  // Generate tickets in batches to avoid context overflow
  const batchSize = 5;
  for (let i = 0; i < components.length; i += batchSize) {
    const batch = components.slice(i, i + batchSize);

    const systemPrompt = language === 'pt-BR'
      ? `Você é um gerente de projeto especializado em criar tickets de desenvolvimento detalhados.

Para cada componente, crie um ticket com:
- title: Título claro e conciso
- description: Descrição detalhada do trabalho
- acceptanceCriteria: Lista de critérios de aceitação verificáveis
- estimatedHours: Estimativa em horas (8-24 horas por dia, máximo 3 dias = 72 horas)
- complexity: "simple", "medium" ou "complex"
- dependencies: IDs de outros tickets (use o nome do componente como ID temporário)
- parallelizable: true se pode ser feito em paralelo com outros tickets
- aiAgentCapable: true se um agente AI (como Claude Code) pode implementar
- requiredExpertise: Lista de conhecimentos necessários
- testingStrategy: Estratégia de teste para este ticket
- rollbackPlan: Plano de rollback caso algo dê errado

Responda em JSON: { "tickets": [GeneratedTicket] }`
      : `You are a project manager specialized in creating detailed development tickets.

For each component, create a ticket with:
- title: Clear and concise title
- description: Detailed description of the work
- acceptanceCriteria: List of verifiable acceptance criteria
- estimatedHours: Estimate in hours (8-24 hours per day, maximum 3 days = 72 hours)
- complexity: "simple", "medium" or "complex"
- dependencies: IDs of other tickets (use component name as temporary ID)
- parallelizable: true if can be done in parallel with other tickets
- aiAgentCapable: true if an AI agent (like Claude Code) can implement
- requiredExpertise: List of required knowledge
- testingStrategy: Testing strategy for this ticket
- rollbackPlan: Rollback plan if something goes wrong

Respond in JSON: { "tickets": [GeneratedTicket] }`;

    const command = new ConverseCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `${systemPrompt}\n\nComponentes:\n${JSON.stringify(batch, null, 2)}\n\nContexto da Especificação:\n${JSON.stringify(parsedSpec, null, 2)}`,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.5,
      },
    });

    const response: ConverseCommandOutput = await bedrockClient.send(command);
    const text = response.output?.message?.content?.[0]?.text || '{}';
    
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const batchTickets = JSON.parse(jsonText).tickets || [];
    tickets.push(...batchTickets);
    totalTokens += (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0);
  }

  return {
    tickets,
    tokensUsed: totalTokens,
  };
}

/**
 * Step 4: Analyze Dependencies
 * Analyzes and validates ticket dependencies
 */
async function analyzeDependencies(tickets: GeneratedTicket[], language: string) {
  const systemPrompt = language === 'pt-BR'
    ? `Você é um analista de dependências de projetos. 

Analise os tickets fornecidos e:
1. Valide as dependências existentes
2. Identifique dependências implícitas não mencionadas
3. Crie um grafo de dependências
4. Identifique o caminho crítico
5. Sugira otimizações

Responda em JSON: { 
  "dependencyGraph": { "nodes": [], "edges": [] },
  "criticalPath": string[],
  "enhancedTickets": GeneratedTicket[],
  "warnings": string[]
}`
    : `You are a project dependency analyst.

Analyze the provided tickets and:
1. Validate existing dependencies
2. Identify implicit dependencies not mentioned
3. Create a dependency graph
4. Identify the critical path
5. Suggest optimizations

Respond in JSON: { 
  "dependencyGraph": { "nodes": [], "edges": [] },
  "criticalPath": string[],
  "enhancedTickets": GeneratedTicket[],
  "warnings": string[]
}`;

  const command = new ConverseCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [
      {
        role: 'user',
        content: [{ text: `${systemPrompt}\n\nTickets:\n${JSON.stringify(tickets, null, 2)}` }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.3,
    },
  });

  const response: ConverseCommandOutput = await bedrockClient.send(command);
  const text = response.output?.message?.content?.[0]?.text || '{}';
  
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  const result = JSON.parse(jsonText);

  return {
    dependencyGraph: result.dependencyGraph || { nodes: [], edges: [] },
    criticalPath: result.criticalPath || [],
    enhancedTickets: result.enhancedTickets || tickets,
    warnings: result.warnings || [],
    tokensUsed: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
  };
}

/**
 * Step 5: Optimize Parallelization
 * Optimizes ticket execution for AI agents working in parallel
 */
async function optimizeParallelization(tickets: GeneratedTicket[], projectContext: any, language: string) {
  const systemPrompt = language === 'pt-BR'
    ? `Você é um especialista em otimização de execução paralela para agentes de IA.

Analise os tickets e crie trilhas de execução paralela considerando:
1. Tickets que podem ser executados simultaneamente por diferentes agentes AI
2. Dependências que impedem paralelização
3. Balanceamento de carga entre agentes
4. Pontos de sincronização necessários
5. Capacidade de cada ticket ser implementado por IA

Responda em JSON: {
  "executionTracks": [{ "trackId": number, "tickets": string[], "estimatedDays": number }],
  "finalTickets": GeneratedTicket[],
  "recommendations": string[]
}`
    : `You are an expert in parallel execution optimization for AI agents.

Analyze the tickets and create parallel execution tracks considering:
1. Tickets that can be executed simultaneously by different AI agents
2. Dependencies that prevent parallelization
3. Load balancing between agents
4. Necessary synchronization points
5. Capability of each ticket to be implemented by AI

Respond in JSON: {
  "executionTracks": [{ "trackId": number, "tickets": string[], "estimatedDays": number }],
  "finalTickets": GeneratedTicket[],
  "recommendations": string[]
}`;

  const command = new ConverseCommand({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0', // Use Opus for complex planning
    messages: [
      {
        role: 'user',
        content: [{ text: `${systemPrompt}\n\nTickets:\n${JSON.stringify(tickets, null, 2)}` }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.4,
    },
  });

  const response: ConverseCommandOutput = await bedrockClient.send(command);
  const text = response.output?.message?.content?.[0]?.text || '{}';
  
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;

  const result = JSON.parse(jsonText);

  return {
    executionTracks: result.executionTracks || [],
    finalTickets: result.finalTickets || tickets,
    recommendations: result.recommendations || [],
    tokensUsed: (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0),
  };
}

/**
 * Step 6: Generate Documents
 * Creates SUMMARY.md and EXECUTION_PLAN.md
 */
async function generateDocuments(
  specificationId: string,
  tickets: GeneratedTicket[],
  parsedSpec: any,
  dependencyGraph: any,
  executionTracks: any[],
  language: string
) {
  let totalTokens = 0;

  // Generate SUMMARY.md
  const summaryPrompt = language === 'pt-BR'
    ? `Você é um gerente de projetos técnico criando um resumo executivo.

Crie um documento SUMMARY.md em português (pt-BR) com:

# Resumo Executivo

## Visão Geral
(2-3 parágrafos explicando o projeto e objetivos)

## Breakdown de Tickets
- Total de tickets: X
- Por complexidade: X simples, Y médios, Z complexos
- Por tipo: ...

## Caminho Crítico
(Liste os tickets no caminho crítico)

## Matriz de Risco
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| ...   | ...           | ...     | ...       |

## Requisitos de Recursos
- Desenvolvedores necessários: X
- Agentes AI necessários: Y
- Especialidades requeridas: ...

## Estimativa de Timeline
- Duração total (sequencial): X dias
- Duração total (paralelo): Y dias
- Nível de confiança: Z%

Dados dos tickets:
${JSON.stringify({ tickets, parsedSpec, dependencyGraph, executionTracks }, null, 2)}`
    : `You are a technical project manager creating an executive summary.

Create a SUMMARY.md document in Portuguese (pt-BR) with:
[... similar structure ...]

Ticket data:
${JSON.stringify({ tickets, parsedSpec, dependencyGraph, executionTracks }, null, 2)}`;

  const summaryCommand = new ConverseCommand({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    messages: [
      {
        role: 'user',
        content: [{ text: summaryPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.5,
    },
  });

  const summaryResponse: ConverseCommandOutput = await bedrockClient.send(summaryCommand);
  const summaryContent = summaryResponse.output?.message?.content?.[0]?.text || '';
  totalTokens += (summaryResponse.usage?.inputTokens || 0) + (summaryResponse.usage?.outputTokens || 0);

  // Generate EXECUTION_PLAN.md
  const executionPrompt = language === 'pt-BR'
    ? `Você é um arquiteto de software criando um plano de execução detalhado.

Crie um documento EXECUTION_PLAN.md em português (pt-BR) com:

# Plano de Execução

## Trilhas de Execução Paralela

### Trilha 1: [Nome]
- Tickets: [lista]
- Duração estimada: X dias
- Agente recomendado: [tipo]

(Repita para cada trilha)

## Dependências Sequenciais
[Mapeamento visual de dependências]

## Recomendações de Atribuição de Agentes
| Ticket | Agente Recomendado | Motivo |
|--------|-------------------|--------|
| ...    | ...               | ...    |

## Pontos de Integração e Sincronização
[Liste pontos onde as trilhas precisam sincronizar]

## Checkpoints de Teste e Validação
| Fase | Tickets Incluídos | Critérios de Sucesso |
|------|------------------|---------------------|
| ...  | ...              | ...                 |

## Estratégias de Rollback por Fase
### Fase 1
- Tickets: ...
- Rollback: ...

(Repita para cada fase)

Dados:
${JSON.stringify({ tickets, executionTracks, dependencyGraph }, null, 2)}`
    : `You are a software architect creating a detailed execution plan.

Create an EXECUTION_PLAN.md document in Portuguese (pt-BR) with:
[... similar structure ...]

Data:
${JSON.stringify({ tickets, executionTracks, dependencyGraph }, null, 2)}`;

  const executionCommand = new ConverseCommand({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    messages: [
      {
        role: 'user',
        content: [{ text: executionPrompt }],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.5,
    },
  });

  const executionResponse: ConverseCommandOutput = await bedrockClient.send(executionCommand);
  const executionContent = executionResponse.output?.message?.content?.[0]?.text || '';
  totalTokens += (executionResponse.usage?.inputTokens || 0) + (executionResponse.usage?.outputTokens || 0);

  // Save documents to S3
  const summaryKey = `specs/${specificationId}/SUMMARY.md`;
  const executionKey = `specs/${specificationId}/EXECUTION_PLAN.md`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: summaryKey,
      Body: summaryContent,
      ContentType: 'text/markdown',
    })
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: executionKey,
      Body: executionContent,
      ContentType: 'text/markdown',
    })
  );

  // Save individual ticket files
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const ticketNumber = String(i + 1).padStart(3, '0');
    const ticketKey = `specs/${specificationId}/tickets/TICKET-${ticketNumber}.md`;
    
    const ticketContent = `# ${ticket.title}

## Descrição
${ticket.description}

## Critérios de Aceitação
${ticket.acceptanceCriteria.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}

## Informações Técnicas
- **Estimativa**: ${ticket.estimatedHours} horas
- **Complexidade**: ${ticket.complexity}
- **Paralelizável**: ${ticket.parallelizable ? 'Sim' : 'Não'}
- **Implementável por IA**: ${ticket.aiAgentCapable ? 'Sim' : 'Não'}

## Dependências
${ticket.dependencies.length > 0 ? ticket.dependencies.map(d => `- ${d}`).join('\n') : 'Nenhuma'}

## Expertise Necessária
${ticket.requiredExpertise.map(e => `- ${e}`).join('\n')}

## Estratégia de Teste
${ticket.testingStrategy}

## Plano de Rollback
${ticket.rollbackPlan}
`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: ticketKey,
        Body: ticketContent,
        ContentType: 'text/markdown',
      })
    );
  }

  return {
    summaryPath: summaryKey,
    executionPlanPath: executionKey,
    tokensUsed: totalTokens,
  };
}
