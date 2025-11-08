'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Box, 
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { Plus, FolderKanban, Calendar, FileText } from 'lucide-react';
import type { Project } from '@/lib/types';
import { projectAPI } from '@/lib/api/amplify';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectAPI.list();
      setProjects(data as Project[]);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Using placeholder configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (newProject.name.trim()) {
      try {
        const project = await projectAPI.create({
          name: newProject.name,
          description: newProject.description,
        });
        setProjects([...projects, project as Project]);
        setNewProject({ name: '', description: '' });
        setOpenDialog(false);
      } catch (err) {
        console.error('Error creating project:', err);
        setError('Failed to create project. Please check your Amplify configuration.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
            Projects
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
            Manage your spec-driven development projects
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={() => setOpenDialog(true)}
          sx={{
            backgroundColor: 'rgb(244 63 94)',
            '&:hover': { backgroundColor: 'rgb(225 29 72)' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'rgb(244 63 94)' }} />
        </Box>
      ) : projects.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
            textAlign: 'center',
            py: 8,
          }}
        >
          <CardContent>
            <FolderKanban size={48} className="text-zinc-600 mx-auto mb-4" />
            <Typography variant="h6" sx={{ color: 'rgb(250 250 250)', mb: 2 }}>
              No projects yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 3 }}>
              Create your first project to start managing specifications
            </Typography>
            <Button
              variant="contained"
              onClick={() => setOpenDialog(true)}
              sx={{
                backgroundColor: 'rgb(244 63 94)',
                '&:hover': { backgroundColor: 'rgb(225 29 72)' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
              <Card
                sx={{
                  backgroundColor: 'rgb(39 39 42)',
                  border: '1px solid rgb(63 63 70)',
                  '&:hover': {
                    borderColor: 'rgb(244 63 94)',
                  },
                  transition: 'border-color 0.2s',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'start', mb: 2 }}>
                    <FolderKanban size={24} className="text-rose-500 mr-2" />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)' }}>
                      {project.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 2 }}>
                    {project.description || 'No description'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<FileText size={14} />}
                      label={`${project.specifications?.length || 0} specs`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgb(24 24 27)',
                        color: 'rgb(161 161 170)',
                        border: '1px solid rgb(63 63 70)',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'rgb(161 161 170)' }}>
                    <Calendar size={14} className="mr-1" />
                    <Typography variant="caption">
                      {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
          }
        }}
      >
        <DialogTitle sx={{ color: 'rgb(250 250 250)' }}>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'rgb(250 250 250)',
                '& fieldset': { borderColor: 'rgb(63 63 70)' },
                '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
              },
              '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
            }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'rgb(250 250 250)',
                '& fieldset': { borderColor: 'rgb(63 63 70)' },
                '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
              },
              '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setOpenDialog(false)}
            sx={{ 
              color: 'rgb(161 161 170)',
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateProject}
            variant="contained"
            sx={{
              backgroundColor: 'rgb(244 63 94)',
              '&:hover': { backgroundColor: 'rgb(225 29 72)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
