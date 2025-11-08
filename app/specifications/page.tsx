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
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { FileText, Plus, Upload, X, Sparkles, Edit } from 'lucide-react';
import type { Specification, SpecType, Project } from '@/lib/types';
import { specificationAPI, projectAPI } from '@/lib/api/amplify';
import { uploadMarkdownFile, generateFilePath, downloadMarkdownFile } from '@/lib/api/storage';
import { SpecificationChat } from '@/components/specification/SpecificationChat';
import { MarkdownEditor } from '@/components/specification/MarkdownEditor';

type CreateMode = 'paste' | 'upload' | 'prompt';

export default function SpecificationsPage() {
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<SpecType | 'ALL'>('ALL');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('prompt');
  const [selectedSpec, setSelectedSpec] = useState<Specification | null>(null);
  const [editContent, setEditContent] = useState('');
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
      
      // Try to load data, use mock data as fallback
      let specsData: Specification[] = [];
      let projectsData: Project[] = [];
      
      try {
        [specsData, projectsData] = await Promise.all([
          specificationAPI.list(),
          projectAPI.list(),
        ]);
      } catch (apiError) {
        console.warn('Failed to load from API, using mock data:', apiError);
        // Mock data for development
        projectsData = [
          {
            id: 'mock-project-1',
            name: 'Demo Project',
            description: 'A sample project to demonstrate specifications',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      
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
    if (!newSpec.projectId) {
      setError('Please select a project');
      return;
    }

    try {
      let content = newSpec.content;

      // If mode is prompt, call AI API to generate content
      if (createMode === 'prompt' && content.trim()) {
        const project = projects.find(p => p.id === newSpec.projectId);
        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationHistory: [],
            context: {
              projectId: newSpec.projectId,
              projectName: project?.name,
              projectDescription: project?.description,
              specType: newSpec.type,
            },
            sessionId: `create_${Date.now()}`,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate specification with AI');
        }

        const data = await response.json();
        content = data.response;
      }

      if (!content.trim()) {
        setError('Content cannot be empty');
        return;
      }

      // Upload markdown file to S3
      const fileName = `${newSpec.type.toLowerCase()}_${Date.now()}.md`;
      const filePath = generateFilePath('specs', fileName);
      
      try {
        await uploadMarkdownFile(filePath, content);
      } catch (uploadError) {
        console.warn('S3 upload failed, continuing with local content:', uploadError);
      }

      // Create specification record
      try {
        const spec = await specificationAPI.create({
          type: newSpec.type,
          content,
          fileKey: filePath,
          projectId: newSpec.projectId,
        });
        setSpecifications([...specifications, spec as Specification]);
      } catch (createError) {
        console.warn('Database save failed:', createError);
        // Add to local state anyway for demo
        setSpecifications([...specifications, {
          id: `mock-${Date.now()}`,
          type: newSpec.type,
          content,
          fileKey: filePath,
          projectId: newSpec.projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]);
      }

      setNewSpec({ type: 'ANALYSIS', content: '', projectId: '' });
      setOpenCreateDialog(false);
      setError(null);
    } catch (err) {
      console.error('Error creating specification:', err);
      setError(err instanceof Error ? err.message : 'Failed to create specification');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewSpec({ ...newSpec, content: e.target?.result as string });
      };
      reader.readAsText(file);
    }
  };

  const handleEditSpec = async (spec: Specification) => {
    setSelectedSpec(spec);
    
    // Try to load content from S3 if fileKey exists
    let content = spec.content || '';
    if (spec.fileKey) {
      try {
        content = await downloadMarkdownFile(spec.fileKey);
      } catch (err) {
        console.warn('Failed to load from S3, using stored content:', err);
      }
    }
    
    setEditContent(content);
    setOpenEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSpec) return;

    try {
      // Upload updated content to S3
      if (selectedSpec.fileKey) {
        try {
          await uploadMarkdownFile(selectedSpec.fileKey, editContent);
        } catch (uploadError) {
          console.warn('S3 upload failed:', uploadError);
        }
      }

      // Update specification record
      try {
        const updated = await specificationAPI.update(selectedSpec.id, {
          content: editContent,
        });
        
        setSpecifications(specifications.map(s => 
          s.id === selectedSpec.id ? updated as Specification : s
        ));
      } catch (updateError) {
        console.warn('Database update failed:', updateError);
        // Update local state anyway
        setSpecifications(specifications.map(s => 
          s.id === selectedSpec.id ? { ...s, content: editContent } : s
        ));
      }

      setOpenEditDialog(false);
      setSelectedSpec(null);
      setEditContent('');
    } catch (err) {
      console.error('Error saving specification:', err);
      setError(err instanceof Error ? err.message : 'Failed to save specification');
    }
  };

  const handleAIEdit = async (message: string) => {
    if (!selectedSpec) return;

    try {
      const project = projects.find(p => p.id === selectedSpec.projectId);
      const response = await fetch('/api/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory: [],
          context: {
            projectId: selectedSpec.projectId,
            projectName: project?.name,
            projectDescription: project?.description,
            specType: selectedSpec.type || 'ANALYSIS',
            existingContent: editContent,
          },
          sessionId: `edit_${selectedSpec.id}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      setEditContent(data.response);
    } catch (err) {
      console.error('Error with AI edit:', err);
      setError(err instanceof Error ? err.message : 'Failed to get AI response');
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
            Create and manage specifications with AI assistance
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={() => setOpenCreateDialog(true)}
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
        <Alert severity="warning" onClose={() => setError(null)} sx={{ mb: 2 }}>
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
              Create specifications with AI assistance or upload markdown files
            </Typography>
            <Button
              variant="contained"
              onClick={() => setOpenCreateDialog(true)}
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
                      {spec.type} Specification
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSpec(spec)}
                        sx={{ color: 'rgb(244 63 94)' }}
                      >
                        <Edit size={18} />
                      </IconButton>
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

      {/* Create Dialog */}
      <Dialog 
        open={openCreateDialog} 
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
          }
        }}
      >
        <DialogTitle sx={{ color: 'rgb(250 250 250)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sparkles size={20} />
            Create New Specification
          </Box>
          <IconButton size="small" onClick={() => setOpenCreateDialog(false)}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Mode selector */}
            <ToggleButtonGroup
              value={createMode}
              exclusive
              onChange={(_, newMode) => newMode && setCreateMode(newMode)}
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgb(161 161 170)',
                  borderColor: 'rgb(63 63 70)',
                  '&.Mui-selected': {
                    backgroundColor: 'rgb(244 63 94)',
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: 'rgb(225 29 72)',
                    },
                  },
                },
              }}
            >
              <ToggleButton value="prompt">
                <Sparkles size={16} style={{ marginRight: 8 }} />
                AI Prompt
              </ToggleButton>
              <ToggleButton value="paste">
                <FileText size={16} style={{ marginRight: 8 }} />
                Paste Text
              </ToggleButton>
              <ToggleButton value="upload">
                <Upload size={16} style={{ marginRight: 8 }} />
                Upload File
              </ToggleButton>
            </ToggleButtonGroup>

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

            {createMode === 'upload' ? (
              <Button
                variant="outlined"
                component="label"
                startIcon={<Upload size={20} />}
                sx={{
                  color: 'rgb(250 250 250)',
                  borderColor: 'rgb(63 63 70)',
                  '&:hover': { borderColor: 'rgb(244 63 94)' },
                }}
              >
                Upload Markdown File
                <input
                  type="file"
                  hidden
                  accept=".md"
                  onChange={handleFileUpload}
                />
              </Button>
            ) : null}

            <TextField
              label={createMode === 'prompt' ? 'AI Prompt' : 'Content (Markdown)'}
              fullWidth
              multiline
              rows={createMode === 'prompt' ? 4 : 8}
              value={newSpec.content}
              onChange={(e) => setNewSpec({ ...newSpec, content: e.target.value })}
              placeholder={
                createMode === 'prompt'
                  ? 'Describe what you want to create, e.g., "Create a requirements analysis for an e-commerce platform"'
                  : '# Specification Title\n\n## Description\nWrite your specification content in markdown format...'
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'rgb(250 250 250)',
                  fontFamily: createMode === 'paste' ? 'monospace' : 'inherit',
                  '& fieldset': { borderColor: 'rgb(63 63 70)' },
                  '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                },
                '& .MuiInputLabel-root': { color: 'rgb(161 161 170)' },
              }}
            />

            {createMode === 'prompt' && (
              <Alert severity="info">
                The AI will generate a complete specification based on your prompt.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setOpenCreateDialog(false)}
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
            {createMode === 'prompt' ? 'Generate' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
            height: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ color: 'rgb(250 250 250)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Edit size={20} />
            Edit Specification
          </Box>
          <IconButton size="small" onClick={() => setOpenEditDialog(false)}>
            <X size={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Grid container sx={{ height: '100%' }}>
            {/* Editor */}
            <Grid size={{ xs: 12, md: 8 }} sx={{ borderRight: '1px solid rgb(63 63 70)', height: '100%' }}>
              <Box sx={{ height: '100%', p: 2 }}>
                <MarkdownEditor
                  value={editContent}
                  onChange={setEditContent}
                  label="Specification Content"
                  placeholder="Edit your specification content..."
                />
              </Box>
            </Grid>
            
            {/* AI Chat */}
            <Grid size={{ xs: 12, md: 4 }} sx={{ height: '100%' }}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid rgb(63 63 70)' }}>
                  <Typography variant="subtitle2" sx={{ color: 'rgb(161 161 170)', mb: 1 }}>
                    AI Assistant
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgb(161 161 170)' }}>
                    Ask the AI to help modify your specification
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="e.g., 'Add a security section' or 'Make it more detailed'"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const target = e.target as HTMLTextAreaElement;
                        if (target.value.trim()) {
                          handleAIEdit(target.value);
                          target.value = '';
                        }
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: 'rgb(250 250 250)',
                        '& fieldset': { borderColor: 'rgb(63 63 70)' },
                        '&:hover fieldset': { borderColor: 'rgb(244 63 94)' },
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgb(161 161 170)', display: 'block', mt: 1 }}>
                    Press Enter to send, Shift+Enter for new line
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgb(63 63 70)' }}>
          <Button 
            onClick={() => setOpenEditDialog(false)}
            sx={{ 
              color: 'rgb(161 161 170)',
              textTransform: 'none',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            sx={{
              backgroundColor: 'rgb(244 63 94)',
              '&:hover': { backgroundColor: 'rgb(225 29 72)' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
