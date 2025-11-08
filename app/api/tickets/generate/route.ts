import { NextResponse } from 'next/server';

/**
 * API route for ticket generation
 * Proxies requests to the ticket generation Lambda function
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lambdaUrl = process.env.TICKET_GENERATION_URL;

    if (!lambdaUrl) {
      // Mock response for development
      console.log('Using mock ticket generation (TICKET_GENERATION_URL not set)');
      
      const mockTickets = [
        {
          title: 'Implementar autenticação de usuários',
          description: 'Criar sistema de autenticação usando AWS Cognito com login social',
          acceptanceCriteria: [
            'Usuário pode fazer login com email/senha',
            'Integração com Google OAuth funcional',
            'Token JWT gerado e validado corretamente',
          ],
          estimatedHours: 16,
          complexity: 'medium',
          dependencies: [],
          parallelizable: true,
          aiAgentCapable: true,
          requiredExpertise: ['AWS Cognito', 'OAuth 2.0', 'JWT'],
          testingStrategy: 'Testes unitários para validação de token, testes de integração para fluxo OAuth',
          rollbackPlan: 'Reverter para autenticação mock, remover tabelas de usuário do banco',
        },
        {
          title: 'Configurar banco de dados DynamoDB',
          description: 'Criar tabelas e índices necessários para armazenamento de dados',
          acceptanceCriteria: [
            'Tabelas criadas com schema correto',
            'Índices GSI configurados',
            'IAM roles com permissões adequadas',
          ],
          estimatedHours: 8,
          complexity: 'simple',
          dependencies: [],
          parallelizable: true,
          aiAgentCapable: true,
          requiredExpertise: ['DynamoDB', 'AWS IAM'],
          testingStrategy: 'Validar estrutura de tabelas, testar operações CRUD',
          rollbackPlan: 'Deletar tabelas usando CloudFormation rollback',
        },
        {
          title: 'Criar API REST com Express',
          description: 'Implementar endpoints RESTful para operações CRUD',
          acceptanceCriteria: [
            'Endpoints /api/users, /api/projects funcionais',
            'Validação de entrada implementada',
            'Documentação OpenAPI gerada',
          ],
          estimatedHours: 24,
          complexity: 'complex',
          dependencies: ['Implementar autenticação de usuários', 'Configurar banco de dados DynamoDB'],
          parallelizable: false,
          aiAgentCapable: true,
          requiredExpertise: ['Express.js', 'OpenAPI', 'REST APIs'],
          testingStrategy: 'Testes de integração com Supertest, validação de schema',
          rollbackPlan: 'Reverter para versão anterior da API, manter compatibilidade',
        },
      ];

      return NextResponse.json({
        status: 'completed',
        tickets: mockTickets,
        summaryPath: `specs/${body.specificationId}/SUMMARY.md`,
        executionPlanPath: `specs/${body.specificationId}/EXECUTION_PLAN.md`,
        intermediateResults: {},
        tokensUsed: 15000,
        totalCost: 0.15,
        timestamp: new Date().toISOString(),
      });
    }

    // Call Lambda function
    const response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Lambda function responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in ticket generation API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate tickets',
        details: error instanceof Error ? error.message : 'Unknown error',
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
