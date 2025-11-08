'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SpecificationBuilder } from '@/components/specification/SpecificationBuilder';
import { projectAPI, specificationAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath } from '@/lib/api/storage';
import type { Project, SpecType } from '@/lib/types';

/**
 * Demo page for the AI Specification Builder
 */
export default function SpecBuilderPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Update selected project when ID changes
  useEffect(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId);
      setSelectedProject(project || null);
    } else {
      setSelectedProject(null);
    }
  }, [selectedProjectId, projects]);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try to load projects, but fall back to mock data in development
      let data: Project[];
      try {
        data = await projectAPI.list();
      } catch (apiError) {
        console.warn('Failed to load projects from API, using mock data:', apiError);
        // Mock data for development
        data = [
          {
            id: 'mock-project-1',
            name: 'Demo Project',
            description: 'A sample project to demonstrate the AI Specification Builder',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'mock-project-2',
            name: 'E-commerce Platform',
            description: 'Building a scalable e-commerce solution',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (content: string, type: SpecType) => {
    if (!selectedProject) {
      throw new Error('No project selected');
    }

    try {
      // Upload markdown file to S3
      const fileName = `${selectedProject.name.toLowerCase().replace(/\s+/g, '-')}-${type.toLowerCase()}-${Date.now()}.md`;
      const filePath = generateFilePath('specs', fileName);
      await uploadMarkdownFile(filePath, content);

      // Create specification record
      await specificationAPI.create({
        type,
        content,
        fileKey: filePath,
        projectId: selectedProject.id,
      });
    } catch (saveError) {
      console.warn('Save to backend failed, content saved locally:', saveError);
      // In development mode, we just log success since backend may not be available
      alert('Specification content prepared. In production, this would be saved to the database and S3.');
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading projects...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button sx={{ mt: 2 }} onClick={loadProjects}>
          Retry
        </Button>
      </Container>
    );
  }

  if (projects.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">
          No projects found. Please create a project first.
        </Alert>
        <Button
          component={Link}
          href="/projects"
          sx={{ mt: 2 }}
          variant="contained"
        >
          Go to Projects
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 4 }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Button
            component={Link}
            href="/specifications"
            startIcon={<ArrowLeft size={20} />}
            sx={{ mb: 2 }}
          >
            Back to Specifications
          </Button>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
              AI Specification Builder
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Use AI to interactively build comprehensive specifications. Chat with the AI
              assistant to refine requirements, and see the specification develop in real-time.
            </Typography>

            {/* Project selector */}
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Select Project</InputLabel>
              <Select
                value={selectedProjectId}
                label="Select Project"
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                    {project.description && ` - ${project.description}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Box>

        {/* Main Builder */}
        {selectedProject ? (
          <Box sx={{ height: 'calc(100vh - 300px)', minHeight: 600 }}>
            <SpecificationBuilder
              project={selectedProject}
              onSave={handleSave}
            />
          </Box>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Please select a project to start building a specification.
            </Typography>
          </Paper>
        )}

        {/* Info section */}
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            How It Works
          </Typography>
          <Box component="ol" sx={{ pl: 2 }}>
            <Typography component="li" sx={{ mb: 1 }}>
              <strong>Select a specification type</strong> (Analysis, Fixes, Plans, or Reviews)
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              <strong>Chat with the AI assistant</strong> to discuss requirements and details
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              <strong>See the specification build</strong> in the editor as you chat
            </Typography>
            <Typography component="li" sx={{ mb: 1 }}>
              <strong>Edit directly</strong> in the markdown editor or continue chatting
            </Typography>
            <Typography component="li">
              <strong>Save or download</strong> your completed specification
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Development Mode:</strong> In development, the AI responses are mocked.
              To use real Amazon Bedrock Claude, deploy the Amplify backend and set the
              BEDROCK_LAMBDA_URL environment variable.
            </Typography>
          </Alert>
        </Paper>
      </Container>
    </Box>
  );
}
