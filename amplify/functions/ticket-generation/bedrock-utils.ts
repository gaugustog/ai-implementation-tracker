import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandOutput,
  ThrottlingException,
} from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface BedrockRequestOptions {
  modelId: string;
  messages: any[];
  system?: any[];
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Call Bedrock with exponential backoff retry logic
 */
export async function callBedrockWithRetry(
  options: BedrockRequestOptions
): Promise<{ response: string; tokensUsed: number }> {
  const {
    modelId,
    messages,
    system,
    temperature = 0.5,
    maxTokens = 4096,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const command = new ConverseCommand({
        modelId,
        messages,
        system,
        inferenceConfig: {
          maxTokens,
          temperature,
        },
      });

      const response: ConverseCommandOutput = await bedrockClient.send(command);
      const text = response.output?.message?.content?.[0]?.text || '';
      const tokensUsed =
        (response.usage?.inputTokens || 0) + (response.usage?.outputTokens || 0);

      return {
        response: text,
        tokensUsed,
      };
    } catch (error) {
      lastError = error as Error;

      // Check if it's a throttling error
      if (error instanceof ThrottlingException || (error as any).name === 'ThrottlingException') {
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
          console.log(
            `Throttling detected. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await sleep(delay);
          continue;
        }
      }

      // For other errors, throw immediately
      if (attempt === maxRetries) {
        throw error;
      }

      // For non-throttling errors, retry with shorter delay
      const delay = retryDelay;
      console.log(`Error occurred. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Extract JSON from response text, handling markdown code blocks
 */
export function extractJSON(text: string): any {
  // Try to find JSON in markdown code blocks
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // If parsing fails, try the whole text
    }
  }

  // Try to parse the whole text as JSON
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Failed to parse JSON from response:', text);
    throw new Error('Invalid JSON in response');
  }
}

/**
 * Chunk large text into smaller pieces
 */
export function chunkText(text: string, maxChunkSize: number = 50000): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = '';

  // Split by paragraphs to avoid breaking in the middle of sentences
  const paragraphs = text.split('\n\n');

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      // If a single paragraph is too large, split by sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk.length > 0) {
              chunks.push(currentChunk);
              currentChunk = '';
            }
            // If even a sentence is too large, just add it
            chunks.push(sentence);
          } else {
            currentChunk += sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English, 2-3 for Portuguese
  return Math.ceil(text.length / 3);
}

/**
 * Validate that a specification is not too large
 */
export function validateSpecificationSize(content: string): void {
  const estimatedTokens = estimateTokens(content);
  const maxTokens = 150000; // Claude's context window is 200k, leave some room

  if (estimatedTokens > maxTokens) {
    throw new Error(
      `Specification is too large (${estimatedTokens} tokens estimated). Maximum is ${maxTokens} tokens.`
    );
  }
}
