import { completeWithFailover } from '@/lib/ai/provider';

export interface CompletionArgs {
  model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6' | 'claude-opus-4-7';
  system: string;
  user: string;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface CompletionResult {
  text: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
}

export async function anthropicComplete(args: CompletionArgs): Promise<CompletionResult> {
  const resolvedModel =
    args.model === 'claude-sonnet-4-6' ? 'claude-sonnet-4-20250514' :
    args.model === 'claude-opus-4-7' ? 'claude-opus-4-1-20250805' :
    'claude-haiku-4-5-20251001';

  const result = await completeWithFailover({
    system: args.system,
    messages: [{ role: 'user', content: args.user }],
    maxTokens: args.maxTokens ?? 1024,
    temperature: 0.2,
    preferredModel: resolvedModel,
  });

  const text = result.content?.trim() ?? '';
  if (args.responseFormat === 'json') {
    const stripped = text.replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
    return {
      text: stripped,
      input_tokens: result.tokens.input,
      output_tokens: result.tokens.output,
      total_tokens: result.tokens.total,
      latency_ms: result.latencyMs,
    };
  }

  return {
    text,
    input_tokens: result.tokens.input,
    output_tokens: result.tokens.output,
    total_tokens: result.tokens.total,
    latency_ms: result.latencyMs,
  };
}
