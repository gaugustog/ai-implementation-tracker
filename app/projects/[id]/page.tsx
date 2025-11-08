'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack, Code, Description } from '@mui/icons-material';
import { GitIntegrationPanel } from '@/components/git/GitIntegrationPanel';
import { CodebaseContextViewer } from '@/components/git/CodebaseContextViewer';
import type { Project } from '@/lib/types';
import { projectAPI } from '@/lib/api/amplify';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [codebaseContext, setCodebaseContext] = useState<{
    techStack?: any;
    patterns?: any;
    integrationPoints?: any;
    metrics?: any;
  } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectAPI.get(projectId);
      setProject(data as Project);
    } catch (err) {
      console.error('Error loading project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleRepositoryConnected = async (repositoryId: string) => {
    console.log('Repository connected:', repositoryId);
    // Optionally trigger analysis or refresh
    loadCodebaseContext();
  };

  const loadCodebaseContext = async () => {
    setContextLoading(true);
    try {
      const response = await fetch('/api/code-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'getContext',
          projectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCodebaseContext(data.context);
      }
    } catch (err) {
      console.error('Error loading codebase context:', err);
    } finally {
      setContextLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 1 && !codebaseContext) {
      loadCodebaseContext();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Project not found'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/projects')} sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <div className="space-y-6">
      <Box>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => router.push('/projects')}
          sx={{ mb: 2, color: 'rgb(161 161 170)' }}
        >
          Back to Projects
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
          {project.name}
        </Typography>
        {project.description && (
          <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
            {project.description}
          </Typography>
        )}
      </Box>

      <Card
        sx={{
          backgroundColor: 'rgb(39 39 42)',
          border: '1px solid rgb(63 63 70)',
        }}
      >
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab
                icon={<Code />}
                label="Git Integration"
                iconPosition="start"
                sx={{ textTransform: 'none', color: 'rgb(161 161 170)' }}
              />
              <Tab
                icon={<Description />}
                label="Codebase Context"
                iconPosition="start"
                sx={{ textTransform: 'none', color: 'rgb(161 161 170)' }}
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <GitIntegrationPanel projectId={projectId} onConnected={handleRepositoryConnected} />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {contextLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : codebaseContext ? (
              <CodebaseContextViewer context={codebaseContext} />
            ) : (
              <Alert severity="info">
                No codebase context available. Connect a Git repository and sync to analyze your codebase.
              </Alert>
            )}
          </TabPanel>
        </CardContent>
      </Card>
    </div>
  );
}
