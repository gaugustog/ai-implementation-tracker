import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  callBedrockWithRetry,
  extractJSON,
  validateSpecificationSize,
} from './bedrock-utils';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME;

// Type definitions matching the problem statement requirements
interface GeneratedTicket {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  estimatedHours: number;
  complexity: 'simple' | 'medium' | 'complex';
  dependencies: string[];
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
  language?: string;
}

/**
 * Main handler for ticket generation pipeline
 */
export const handler = async (event: any) => {
  console.log('Ticket generation started');

  try {
    const request: TicketGenerationRequest =
      typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    const { specificationId, specificationContent, projectContext, language = 'pt-BR' } = request;

    if (!specificationId || !specificationContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: specificationId or specificationContent',
        }),
      };
    }

    // Validate specification size
    try {
      validateSpecificationSize(specificationContent);
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Specification too large',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }

    let tokensUsed = 0;

    // Step 1: Parse Specification
    console.log('Step 1: Parsing specification...');
    const parseResult = await parseSpecification(specificationContent, language);
    tokensUsed += parseResult.tokensUsed;

    // Step 2: Identify Components
    console.log('Step 2: Identifying components...');
    const componentsResult = await identifyComponents(parseResult.parsed, projectContext, language);
    tokensUsed += componentsResult.tokensUsed;

    // Step 3: Generate Tickets
    console.log('Step 3: Generating tickets...');
    const ticketsResult = await generateTickets(
      componentsResult.components,
      parseResult.parsed,
      language
    );
    tokensUsed += ticketsResult.tokensUsed;

    // Step 4: Analyze Dependencies
    console.log('Step 4: Analyzing dependencies...');
    const dependenciesResult = await analyzeDependencies(ticketsResult.tickets, language);
    tokensUsed += dependenciesResult.tokensUsed;

    // Step 5: Optimize Parallelization
    console.log('Step 5: Optimizing parallelization...');
    const parallelizationResult = await optimizeParallelization(
      dependenciesResult.enhancedTickets,
      language
    );
    tokensUsed += parallelizationResult.tokensUsed;

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
    tokensUsed += documentsResult.tokensUsed;

    // Calculate cost (simplified: $10 per million tokens)
    const totalCost = (tokensUsed / 1000000) * 10;

    console.log(`Ticket generation completed. Tokens: ${tokensUsed}, Cost: $${totalCost.toFixed(2)}`);

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

async function parseSpecification(content: string, language: string) {
  const systemPrompt =
    language === 'pt-BR'
      ? `Analise a especificação e extraia em JSON: objetivo, requisitos funcionais, requisitos não-funcionais, componentes, restrições técnicas, critérios de sucesso.`
      : `Analyze the specification and extract as JSON: objective, functional requirements, non-functional requirements, components, technical constraints, success criteria.`;

  const result = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [{ role: 'user', content: [{ text: `${systemPrompt}\n\n${content}` }] }],
    temperature: 0.3,
  });

  return { parsed: extractJSON(result.response), tokensUsed: result.tokensUsed };
}

async function identifyComponents(parsedSpec: any, projectContext: any, language: string) {
  const contextInfo = projectContext
    ? `\nContexto: ${JSON.stringify(projectContext.techStack || {})}`
    : '';

  const systemPrompt =
    language === 'pt-BR'
      ? `Identifique componentes implementáveis em 1-3 dias. Retorne JSON: { "components": [{ "name", "description", "estimatedDays", "dependencies": [] }] }${contextInfo}`
      : `Identify components implementable in 1-3 days. Return JSON: { "components": [{ "name", "description", "estimatedDays", "dependencies": [] }] }${contextInfo}`;

  const result = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [{ role: 'user', content: [{ text: `${systemPrompt}\n\n${JSON.stringify(parsedSpec)}` }] }],
    temperature: 0.4,
  });

  return { components: extractJSON(result.response).components || [], tokensUsed: result.tokensUsed };
}

async function generateTickets(components: any[], parsedSpec: any, language: string) {
  const tickets: GeneratedTicket[] = [];
  let totalTokens = 0;

  const batchSize = 5;
  for (let i = 0; i < components.length; i += batchSize) {
    const batch = components.slice(i, i + batchSize);

    const systemPrompt =
      language === 'pt-BR'
        ? `Crie tickets detalhados para cada componente com: title, description, acceptanceCriteria[], estimatedHours (8-72h), complexity (simple/medium/complex), dependencies[], parallelizable, aiAgentCapable, requiredExpertise[], testingStrategy, rollbackPlan. JSON: { "tickets": [GeneratedTicket] }`
        : `Create detailed tickets for each component with: title, description, acceptanceCriteria[], estimatedHours (8-72h), complexity (simple/medium/complex), dependencies[], parallelizable, aiAgentCapable, requiredExpertise[], testingStrategy, rollbackPlan. JSON: { "tickets": [GeneratedTicket] }`;

    const result = await callBedrockWithRetry({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      messages: [
        {
          role: 'user',
          content: [{ text: `${systemPrompt}\n\nComponentes: ${JSON.stringify(batch)}` }],
        },
      ],
      temperature: 0.5,
    });

    const batchTickets = extractJSON(result.response).tickets || [];
    tickets.push(...batchTickets);
    totalTokens += result.tokensUsed;
  }

  return { tickets, tokensUsed: totalTokens };
}

