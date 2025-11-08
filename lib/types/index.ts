export type SpecType = 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  specType: SpecType;
  createdAt: Date;
  updatedAt: Date;
}

export interface Specification {
  id: string;
  type: SpecType;
  content: string;
  tickets: Ticket[];
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  specifications: Specification[];
  createdAt: Date;
  updatedAt: Date;
}
