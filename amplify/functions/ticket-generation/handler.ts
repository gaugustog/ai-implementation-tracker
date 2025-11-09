import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

// Initialize AWS clients
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration for different Claude models
const MODELS = {
  OPUS: 'anthropic.claude-opus-4-20250514-v1:0', // For complex analysis and planning
  SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0', // For ticket description generation
  HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0', // For code exploring
};

// Type definitions
interface GeneratedTicket {
  title: string;
  ticketNumber: number;
  epicNumber?: number;
  description: string;
  s3MdFileObjectKey?: string;
  acceptanceCriteria: string[];
  estimatedMinutes: number;
  complexity: 'simple' | 'medium' | 'complex';
  parallelizable: boolean;
  aiAgentCapable: boolean;
  requiredExpertise: string[];
  testingStrategy: string;
  rollbackPlan: string;
  status: 'todo' | 'in_progress' | 'done';
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  dependencies: string[]; // Ticket numbers this depends on
}

interface Epic {
  epicNumber: number;
  title: string;
  description: string;
  tickets: GeneratedTicket[];
}

interface TicketGenerationRequest {
  specificationId: string;
  specificationContent: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  projectContext?: {
    techStack?: any;
    patterns?: any;
    integrationPoints?: any;
  };
  planNamePrefix: string; // CC prefix for ticket naming
}

interface PipelineResult {
  tickets: GeneratedTicket[];
  epics: Epic[];
  summaryPath: string;
  executionPlanPath: string;
  dependencyGraph: any;
}

/**
 * Main Lambda handler for ticket generation pipeline
 */
