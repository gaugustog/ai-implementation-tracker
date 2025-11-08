import { NextRequest, NextResponse } from 'next/server';

/**
 * API route for ticket generation
 * Proxies requests to the Amplify Lambda function
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get Lambda URL from environment
    const lambdaUrl = process.env.TICKET_GENERATION_LAMBDA_URL;
    
    if (!lambdaUrl) {
      console.warn('TICKET_GENERATION_LAMBDA_URL not configured, using mock response');
      return NextResponse.json(createMockResponse(body), { status: 200 });
    }

    // Forward request to Lambda
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to generate tickets' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in ticket generation API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate tickets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Create mock response for development
 */
function createMockResponse(body: any) {
  const { specificationId, specType, planNamePrefix } = body;
  
  const mockTickets = [
    {
      title: 'Configurar estrutura inicial do projeto',
      ticketNumber: 1,
      epicNumber: 1,
      description: 'Criar estrutura base do projeto com configuração inicial',
      acceptanceCriteria: [
        'Estrutura de pastas criada',
        'Dependências instaladas',
        'Configuração base documentada',
      ],
      estimatedMinutes: 240,
      complexity: 'simple',
      parallelizable: false,
      aiAgentCapable: true,
      requiredExpertise: ['Setup', 'DevOps'],
      testingStrategy: 'Verificar build e estrutura',
      rollbackPlan: 'Remover arquivos criados',
      status: 'todo',
      specType,
      dependencies: [],
      s3MdFileObjectKey: `specs/${specificationId}/tickets/${planNamePrefix}-001-01-configurar-estrutura.md`,
    },
    {
      title: 'Implementar componente principal',
      ticketNumber: 2,
      epicNumber: 1,
      description: 'Desenvolver o componente core da aplicação',
      acceptanceCriteria: [
        'Componente implementado',
        'Testes unitários passando',
        'Documentação atualizada',
      ],
      estimatedMinutes: 480,
      complexity: 'medium',
      parallelizable: false,
      aiAgentCapable: true,
      requiredExpertise: ['React', 'TypeScript'],
      testingStrategy: 'Testes unitários e de integração',
      rollbackPlan: 'Reverter para versão anterior',
      status: 'todo',
      specType,
      dependencies: [1],
      s3MdFileObjectKey: `specs/${specificationId}/tickets/${planNamePrefix}-002-01-implementar-componente.md`,
    },
    {
      title: 'Adicionar validação e tratamento de erros',
      ticketNumber: 3,
      epicNumber: 2,
      description: 'Implementar validação de inputs e tratamento de erros',
      acceptanceCriteria: [
        'Validações implementadas',
        'Mensagens de erro claras',
        'Testes de erro passando',
      ],
      estimatedMinutes: 360,
      complexity: 'medium',
      parallelizable: true,
      aiAgentCapable: true,
      requiredExpertise: ['Validation', 'Error Handling'],
      testingStrategy: 'Testes de casos de erro',
      rollbackPlan: 'Reverter commit',
      status: 'todo',
      specType,
      dependencies: [2],
      s3MdFileObjectKey: `specs/${specificationId}/tickets/${planNamePrefix}-003-02-adicionar-validacao.md`,
    },
  ];

  const mockEpics = [
    {
      epicNumber: 1,
      title: 'Setup e Componente Base',
      description: 'Configuração inicial e implementação do componente principal',
      tickets: mockTickets.filter(t => t.epicNumber === 1),
    },
    {
      epicNumber: 2,
      title: 'Validação e Qualidade',
      description: 'Adicionar validações e melhorias de qualidade',
      tickets: mockTickets.filter(t => t.epicNumber === 2),
    },
  ];

  const mockDependencyGraph = {
    dependencyMatrix: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    criticalPath: [1, 2, 3],
    parallelGroups: [[1], [2], [3]],
    blockers: [1, 2],
  };

  return {
    tickets: mockTickets,
    epics: mockEpics,
    summaryPath: `specs/${specificationId}/SUMMARY.md`,
    executionPlanPath: `specs/${specificationId}/EXECUTION_PLAN.md`,
    dependencyGraph: mockDependencyGraph,
  };
}
