export type SpecType = 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';

export interface Ticket {
  id: string;
  title: string;
  description?: string | null;
  status?: 'todo' | 'in-progress' | 'done' | null;
  specType?: SpecType | null;
  fileKey?: string | null; // S3 file key for markdown file
  specificationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
