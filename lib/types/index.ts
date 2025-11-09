export type SpecType = 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';

export interface Ticket {
  id: string;
  title: string;
  ticketNumber?: number | null;
  epicNumber?: number | null;
  description?: string | null;
  s3MdFileObjectKey?: string | null;
  acceptanceCriteria?: string[] | null;
  estimatedMinutes?: number | null;
  complexity?: 'simple' | 'medium' | 'complex' | null;
  parallelizable?: boolean | null;
  aiAgentCapable?: boolean | null;
  requiredExpertise?: string[] | null;
  testingStrategy?: string | null;
  rollbackPlan?: string | null;
  status?: 'todo' | 'in_progress' | 'done' | null;
  specType?: SpecType | null;
  fileKey?: string | null; // S3 file key for markdown file
  specificationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Epic {
  id: string;
  title: string;
  epicNumber: number;
  description?: string | null;
  specificationId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TicketDependency {
  id: string;
  ticketId: string;
  dependsOnId: string;
  dependencyType?: 'blocks' | 'requires' | 'relates_to' | null;
  createdAt?: string | null;
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
