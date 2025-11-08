'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Typography,
  Alert,
} from '@mui/material';
import { Save, FileDown } from 'lucide-react';
import { SpecificationChat } from './SpecificationChat';
import { MarkdownEditor } from './MarkdownEditor';
import type { SpecificationContext, SpecType, Project } from '@/lib/types';

interface SpecificationBuilderProps {
  project: Project;
  onSave?: (content: string, type: SpecType) => Promise<void>;
  initialContent?: string;
  initialType?: SpecType;
}

/**
 * Main component for building specifications with AI assistance
 */
export function SpecificationBuilder({
  project,
  onSave,
  initialContent = '',
  initialType = 'ANALYSIS',
}: SpecificationBuilderProps) {
  const [specType, setSpecType] = useState<SpecType>(initialType);
  const [draftContent, setDraftContent] = useState(initialContent);
  const [manualContent, setManualContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Build context for AI
  const context: SpecificationContext = {
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description || undefined,
    specType,
    existingContent: draftContent,
  };

  // Update manual content when draft changes from AI
  useEffect(() => {
    if (draftContent && draftContent !== manualContent) {
      setManualContent(draftContent);
    }
  }, [draftContent]);

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await onSave(manualContent, specType);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([manualContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}-${specType}-spec.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h5">Build Specification</Typography>
            <Typography variant="body2" color="text.secondary">
              Project: {project.name}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={specType}
                  label="Type"
                  onChange={(e) => setSpecType(e.target.value as SpecType)}
                >
                  <MenuItem value="ANALYSIS">Analysis</MenuItem>
                  <MenuItem value="FIXES">Fixes</MenuItem>
                  <MenuItem value="PLANS">Plans</MenuItem>
                  <MenuItem value="REVIEWS">Reviews</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                startIcon={<FileDown size={20} />}
                onClick={handleDownload}
                disabled={!manualContent}
              >
                Download
              </Button>
              <Button
                variant="contained"
                startIcon={<Save size={20} />}
                onClick={handleSave}
                disabled={!manualContent || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {saveSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Specification saved successfully!
          </Alert>
        )}
        {saveError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {saveError}
          </Alert>
        )}
      </Paper>

      {/* Main content - Chat and Editor */}
      <Grid container spacing={2} sx={{ flex: 1, overflow: 'hidden' }}>
        {/* AI Chat */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SpecificationChat
              context={context}
              onDraftUpdate={setDraftContent}
            />
          </Paper>
        </Grid>

        {/* Markdown Editor */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <MarkdownEditor
              value={manualContent}
              onChange={setManualContent}
              label="Specification Content"
              placeholder="The AI will help you build the specification content here, or you can type directly..."
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Prompt Templates */}
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Quick Start Prompts:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {getPromptTemplates(specType).map((template, index) => (
            <Button
              key={index}
              size="small"
              variant="outlined"
              onClick={() => {
                // This would trigger sending the template to the chat
                // For now, it's just visual
              }}
            >
              {template.label}
            </Button>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}

/**
 * Get prompt templates based on specification type
 */
function getPromptTemplates(type: SpecType) {
  const templates = {
    ANALYSIS: [
      { label: 'Start with requirements', prompt: 'Help me define the functional requirements' },
      { label: 'Technical constraints', prompt: 'What technical constraints should I consider?' },
      { label: 'User stories', prompt: 'Help me create user stories' },
    ],
    FIXES: [
      { label: 'Describe problem', prompt: 'Help me describe the problem in detail' },
      { label: 'Root cause analysis', prompt: 'Let\'s analyze the root cause' },
      { label: 'Testing strategy', prompt: 'What testing should we do?' },
    ],
    PLANS: [
      { label: 'Define phases', prompt: 'Help me break this into phases' },
      { label: 'Identify risks', prompt: 'What risks should we consider?' },
      { label: 'Resource planning', prompt: 'Help me plan resources and timeline' },
    ],
    REVIEWS: [
      { label: 'Code review', prompt: 'Help me review the code quality' },
      { label: 'Architecture review', prompt: 'Let\'s review the architecture' },
      { label: 'Security review', prompt: 'What security concerns should we check?' },
    ],
  };

  return templates[type];
}
