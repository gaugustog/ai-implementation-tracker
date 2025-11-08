'use client';

import { useState } from 'react';
import { Box, TextField, Typography, Paper, Tabs, Tab } from '@mui/material';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

/**
 * Markdown editor with preview tab
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Enter markdown content...',
  label = 'Content',
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Edit" value="edit" />
          <Tab label="Preview" value="preview" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 'edit' ? (
          <TextField
            fullWidth
            multiline
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            variant="outlined"
            sx={{
              '& .MuiInputBase-root': {
                height: '100%',
                alignItems: 'flex-start',
              },
              '& textarea': {
                height: '100% !important',
                overflow: 'auto !important',
              },
            }}
          />
        ) : (
          <Paper
            sx={{
              p: 2,
              minHeight: '100%',
              bgcolor: 'background.paper',
            }}
          >
            {value ? (
              <MarkdownPreview content={value} />
            ) : (
              <Typography color="text.secondary">
                No content to preview. Switch to Edit tab to add content.
              </Typography>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
}

/**
 * Simple markdown preview (without external dependencies)
 */
function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown-to-HTML conversion
  // In production, consider using a library like react-markdown
  const formatMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <Typography key={index} variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              {line.substring(4)}
            </Typography>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Typography key={index} variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              {line.substring(3)}
            </Typography>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Typography key={index} variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
              {line.substring(2)}
            </Typography>
          );
        }

        // Bold
        const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        const italicLine = boldLine.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Code
        const codeLine = italicLine.replace(/`(.+?)`/g, '<code>$1</code>');

        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <Typography
              key={index}
              component="li"
              sx={{ ml: 2 }}
              dangerouslySetInnerHTML={{ __html: codeLine.substring(2) }}
            />
          );
        }

        // Empty line
        if (!line.trim()) {
          return <Box key={index} sx={{ height: 8 }} />;
        }

        // Regular paragraph
        return (
          <Typography
            key={index}
            variant="body1"
            sx={{ mb: 1 }}
            dangerouslySetInnerHTML={{ __html: codeLine }}
          />
        );
      });
  };

  return <Box>{formatMarkdown(content)}</Box>;
}
