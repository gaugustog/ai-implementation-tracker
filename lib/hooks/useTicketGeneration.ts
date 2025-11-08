import { useState, useCallback } from 'react';

export interface GeneratedTicket {
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
  dependencies: number[];
  recommendedModel?: string;
  priority?: number;
  executionGroup?: number;
}

export interface Epic {
  epicNumber: number;
  title: string;
  description: string;
  tickets: GeneratedTicket[];
}

export interface DependencyGraph {
  dependencyMatrix: number[][];
  criticalPath: number[];
  parallelGroups: number[][];
  blockers: number[];
}

export interface TicketGenerationResult {
  tickets: GeneratedTicket[];
  epics: Epic[];
  summaryPath: string;
  executionPlanPath: string;
  dependencyGraph: DependencyGraph;
}

export interface TicketGenerationRequest {
  specificationId: string;
  specificationContent: string;
  specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
  projectContext?: {
    techStack?: any;
    patterns?: any;
    integrationPoints?: any;
  };
  planNamePrefix: string;
}

export interface UseTicketGenerationOptions {
  onSuccess?: (result: TicketGenerationResult) => void;
  onError?: (error: Error) => void;
}

export function useTicketGeneration(options?: UseTicketGenerationOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketGenerationResult | null>(null);
  const [progress, setProgress] = useState<string>('');

  const generateTickets = useCallback(
    async (request: TicketGenerationRequest) => {
      setIsGenerating(true);
      setError(null);
      setProgress('Iniciando geração de tickets...');

      try {
        setProgress('Analisando especificação...');
        
        const response = await fetch('/api/ticket-generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate tickets');
        }

        setProgress('Processando resultados...');
        const data: TicketGenerationResult = await response.json();
        
        setResult(data);
        setProgress('Tickets gerados com sucesso!');
        
        if (options?.onSuccess) {
          options.onSuccess(data);
        }

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setProgress('');
        
        if (options?.onError && err instanceof Error) {
          options.onError(err);
        }
        
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setProgress('');
  }, []);

  return {
    generateTickets,
    isGenerating,
    error,
    result,
    progress,
    reset,
  };
}

/**
 * Hook for managing ticket approval and editing
 */
export function useTicketApproval(tickets: GeneratedTicket[]) {
  const [editedTickets, setEditedTickets] = useState<GeneratedTicket[]>(tickets);
  const [approvedTickets, setApprovedTickets] = useState<Set<number>>(new Set());

  const updateTicket = useCallback((ticketNumber: number, updates: Partial<GeneratedTicket>) => {
    setEditedTickets(prev =>
      prev.map(ticket =>
        ticket.ticketNumber === ticketNumber
          ? { ...ticket, ...updates }
          : ticket
      )
    );
  }, []);

  const approveTicket = useCallback((ticketNumber: number) => {
    setApprovedTickets(prev => new Set(prev).add(ticketNumber));
  }, []);

  const unapproveTicket = useCallback((ticketNumber: number) => {
    setApprovedTickets(prev => {
      const next = new Set(prev);
      next.delete(ticketNumber);
      return next;
    });
  }, []);

  const approveAll = useCallback(() => {
    setApprovedTickets(new Set(editedTickets.map(t => t.ticketNumber)));
  }, [editedTickets]);

  const unapproveAll = useCallback(() => {
    setApprovedTickets(new Set());
  }, []);

  const isTicketApproved = useCallback(
    (ticketNumber: number) => approvedTickets.has(ticketNumber),
    [approvedTickets]
  );

  return {
    editedTickets,
    approvedTickets,
    updateTicket,
    approveTicket,
    unapproveTicket,
    approveAll,
    unapproveAll,
    isTicketApproved,
    allApproved: approvedTickets.size === editedTickets.length,
  };
}