async function analyzeDependencies(tickets: GeneratedTicket[], language: string) {
  const systemPrompt =
    language === 'pt-BR'
      ? `Analise dependências dos tickets. Retorne JSON: { "dependencyGraph": { "nodes": [], "edges": [] }, "criticalPath": [], "enhancedTickets": [], "warnings": [] }`
      : `Analyze ticket dependencies. Return JSON: { "dependencyGraph": { "nodes": [], "edges": [] }, "criticalPath": [], "enhancedTickets": [], "warnings": [] }`;

  const result = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    messages: [{ role: 'user', content: [{ text: `${systemPrompt}\n\n${JSON.stringify(tickets)}` }] }],
    temperature: 0.3,
  });

  const parsed = extractJSON(result.response);
  return {
    dependencyGraph: parsed.dependencyGraph || { nodes: [], edges: [] },
    criticalPath: parsed.criticalPath || [],
    enhancedTickets: parsed.enhancedTickets || tickets,
    warnings: parsed.warnings || [],
    tokensUsed: result.tokensUsed,
  };
}

async function optimizeParallelization(tickets: GeneratedTicket[], language: string) {
  const systemPrompt =
    language === 'pt-BR'
      ? `Otimize execução paralela para agentes AI. Retorne JSON: { "executionTracks": [{ "trackId", "tickets": [], "estimatedDays" }], "finalTickets": [], "recommendations": [] }`
      : `Optimize parallel execution for AI agents. Return JSON: { "executionTracks": [{ "trackId", "tickets": [], "estimatedDays" }], "finalTickets": [], "recommendations": [] }`;

  const result = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    messages: [{ role: 'user', content: [{ text: `${systemPrompt}\n\n${JSON.stringify(tickets)}` }] }],
    temperature: 0.4,
  });

  const parsed = extractJSON(result.response);
  return {
    executionTracks: parsed.executionTracks || [],
    finalTickets: parsed.finalTickets || tickets,
    recommendations: parsed.recommendations || [],
    tokensUsed: result.tokensUsed,
  };
}

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
  const summaryPrompt =
    language === 'pt-BR'
      ? `Crie SUMMARY.md em português com: Resumo Executivo (2-3 parágrafos), Breakdown de Tickets (total, por complexidade), Caminho Crítico, Matriz de Risco, Requisitos de Recursos, Estimativa de Timeline.\n\nDados: ${JSON.stringify({ tickets, parsedSpec }, null, 2)}`
      : `Create SUMMARY.md in Portuguese with: Executive Summary (2-3 paragraphs), Ticket Breakdown (total, by complexity), Critical Path, Risk Matrix, Resource Requirements, Timeline Estimate.\n\nData: ${JSON.stringify({ tickets, parsedSpec }, null, 2)}`;

  const summaryResult = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    messages: [{ role: 'user', content: [{ text: summaryPrompt }] }],
    temperature: 0.5,
    maxTokens: 4096,
  });
  totalTokens += summaryResult.tokensUsed;

  // Generate EXECUTION_PLAN.md
  const executionPrompt =
    language === 'pt-BR'
      ? `Crie EXECUTION_PLAN.md em português com: Trilhas de Execução Paralela, Dependências Sequenciais, Recomendações de Agentes, Pontos de Integração, Checkpoints de Teste, Estratégias de Rollback.\n\nDados: ${JSON.stringify({ tickets, executionTracks }, null, 2)}`
      : `Create EXECUTION_PLAN.md in Portuguese with: Parallel Execution Tracks, Sequential Dependencies, Agent Recommendations, Integration Points, Test Checkpoints, Rollback Strategies.\n\nData: ${JSON.stringify({ tickets, executionTracks }, null, 2)}`;

  const executionResult = await callBedrockWithRetry({
    modelId: 'anthropic.claude-3-opus-20240229-v1:0',
    messages: [{ role: 'user', content: [{ text: executionPrompt }] }],
    temperature: 0.5,
    maxTokens: 4096,
  });
  totalTokens += executionResult.tokensUsed;

  // Save to S3
  const summaryKey = `specs/${specificationId}/SUMMARY.md`;
  const executionKey = `specs/${specificationId}/EXECUTION_PLAN.md`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: summaryKey,
      Body: summaryResult.response,
      ContentType: 'text/markdown',
    })
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: executionKey,
      Body: executionResult.response,
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
${ticket.dependencies.length > 0 ? ticket.dependencies.map((d) => `- ${d}`).join('\n') : 'Nenhuma'}

## Expertise Necessária
${ticket.requiredExpertise.map((e) => `- ${e}`).join('\n')}

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

  return { summaryPath: summaryKey, executionPlanPath: executionKey, tokensUsed: totalTokens };
}
