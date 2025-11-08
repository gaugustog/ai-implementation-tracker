'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Send, Trash2 } from 'lucide-react';
import { useSpecificationConversation } from '@/lib/hooks/useSpecificationConversation';
import type { SpecificationContext, ConversationMessage } from '@/lib/types';

interface SpecificationChatProps {
  context: SpecificationContext;
  onDraftUpdate?: (content: string) => void;
  initialMessages?: ConversationMessage[];
}

/**
 * Chat interface for building specifications with AI assistance
 */
export function SpecificationChat({
  context,
  onDraftUpdate,
  initialMessages = [],
}: SpecificationChatProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, sendMessage, clearMessages, currentDraft } =
    useSpecificationConversation({
      context,
      initialMessages,
      onMessage: (message) => {
        if (message.role === 'assistant' && onDraftUpdate) {
          onDraftUpdate(currentDraft);
        }
      },
    });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent of draft updates
  useEffect(() => {
    if (onDraftUpdate) {
      onDraftUpdate(currentDraft);
    }
  }, [currentDraft, onDraftUpdate]);

  const handleSend = async () => {
    if (inputMessage.trim() && !isLoading) {
      await sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">AI Specification Assistant</Typography>
        <IconButton
          size="small"
          onClick={clearMessages}
          disabled={messages.length === 0}
          title="Clear conversation"
        >
          <Trash2 size={20} />
        </IconButton>
      </Box>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Start a conversation to build your {context.specType} specification.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try: "Help me create a specification for {context.projectName || 'this project'}"
            </Typography>
          </Box>
        )}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              AI is thinking...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => {}}>
            {error}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question or provide details..."
          disabled={isLoading}
          size="small"
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!inputMessage.trim() || isLoading}
          sx={{ minWidth: 'auto', px: 2 }}
        >
          <Send size={20} />
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Individual message bubble
 */
function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Paper
        sx={{
          p: 2,
          maxWidth: '80%',
          bgcolor: isUser ? 'primary.main' : 'background.paper',
          color: isUser ? 'primary.contrastText' : 'text.primary',
        }}
      >
        <Typography
          variant="body2"
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {message.content}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            display: 'block',
            opacity: 0.7,
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      </Paper>
    </Box>
  );
}
