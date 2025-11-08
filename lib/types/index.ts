export type SpecType = 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';

export interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | null;
  specType?: SpecType | null;
  fileKey?: string | null; // S3 file key for markdown file
  specificationId?: string | null;
  // Extended fields for AI-generated tickets
  acceptanceCriteria?: string[] | null;
  estimatedHours?: number | null;
  complexity?: 'simple' | 'medium' | 'complex' | null;
  dependencies?: string[] | null;
  parallelizable?: boolean | null;
  aiAgentCapable?: boolean | null;
  requiredExpertise?: string[] | null;
  testingStrategy?: string | null;
  rollbackPlan?: string | null;
  ticketGenerationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface GeneratedTicket {
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

export interface TicketGeneration {
  id: string;
  specificationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  summaryFileKey?: string | null;
  executionPlanFileKey?: string | null;
  intermediateResults?: any | null;
  errorMessage?: string | null;
  tokensUsed?: number | null;
  totalCost?: number | null;
  generatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  tickets?: Ticket[];
}

export interface Specification {
  id: string;
  type?: SpecType | null;
  content?: string | null;
  fileKey?: string | null; // S3 file key for markdown file
  projectId: string;
  tickets?: Ticket[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  specifications?: Specification[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SpecificationDraft {
  id: string;
  content?: string | null;
  conversationHistory?: ConversationMessage[] | null;
  aiSuggestions?: any | null;
  version?: number | null;
  projectId: string;
  project?: Project;
  status?: 'draft' | 'reviewing' | 'finalized' | null;
  type?: SpecType | null;
  sessionId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SpecificationContext {
  projectId: string;
  projectName?: string;
  projectDescription?: string;
  specType: SpecType;
  existingContent?: string;
}

export interface ConversationRequest {
  message: string;
  conversationHistory: ConversationMessage[];
  context: SpecificationContext;
  sessionId: string;
}

export interface ConversationResponse {
  response: string;
  sessionId: string;
  timestamp: string;
}