export const handler = async (event: any) => {
  console.log('Ticket Generation Event:', JSON.stringify(event, null, 2));

  try {
    const request: TicketGenerationRequest = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body;

    const { specificationId, specificationContent, specType, projectContext, planNamePrefix } = request;

    if (!specificationId || !specificationContent || !specType || !planNamePrefix) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: specificationId, specificationContent, specType, or planNamePrefix',
        }),
      };
    }

    console.log('Starting ticket generation pipeline for specification:', specificationId);

    // Execute the multi-step pipeline
    const result = await executeTicketGenerationPipeline({
      specificationId,
      specificationContent,
      specType,
      projectContext,
      planNamePrefix,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error in ticket generation handler:', error);
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
 * Execute the complete ticket generation pipeline
 */
async function executeTicketGenerationPipeline(
  request: TicketGenerationRequest
): Promise<PipelineResult> {
  const intermediateResults = new Map();

  console.log('Step 1: Parse Specification');
  const parsedSpec = await parseSpecification(request.specificationContent, request.specType);
  intermediateResults.set('parsedSpec', parsedSpec);

  console.log('Step 2: Identify Components');
  const components = await identifyComponents(parsedSpec, request.projectContext);
  intermediateResults.set('components', components);

  console.log('Step 3: Generate Tickets');
  const tickets = await generateTickets(
    components,
    request.specType,
    request.projectContext,
    request.planNamePrefix
  );
  intermediateResults.set('tickets', tickets);

  console.log('Step 4: Group into Epics');
  const epics = await groupIntoEpics(tickets, request.specType);
  intermediateResults.set('epics', epics);

  console.log('Step 5: Analyze Dependencies');
  const dependencyGraph = await analyzeDependencies(tickets, epics);
  intermediateResults.set('dependencyGraph', dependencyGraph);

  console.log('Step 6: Optimize Parallelization');
  const optimizedTickets = await optimizeParallelization(tickets, dependencyGraph);
  intermediateResults.set('optimizedTickets', optimizedTickets);

  console.log('Step 7: Generate SUMMARY.md');
  const summaryPath = await generateSummary(
    optimizedTickets,
    epics,
    dependencyGraph,
    request.specificationId
  );

  console.log('Step 8: Generate EXECUTION_PLAN.md');
  const executionPlanPath = await generateExecutionPlan(
    optimizedTickets,
    epics,
    dependencyGraph,
    request.specificationId
  );

  console.log('Step 9: Save Ticket Files to S3');
  await saveTicketFiles(optimizedTickets, request.specificationId, request.planNamePrefix);

  return {
    tickets: optimizedTickets,
    epics,
    summaryPath,
    executionPlanPath,
    dependencyGraph,
  };
}

/**
 * Step 1: Parse the specification content
 */
async function parseSpecification(content: string, specType: string) {
  const prompt = `Analise a seguinte especificação do tipo ${specType} e extraia as informações chave:

Especificação:
${content}

Por favor, identifique:
1. Requisitos principais
2. Componentes ou módulos envolvidos
3. Dependências técnicas
4. Riscos potenciais
5. Pontos de integração

Retorne a análise em formato JSON estruturado.`;

  const response = await callBedrock(MODELS.OPUS, prompt, 4096);
  return parseBedrockResponse(response);
}

/**
 * Step 2: Identify components and modules
 */
async function identifyComponents(parsedSpec: any, projectContext?: any) {
  const contextInfo = projectContext
    ? `\n\nContexto do Projeto:\n${JSON.stringify(projectContext, null, 2)}`
    : '';

  const prompt = `Com base na análise da especificação e contexto do projeto, identifique os componentes/módulos que precisam ser implementados ou modificados:

Análise:
${JSON.stringify(parsedSpec, null, 2)}
${contextInfo}

Para cada componente, identifique:
1. Nome e descrição
2. Tipo (novo, modificação, integração)
3. Complexidade estimada (simples, médio, complexo)
4. Dependências com outros componentes
5. Expertise técnica necessária

Retorne em formato JSON com array de componentes.`;

  const response = await callBedrock(MODELS.OPUS, prompt, 4096);
  return parseBedrockResponse(response);
}

/**
 * Step 3: Generate atomic tickets from components
 */
async function generateTickets(
  components: any,
  specType: string,
  projectContext: any,
  planNamePrefix: string
): Promise<GeneratedTicket[]> {
  const prompt = `Gere tickets atômicos e implementáveis a partir dos seguintes componentes:

Componentes:
${JSON.stringify(components, null, 2)}

Tipo de Especificação: ${specType}
Prefixo do Plano: ${planNamePrefix}

Para cada ticket, forneça:
1. Título claro e específico
2. Descrição detalhada (incluindo contexto técnico)
3. Critérios de aceite (lista de verificação objetiva)
4. Estimativa em minutos (máximo 3 dias = 1440 minutos)
5. Complexidade (simple, medium, complex)
6. Se pode ser paralelizado (boolean)
7. Se pode ser implementado por agente AI (boolean)
8. Expertise necessária (array de strings)
9. Estratégia de teste
10. Plano de rollback
11. Dependências (números de outros tickets)

IMPORTANTE:
- Cada ticket deve ser completável em no máximo 3 dias
- Tickets devem ser atômicos e independentes quando possível
- Use linguagem clara e objetiva em português (pt-BR)
- Critérios de aceite devem ser testáveis

Retorne um array JSON de tickets.`;

  const response = await callBedrock(MODELS.SONNET, prompt, 8192);
  const ticketsData = parseBedrockResponse(response);

  // Map to GeneratedTicket format
  const tickets: GeneratedTicket[] = ticketsData.tickets.map((t: any, index: number) => ({
    title: t.title || `Ticket ${index + 1}`,
    ticketNumber: index + 1,
    description: t.description || '',
    acceptanceCriteria: t.acceptanceCriteria || t.acceptance_criteria || [],
    estimatedMinutes: Math.min(t.estimatedMinutes || t.estimated_minutes || 480, 1440),
    complexity: t.complexity || 'medium',
    parallelizable: t.parallelizable ?? false,
    aiAgentCapable: (t.aiAgentCapable || t.ai_agent_capable) ?? false,
    requiredExpertise: t.requiredExpertise || t.required_expertise || [],
    testingStrategy: t.testingStrategy || t.testing_strategy || 'Testes manuais básicos',
    rollbackPlan: t.rollbackPlan || t.rollback_plan || 'Reverter commit',
    status: 'todo' as const,
    specType: specType as any,
    dependencies: t.dependencies || [],
  }));

  return tickets;
}

/**
 * Step 4: Group tickets into epics
 */
async function groupIntoEpics(tickets: GeneratedTicket[], specType: string): Promise<Epic[]> {
  const prompt = `Agrupe os seguintes tickets em épicos lógicos:

Tickets:
${JSON.stringify(tickets, null, 2)}

Tipo de Especificação: ${specType}

Para cada épico, forneça:
1. Número do épico (começando em 1)
2. Título descritivo
3. Descrição geral
4. Lista de números de tickets que pertencem a este épico

Critérios para agrupamento:
- Tickets relacionados ao mesmo componente/módulo
- Tickets com objetivos similares
- Tickets que representam uma funcionalidade completa
- Máximo de 10 tickets por épico

Retorne um array JSON de épicos.`;

  const response = await callBedrock(MODELS.OPUS, prompt, 4096);
  const epicsData = parseBedrockResponse(response);

  // Map to Epic format and assign epicNumber to tickets
  const epics: Epic[] = epicsData.epics.map((e: any) => {
    const epicTickets = tickets.filter(t => e.ticketNumbers.includes(t.ticketNumber));
    
    // Assign epic number to tickets
    epicTickets.forEach(ticket => {
      ticket.epicNumber = e.epicNumber;
    });

    return {
      epicNumber: e.epicNumber,
      title: e.title,
      description: e.description,
      tickets: epicTickets,
    };
  });

  return epics;
}

/**
 * Step 5: Analyze dependencies between tickets
 */
async function analyzeDependencies(tickets: GeneratedTicket[], epics: Epic[]) {
  const prompt = `Analise as dependências entre os seguintes tickets:

Tickets:
${JSON.stringify(tickets.map(t => ({
  ticketNumber: t.ticketNumber,
  title: t.title,
  description: t.description,
  epicNumber: t.epicNumber,
  dependencies: t.dependencies,
})), null, 2)}

Épicos:
${JSON.stringify(epics.map(e => ({
  epicNumber: e.epicNumber,
  title: e.title,
  ticketNumbers: e.tickets.map(t => t.ticketNumber),
})), null, 2)}

Identifique:
1. Dependências técnicas (um ticket precisa de outro concluído)
2. Caminho crítico (sequência de tickets que define o tempo mínimo)
3. Tickets que podem ser executados em paralelo
4. Bloqueadores potenciais

Retorne um JSON estruturado com:
- dependencyMatrix: matriz de dependências
- criticalPath: array de números de tickets no caminho crítico
- parallelGroups: grupos de tickets que podem ser executados em paralelo
- blockers: tickets que bloqueiam muitos outros`;

  const response = await callBedrock(MODELS.OPUS, prompt, 4096);
  return parseBedrockResponse(response);
}

/**
 * Step 6: Optimize for parallel execution
 */
async function optimizeParallelization(
  tickets: GeneratedTicket[],
  dependencyGraph: any
): Promise<GeneratedTicket[]> {
  const prompt = `Otimize a execução paralela dos seguintes tickets considerando:

Tickets:
${JSON.stringify(tickets.map(t => ({
  ticketNumber: t.ticketNumber,
  title: t.title,
  complexity: t.complexity,
  estimatedMinutes: t.estimatedMinutes,
  parallelizable: t.parallelizable,
  aiAgentCapable: t.aiAgentCapable,
  dependencies: t.dependencies,
})), null, 2)}

Grafo de Dependências:
${JSON.stringify(dependencyGraph, null, 2)}

Considere:
1. Modelos de Claude disponíveis (Opus para tarefas complexas, Sonnet para médias, Haiku para simples)
2. Capacidade de paralelização de cada ticket
3. Dependências que impedem paralelização
4. Balanceamento de carga entre agentes AI e desenvolvedores humanos

Para cada ticket, determine:
- Recomendação de modelo Claude (se aiAgentCapable)
- Prioridade de execução (1-5, onde 1 é mais urgente)
- Grupo de execução paralela

Retorne um JSON com array de tickets otimizados.`;

  const response = await callBedrock(MODELS.OPUS, prompt, 4096);
  const optimizedData = parseBedrockResponse(response);

  // Merge optimization data back into tickets
  const optimizedTickets = tickets.map(ticket => {
    const optData = optimizedData.tickets?.find((t: any) => t.ticketNumber === ticket.ticketNumber);
    return {
      ...ticket,
      recommendedModel: optData?.recommendedModel || (ticket.aiAgentCapable ? 'sonnet' : null),
      priority: optData?.priority || 3,
      executionGroup: optData?.executionGroup || 1,
    };
  });

  return optimizedTickets;
}

/**
 * Step 7: Generate SUMMARY.md
 */
async function generateSummary(
  tickets: GeneratedTicket[],
  epics: Epic[],
  dependencyGraph: any,
  specificationId: string
): Promise<string> {
  const prompt = `Gere um documento SUMMARY.md executivo em português (pt-BR) com base nas seguintes informações:

Tickets Gerados: ${tickets.length}
Épicos: ${epics.length}

Detalhes dos Tickets:
${JSON.stringify(tickets.map(t => ({
  ticketNumber: t.ticketNumber,
  title: t.title,
  complexity: t.complexity,
  estimatedMinutes: t.estimatedMinutes,
  aiAgentCapable: t.aiAgentCapable,
  epicNumber: t.epicNumber,
})), null, 2)}

Épicos:
${JSON.stringify(epics, null, 2)}

Grafo de Dependências:
${JSON.stringify(dependencyGraph, null, 2)}

O documento deve conter:

1. **Resumo Executivo** (2-3 parágrafos)
   - Visão geral do plano
   - Objetivos principais
   - Abordagem geral

2. **Breakdown de Tickets**
   - Por tipo (épico)
   - Por complexidade (simples, médio, complexo)
   - Por capacidade de IA (AI agent vs. humano)

3. **Caminho Crítico**
   - Identificação dos tickets no caminho crítico
   - Tempo total estimado
   - Riscos de atraso

4. **Matriz de Riscos**
   - Riscos técnicos identificados
   - Probabilidade e impacto
   - Estratégias de mitigação

5. **Requisitos de Recursos**
   - Tickets para agentes AI (por modelo)
   - Tickets para desenvolvedores humanos
   - Tickets para stakeholders/revisão

6. **Estimativa de Timeline**
   - Com execução por agentes AI
   - Com execução tradicional por desenvolvedores
   - Tempo combinado (AI + humano)
   - Níveis de confiança

Formate em Markdown com headers, tabelas e listas.`;

  const response = await callBedrock(MODELS.SONNET, prompt, 8192);
  const summary = response;

  // Save to S3
  const s3Key = `specs/${specificationId}/SUMMARY.md`;
  await saveToS3(s3Key, summary);

  return s3Key;
}

/**
 * Step 8: Generate EXECUTION_PLAN.md
 */
async function generateExecutionPlan(
  tickets: GeneratedTicket[],
  epics: Epic[],
  dependencyGraph: any,
  specificationId: string
): Promise<string> {
  const prompt = `Gere um documento EXECUTION_PLAN.md detalhado em português (pt-BR) com base nas seguintes informações:

Tickets:
${JSON.stringify(tickets.map(t => ({
  ticketNumber: t.ticketNumber,
  title: t.title,
  complexity: t.complexity,
  estimatedMinutes: t.estimatedMinutes,
  aiAgentCapable: t.aiAgentCapable,
  parallelizable: t.parallelizable,
  dependencies: t.dependencies,
  epicNumber: t.epicNumber,
  requiredExpertise: t.requiredExpertise,
})), null, 2)}

Épicos:
${JSON.stringify(epics, null, 2)}

Grafo de Dependências:
${JSON.stringify(dependencyGraph, null, 2)}

O documento deve conter:

1. **Tracks de Execução Paralela**
   - Track 1: Agentes AI Claude (Opus, Sonnet, Haiku)
   - Track 2: Desenvolvedores Humanos
   - Track 3: Revisão e Validação (Stakeholders)

2. **Mapeamento de Dependências Sequenciais**
   - Diagrama textual/ASCII de dependências
   - Ordem de execução obrigatória
   - Pontos de sincronização

3. **Recomendações de Atribuição de Agentes**
   - Quais tickets para Claude Opus (análise complexa)
   - Quais tickets para Claude Sonnet (implementação padrão)
   - Quais tickets para Claude Haiku (tarefas simples)
   - Quais tickets para desenvolvedores humanos

4. **Pontos de Integração e Sincronização**
   - Momentos onde tracks paralelos se encontram
   - Testes de integração necessários
   - Revisões de código críticas

5. **Checkpoints de Teste e Validação**
   - Após cada épico
   - Após cada grupo de tickets paralelos
   - Testes de regressão

6. **Estratégias de Rollback**
   - Por fase/épico
   - Procedimentos de reversão
   - Pontos de backup

7. **Cronograma Visual**
   - Timeline estimado por fase
   - Marcos importantes
   - Dependências críticas

Formate em Markdown com headers, tabelas, diagramas ASCII e listas.`;

  const response = await callBedrock(MODELS.SONNET, prompt, 8192);
  const executionPlan = response;

  // Save to S3
  const s3Key = `specs/${specificationId}/EXECUTION_PLAN.md`;
  await saveToS3(s3Key, executionPlan);

  return s3Key;
}

/**
 * Step 9: Save individual ticket markdown files to S3
 */
async function saveTicketFiles(
  tickets: GeneratedTicket[],
  specificationId: string,
  planNamePrefix: string
) {
  for (const ticket of tickets) {
    // Generate ticket filename: {CC}-{NNN}-{EE}-{description}.md
    const epicPart = ticket.epicNumber ? String(ticket.epicNumber).padStart(2, '0') : '00';
    const ticketPart = String(ticket.ticketNumber).padStart(3, '0');
    const descriptionSlug = ticket.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);
    const filename = `${planNamePrefix}-${ticketPart}-${epicPart}-${descriptionSlug}.md`;

    // Generate markdown content
    const markdown = generateTicketMarkdown(ticket);

    // Save to S3
    const s3Key = `specs/${specificationId}/tickets/${filename}`;
    await saveToS3(s3Key, markdown);

    // Update ticket with S3 key
    ticket.s3MdFileObjectKey = s3Key;
  }
}

/**
 * Generate markdown content for a ticket
 */
function generateTicketMarkdown(ticket: GeneratedTicket): string {
  const epicInfo = ticket.epicNumber ? `\n**Épico:** ${ticket.epicNumber}` : '';
  
  return `# ${ticket.title}

**Ticket:** #${ticket.ticketNumber}${epicInfo}
**Complexidade:** ${ticket.complexity}
**Estimativa:** ${Math.round(ticket.estimatedMinutes / 60)} horas (${ticket.estimatedMinutes} minutos)
**Status:** ${ticket.status}

## Descrição

${ticket.description}

## Critérios de Aceite

${ticket.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Expertise Necessária

${ticket.requiredExpertise.map(e => `- ${e}`).join('\n')}

## Estratégia de Teste

${ticket.testingStrategy}

## Plano de Rollback

${ticket.rollbackPlan}

## Flags

- **Paralelizável:** ${ticket.parallelizable ? 'Sim' : 'Não'}
- **Implementável por AI:** ${ticket.aiAgentCapable ? 'Sim' : 'Não'}

## Dependências

${ticket.dependencies.length > 0 
  ? ticket.dependencies.map(d => `- Depende do ticket #${d}`).join('\n')
  : 'Nenhuma dependência'}
`;
}

/**
 * Call Bedrock with retry logic
 */
async function callBedrock(
  modelId: string,
  prompt: string,
  maxTokens: number = 4096,
  retries: number = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const command = new ConverseCommand({
        modelId,
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens,
          temperature: 0.7,
          topP: 0.9,
        },
      });

      const response = await bedrockClient.send(command);
      const content = response.output?.message?.content;
      
      if (!content || !content[0] || !content[0].text) {
        throw new Error('Invalid response from Bedrock');
      }

      return content[0].text;
    } catch (error) {
      console.error(`Bedrock call attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to call Bedrock after all retries');
}

/**
 * Parse Bedrock response (extract JSON from markdown code blocks if needed)
 */
function parseBedrockResponse(response: string): any {
  try {
    // Try to parse as direct JSON
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Try to extract any JSON object
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    console.error('Failed to parse Bedrock response:', response);
    throw new Error('Could not parse Bedrock response as JSON');
  }
}

/**
 * Save content to S3
 */
async function saveToS3(key: string, content: string): Promise<void> {
  const bucketName = process.env.STORAGE_BUCKET_NAME;
  
  if (!bucketName) {
    console.warn('STORAGE_BUCKET_NAME not set, skipping S3 upload for:', key);
    return;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: content,
    ContentType: 'text/markdown',
  });

  await s3Client.send(command);
  console.log('Saved to S3:', key);
}
