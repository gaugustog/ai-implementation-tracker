import type { Project, Specification, Ticket, SpecType } from '@/lib/types';

/**
 * Mock API utilities for Claude CLI integration
 * In production, these would call actual Claude CLI commands
 */

export async function generateSpecification(
  projectId: string,
  type: SpecType,
  prompt: string
): Promise<Specification> {
  // Mock implementation - would call Claude CLI in production
  return {
    id: Date.now().toString(),
    type,
    content: `Generated specification for ${type}:\n\n${prompt}`,
    tickets: [],
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function generateTickets(
  specification: Specification,
  count: number = 5
): Promise<Ticket[]> {
  // Mock implementation - would call Claude CLI to split specification into tickets
  const tickets: Ticket[] = [];
  
  for (let i = 1; i <= count; i++) {
    tickets.push({
      id: `${Date.now()}-${i}`,
      title: `${specification.type} Task ${i}`,
      description: `Task ${i} extracted from specification ${specification.id}`,
      status: 'todo',
      specType: specification.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  
  return tickets;
}

export async function analyzeProject(project: Project): Promise<string> {
  // Mock implementation - would call Claude CLI for project analysis
  return `Analysis for project: ${project.name}\n\nThis project needs:\n- Requirements analysis\n- Technical specification\n- Implementation plan`;
}

export async function generatePrompt(type: SpecType, context: string): Promise<string> {
  // Mock implementation - would generate appropriate prompt for Claude CLI
  const prompts = {
    ANALYSIS: `Analyze the following and provide detailed requirements:\n\n${context}`,
    FIXES: `Identify and suggest fixes for issues in:\n\n${context}`,
    PLANS: `Create a detailed implementation plan for:\n\n${context}`,
    REVIEWS: `Review and provide feedback on:\n\n${context}`,
  };
  
  return prompts[type];
}
