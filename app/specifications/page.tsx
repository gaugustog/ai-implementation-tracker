'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Tabs,
  Tab,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { FileText, Plus, Upload } from 'lucide-react';
import type { Specification, SpecType, Project } from '@/lib/types';
import { specificationAPI, projectAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath } from '@/lib/api/storage';

export default function SpecificationsPage() {
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<SpecType | 'ALL'>('ALL');
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSpec, setNewSpec] = useState({
    type: 'ANALYSIS' as SpecType,
    content: '',
    projectId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [specsData, projectsData] = await Promise.all([
        specificationAPI.list(),
        projectAPI.list(),
      ]);
      setSpecifications(specsData as Specification[]);
      setProjects(projectsData as Project[]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load specifications. Using placeholder configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSpec = async () => {
    if (newSpec.content.trim() && newSpec.projectId) {
      try {
        // Upload markdown file to S3
        const fileName = `${newSpec.type.toLowerCase()}_${Date.now()}.md`;
        const filePath = generateFilePath('specs', fileName);
        await uploadMarkdownFile(filePath, newSpec.content);

        // Create specification record in AppSync
        const spec = await specificationAPI.create({
          type: newSpec.type,
          content: newSpec.content,
          fileKey: filePath,
          projectId: newSpec.projectId,
        });

        setSpecifications([...specifications, spec as Specification]);
        setNewSpec({ type: 'ANALYSIS', content: '', projectId: '' });
        setOpenDialog(false);
      } catch (err) {
        console.error('Error creating specification:', err);
        setError('Failed to create specification. Please check your Amplify configuration.');
      }
    }
  };

  const specTypes: (SpecType | 'ALL')[] = ['ALL', 'ANALYSIS', 'FIXES', 'PLANS', 'REVIEWS'];

  const filteredSpecs = activeTab === 'ALL' 
    ? specifications 
    : specifications.filter(spec => spec.type === activeTab);

  const getSpecColor = (type?: SpecType | null) => {
    if (!type) return 'rgb(161 161 170)';
    switch (type) {
      case 'ANALYSIS':
        return 'rgb(59 130 246)';
      case 'FIXES':
        return 'rgb(239 68 68)';
      case 'PLANS':
        return 'rgb(34 197 94)';
      case 'REVIEWS':
        return 'rgb(168 85 247)';
    }
  };

  return (
    <div className="space-y-6">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'rgb(250 250 250)', mb: 1 }}>
            Specifications
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgb(161 161 170)' }}>
            Manage specification documents with markdown files in S3
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
          New Specification
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          backgroundColor: 'rgb(39 39 42)',
          border: '1px solid rgb(63 63 70)',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: '1px solid rgb(63 63 70)',
            '& .MuiTab-root': {
              color: 'rgb(161 161 170)',
              textTransform: 'none',
              fontWeight: 600,
              '&.Mui-selected': {
                color: 'rgb(244 63 94)',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'rgb(244 63 94)',
            },
          }}
        >
          {specTypes.map((type) => (
            <Tab key={type} label={type} value={type} />
          ))}
        </Tabs>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'rgb(244 63 94)' }} />
        </Box>
      ) : filteredSpecs.length === 0 ? (
        <Card
          sx={{
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
            textAlign: 'center',
            py: 8,
          }}
        >
          <CardContent>
            <FileText size={48} className="text-zinc-600 mx-auto mb-4" />
            <Typography variant="h6" sx={{ color: 'rgb(250 250 250)', mb: 2 }}>
              No specifications yet
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 3 }}>
              Create specifications to generate prompts for Claude CLI
            </Typography>
            <Button
              variant="contained"
              sx={{
                backgroundColor: 'rgb(244 63 94)',
                '&:hover': { backgroundColor: 'rgb(225 29 72)' },
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Create Specification
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredSpecs.map((spec) => (
            <Grid size={{ xs: 12, md: 6 }} key={spec.id}>
              <Card
                sx={{
                  backgroundColor: 'rgb(39 39 42)',
                  border: '1px solid rgb(63 63 70)',
                  '&:hover': {
                    borderColor: 'rgb(244 63 94)',
                  },
                  transition: 'border-color 0.2s',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'rgb(250 250 250)' }}>
                      Specification #{spec.id}
                    </Typography>
                    <Chip
                      label={spec.type}
                      size="small"
                      sx={{
                        backgroundColor: getSpecColor(spec.type),
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: 'rgb(161 161 170)', mb: 2 }}>
                    {spec.content ? spec.content.substring(0, 150) + '...' : 'No content'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${spec.tickets?.length || 0} tickets`}
                      size="small"
                      sx={{
                        backgroundColor: 'rgb(24 24 27)',
                        color: 'rgb(161 161 170)',
                        border: '1px solid rgb(63 63 70)',
                      }}
                    />
                    {spec.fileKey && (
                      <Chip
                        icon={<FileText size={14} />}
                        label="Has file"
                        size="small"
                        sx={{
                          backgroundColor: 'rgb(24 24 27)',
                          color: 'rgb(161 161 170)',
                          border: '1px solid rgb(63 63 70)',
                        }}
                      />
                    )}
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
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
          }
        }}
      >
        <DialogTitle sx={{ color: 'rgb(250 250 250)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload size={20} />
            Create New Specification
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgb(161 161 170)' }}>Project</InputLabel>
              <Select
                value={newSpec.projectId}
                onChange={(e) => setNewSpec({ ...newSpec, projectId: e.target.value })}
                label="Project"
                sx={{
                  color: 'rgb(250 250 250)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(63 63 70)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(244 63 94)' },
                  '& .MuiSvgIcon-root': { color: 'rgb(161 161 170)' },
                }}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgb(161 161 170)' }}>Type</InputLabel>
              <Select
                value={newSpec.type}
                onChange={(e) => setNewSpec({ ...newSpec, type: e.target.value as SpecType })}
                label="Type"
                sx={{
                  color: 'rgb(250 250 250)',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(63 63 70)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(244 63 94)' },
                  '& .MuiSvgIcon-root': { color: 'rgb(161 161 170)' },
                }}
              >
                <MenuItem value="ANALYSIS">Analysis</MenuItem>
                <MenuItem value="FIXES">Fixes</MenuItem>
                <MenuItem value="PLANS">Plans</MenuItem>
                <MenuItem value="REVIEWS">Reviews</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Content (Markdown)"
              fullWidth
              multiline
              rows={8}
              value={newSpec.content}
              onChange={(e) => setNewSpec({ ...newSpec, content: e.target.value })}
              placeholder="# Specification Title&#10;&#10;## Description&#10;Write your specification content in markdown format..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  fontFamily: 'monospace',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />
          </Box>
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
            onClick={handleCreateSpec}
            variant="contained"
            disabled={!newSpec.projectId || !newSpec.content.trim()}
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
