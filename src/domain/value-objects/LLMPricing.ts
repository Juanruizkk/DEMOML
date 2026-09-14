// Cost per million tokens in USD
const PRICING: Record<string, { input: number; output: number }> = {
  "groq/llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "groq/llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "groq/openai/gpt-oss-120b": { input: 0.9, output: 0.9 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "anthropic/claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
  "anthropic/claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
};

export function resolveModelKey(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function calculateCost(
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): number {
  const key = resolveModelKey(provider, model);
  const rate = PRICING[key];
  if (!rate) return 0;
  return (tokensIn / 1_000_000) * rate.input + (tokensOut / 1_000_000) * rate.output;
}

export { PRICING };
