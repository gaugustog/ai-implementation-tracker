'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  ConversationMessage,
  ConversationRequest,
  ConversationResponse,
  SpecificationContext,
} from '@/lib/types';

interface UseSpecificationConversationOptions {
  context: SpecificationContext;
  sessionId?: string;
  initialMessages?: ConversationMessage[];
  onMessage?: (message: ConversationMessage) => void;
}

interface UseSpecificationConversationResult {
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  currentDraft: string;
  sessionId: string;
}

/**
 * Hook for managing AI-powered specification conversations
 */
export function useSpecificationConversation({
  context,
  sessionId: providedSessionId,
  initialMessages = [],
  onMessage,
}: UseSpecificationConversationOptions): UseSpecificationConversationResult {
  const [sessionId] = useState(providedSessionId || generateSessionId());
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState(context.existingContent || '');

  // Update draft when messages change
  useEffect(() => {
    // Extract content from assistant messages to build the draft
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (assistantMessages.length > 0) {
      // The draft is accumulated from the conversation
      const draftContent = assistantMessages
        .map((m) => m.content)
        .join('\n\n');
      setCurrentDraft(draftContent);
    }
  }, [messages]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) {
        return;
      }

      setIsLoading(true);
      setError(null);

      // Add user message
      const userMessage: ConversationMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      if (onMessage) {
        onMessage(userMessage);
      }

      try {
        // Call the conversation API
        const request: ConversationRequest = {
          message,
          conversationHistory: [...messages, userMessage],
          context,
          sessionId,
        };

        const response = await fetch('/api/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data: ConversationResponse = await response.json();

        // Add assistant message
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        if (onMessage) {
          onMessage(assistantMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Error sending message:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, context, sessionId, onMessage]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentDraft(context.existingContent || '');
    setError(null);
  }, [context.existingContent]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    currentDraft,
    sessionId,
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
