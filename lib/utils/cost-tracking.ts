/**
 * Cost tracking and optimization utilities for Bedrock ticket generation
 */

// Pricing for Claude models (as of 2024, in USD per 1M tokens)
const MODEL_PRICING = {
  'anthropic.claude-opus-4-20250514-v1:0': {
    input: 15.0,
    output: 75.0,
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    input: 3.0,
    output: 15.0,
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    input: 0.8,
    output: 4.0,
  },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  timestamp: Date;
  operation: string;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Calculate cost for a Bedrock API call
 */
export function calculateCost(usage: TokenUsage): CostEstimate {
  const pricing = MODEL_PRICING[usage.modelId as keyof typeof MODEL_PRICING];
  
  if (!pricing) {
    console.warn(`Unknown model: ${usage.modelId}, using default pricing`);
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      currency: 'USD',
    };
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    inputCost,
    outputCost,
    totalCost,
    currency: 'USD',
  };
}

/**
 * Estimate tokens for text (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for ticket generation based on specification size
 */
export function estimateTicketGenerationCost(specificationContent: string): {
  estimated: CostEstimate;
  breakdown: Array<{ step: string; model: string; cost: CostEstimate }>;
} {
  const specTokens = estimateTokens(specificationContent);
  
  // Estimate for each pipeline step
  const steps = [
    {
      step: 'Parse Specification',
      model: 'anthropic.claude-opus-4-20250514-v1:0',
      inputTokens: specTokens + 500, // spec + prompt
      outputTokens: 2000,
    },
    {
      step: 'Identify Components',
      model: 'anthropic.claude-opus-4-20250514-v1:0',
      inputTokens: 2500, // previous result + prompt
      outputTokens: 2000,
    },
    {
      step: 'Generate Tickets',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      inputTokens: 3000,
      outputTokens: 6000, // Larger output for multiple tickets
    },
    {
      step: 'Group into Epics',
      model: 'anthropic.claude-opus-4-20250514-v1:0',
      inputTokens: 7000, // all tickets
      outputTokens: 1500,
    },
    {
      step: 'Analyze Dependencies',
      model: 'anthropic.claude-opus-4-20250514-v1:0',
      inputTokens: 7000,
      outputTokens: 2000,
    },
    {
      step: 'Optimize Parallelization',
      model: 'anthropic.claude-opus-4-20250514-v1:0',
      inputTokens: 7000,
      outputTokens: 3000,
    },
    {
      step: 'Generate Summary',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      inputTokens: 8000,
      outputTokens: 4000,
    },
    {
      step: 'Generate Execution Plan',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      inputTokens: 8000,
      outputTokens: 4000,
    },
  ];

  const breakdown = steps.map(step => {
    const cost = calculateCost({
      inputTokens: step.inputTokens,
      outputTokens: step.outputTokens,
      modelId: step.model,
      timestamp: new Date(),
      operation: step.step,
    });

    return {
      step: step.step,
      model: step.model,
      cost,
    };
  });

  const totalCost = breakdown.reduce(
    (acc, item) => ({
      inputCost: acc.inputCost + item.cost.inputCost,
      outputCost: acc.outputCost + item.cost.outputCost,
      totalCost: acc.totalCost + item.cost.totalCost,
      currency: 'USD',
    }),
    { inputCost: 0, outputCost: 0, totalCost: 0, currency: 'USD' }
  );

  return {
    estimated: totalCost,
    breakdown,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Get model recommendation based on complexity
 */
export function getModelRecommendation(
  complexity: 'simple' | 'medium' | 'complex'
): string {
  switch (complexity) {
    case 'simple':
      return 'anthropic.claude-3-5-haiku-20241022-v1:0';
    case 'medium':
      return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    case 'complex':
      return 'anthropic.claude-opus-4-20250514-v1:0';
    default:
      return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  }
}

/**
 * Token optimization strategies
 */
export const tokenOptimization = {
  /**
   * Truncate text to fit within token limit
   */
  truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // Approximate character limit based on tokens
    const maxChars = maxTokens * 4;
    return text.substring(0, maxChars) + '...\n[Content truncated due to length]';
  },

  /**
   * Summarize conversation history to reduce tokens
   */
  summarizeHistory(history: Array<{ role: string; content: string }>): string {
    if (history.length === 0) {
      return '';
    }

    // Keep first and last 2 messages, summarize the middle
    if (history.length <= 4) {
      return JSON.stringify(history);
    }

    const first = history.slice(0, 2);
    const last = history.slice(-2);
    const middleCount = history.length - 4;

    return JSON.stringify([
      ...first,
      {
        role: 'assistant',
        content: `[${middleCount} mensagens intermediárias resumidas]`,
      },
      ...last,
    ]);
  },

  /**
   * Prune less important context to fit token budget
   */
  pruneContext(
    context: {
      techStack?: any;
      patterns?: any;
      integrationPoints?: any;
      relevantFiles?: string[];
    },
    maxTokens: number
  ): any {
    let result = { ...context };
    let currentTokens = estimateTokens(JSON.stringify(result));

    // Progressively remove less critical information
    if (currentTokens > maxTokens && result.relevantFiles) {
      result.relevantFiles = result.relevantFiles.slice(0, 5);
      currentTokens = estimateTokens(JSON.stringify(result));
    }

    if (currentTokens > maxTokens && result.integrationPoints) {
      result.integrationPoints = (result.integrationPoints as any[]).slice(0, 3);
      currentTokens = estimateTokens(JSON.stringify(result));
    }

    if (currentTokens > maxTokens) {
      delete result.patterns;
      currentTokens = estimateTokens(JSON.stringify(result));
    }

    return result;
  },
};

/**
 * CloudWatch metrics helper (for Lambda function)
 */
export interface MetricData {
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
  dimensions?: Record<string, string>;
}

export function createCostMetric(cost: CostEstimate, operation: string): MetricData {
  return {
    metricName: 'BedrockCost',
    value: cost.totalCost,
    unit: 'None', // USD
    timestamp: new Date(),
    dimensions: {
      Operation: operation,
    },
  };
}

export function createTokenMetric(
  usage: TokenUsage,
  type: 'input' | 'output'
): MetricData {
  return {
    metricName: `BedrockTokens_${type}`,
    value: type === 'input' ? usage.inputTokens : usage.outputTokens,
    unit: 'Count',
    timestamp: new Date(),
    dimensions: {
      ModelId: usage.modelId,
      Operation: usage.operation,
    },
  };
}
