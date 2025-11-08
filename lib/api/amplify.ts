import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

// Generate the Amplify Data client
export const client = generateClient<Schema>();

// Project operations
export const projectAPI = {
  list: async () => {
    const { data, errors } = await client.models.Project.list();
    if (errors) throw new Error(errors[0].message);
    // Map the data to match our interface
    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      specifications: [], // Will be loaded separately if needed
    }));
  },

  create: async (project: { name: string; description?: string }) => {
    const { data, errors } = await client.models.Project.create({
      name: project.name,
      description: project.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Failed to create project');
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      specifications: [],
    };
  },

  get: async (id: string) => {
    const { data, errors } = await client.models.Project.get({ id });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Project not found');
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      specifications: [],
    };
  },

  update: async (id: string, updates: Partial<{ name: string; description: string }>) => {
    const { data, errors } = await client.models.Project.update({
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Project not found');
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      specifications: [],
    };
  },

  delete: async (id: string) => {
    const { data, errors } = await client.models.Project.delete({ id });
    if (errors) throw new Error(errors[0].message);
    return data;
  },
};

// Specification operations
export const specificationAPI = {
  list: async (projectId?: string) => {
    if (projectId) {
      const { data, errors } = await client.models.Specification.list({
        filter: { projectId: { eq: projectId } },
      });
      if (errors) throw new Error(errors[0].message);
      return data.map(item => ({
        id: item.id,
        type: item.type,
        content: item.content,
        fileKey: item.fileKey,
        projectId: item.projectId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        tickets: [],
      }));
    }
    const { data, errors } = await client.models.Specification.list();
    if (errors) throw new Error(errors[0].message);
    return data.map(item => ({
      id: item.id,
      type: item.type,
      content: item.content,
      fileKey: item.fileKey,
      projectId: item.projectId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tickets: [],
    }));
  },

  create: async (spec: {
    type: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
    content?: string;
    fileKey?: string;
    projectId: string;
  }) => {
    const { data, errors } = await client.models.Specification.create({
      type: spec.type,
      content: spec.content || '',
      fileKey: spec.fileKey,
      projectId: spec.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Failed to create specification');
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      fileKey: data.fileKey,
      projectId: data.projectId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tickets: [],
    };
  },

  get: async (id: string) => {
    const { data, errors } = await client.models.Specification.get({ id });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Specification not found');
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      fileKey: data.fileKey,
      projectId: data.projectId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tickets: [],
    };
  },

  update: async (
    id: string,
    updates: Partial<{
      type: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
      content: string;
      fileKey: string;
    }>
  ) => {
    const { data, errors } = await client.models.Specification.update({
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Specification not found');
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      fileKey: data.fileKey,
      projectId: data.projectId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tickets: [],
    };
  },

  delete: async (id: string) => {
    const { data, errors } = await client.models.Specification.delete({ id });
    if (errors) throw new Error(errors[0].message);
    return data;
  },
};

// Ticket operations
export const ticketAPI = {
  list: async (specificationId?: string) => {
    if (specificationId) {
      const { data, errors } = await client.models.Ticket.list({
        filter: { specificationId: { eq: specificationId } },
      });
      if (errors) throw new Error(errors[0].message);
      return data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        status: item.status,
        specType: item.specType,
        fileKey: item.fileKey,
        specificationId: item.specificationId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
    }
    const { data, errors } = await client.models.Ticket.list();
    if (errors) throw new Error(errors[0].message);
    return data.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      specType: item.specType,
      fileKey: item.fileKey,
      specificationId: item.specificationId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  },

  create: async (ticket: {
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done';
    specType: 'ANALYSIS' | 'FIXES' | 'PLANS' | 'REVIEWS';
    fileKey?: string;
    specificationId?: string;
  }) => {
    const { data, errors } = await client.models.Ticket.create({
      title: ticket.title,
      description: ticket.description || '',
      status: ticket.status,
      specType: ticket.specType,
      fileKey: ticket.fileKey,
      specificationId: ticket.specificationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Failed to create ticket');
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      specType: data.specType,
      fileKey: data.fileKey,
      specificationId: data.specificationId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },

  get: async (id: string) => {
    const { data, errors } = await client.models.Ticket.get({ id });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Ticket not found');
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      specType: data.specType,
      fileKey: data.fileKey,
      specificationId: data.specificationId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },

  update: async (
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      status: 'todo' | 'in_progress' | 'done';
      fileKey: string;
    }>
  ) => {
    const { data, errors } = await client.models.Ticket.update({
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors[0].message);
    if (!data) throw new Error('Ticket not found');
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      specType: data.specType,
      fileKey: data.fileKey,
      specificationId: data.specificationId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },

  delete: async (id: string) => {
    const { data, errors } = await client.models.Ticket.delete({ id });
    if (errors) throw new Error(errors[0].message);
    return data;
  },
};
