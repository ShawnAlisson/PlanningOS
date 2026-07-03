// Generic OpenAI-compatible chat client. Works unmodified with:
//  - OpenAI            (LLM_BASE_URL unset -> https://api.openai.com/v1)
//  - OpenRouter         (LLM_BASE_URL=https://openrouter.ai/api/v1)
//  - Local runtimes     (LLM_BASE_URL=http://localhost:11434/v1 for Ollama, LM Studio, etc.)
//
// Configure with:
//   LLM_API_KEY   (falls back to OPENAI_API_KEY / OPENROUTER_API_KEY)
//   LLM_BASE_URL  (default https://api.openai.com/v1)
//   LLM_MODEL     (default gpt-4o-mini)

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getLlmConfig(): LlmConfig | null {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.AZURE_OPENAI_API_KEY ||
    '';

  // Local runtimes (Ollama/LM Studio) usually don't need a real key, but the
  // OpenAI SDK/HTTP contract requires the Authorization header to be present.
  const baseUrl = process.env.LLM_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(baseUrl);

  if (!apiKey && !isLocal) return null;

  const model = process.env.LLM_MODEL || (baseUrl.includes('openrouter') ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

  return { apiKey: apiKey || 'local', baseUrl, model };
}

export function isLlmConfigured(): boolean {
  return getLlmConfig() !== null;
}

async function postChatCompletion(
  config: LlmConfig,
  body: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.baseUrl.includes('openrouter')
        ? {
            'HTTP-Referer': 'https://planningos.local',
            'X-Title': 'PlanningOS',
          }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM response contained no content');
  return content;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: { jsonMode?: boolean; temperature?: number; model?: string } = {}
): Promise<string> {
  const config = getLlmConfig();
  if (!config) {
    throw new Error('No LLM configured. Set LLM_API_KEY (or OPENAI_API_KEY / OPENROUTER_API_KEY) and optionally LLM_BASE_URL / LLM_MODEL.');
  }

  const baseBody = {
    model: options.model || config.model,
    temperature: options.temperature ?? 0,
    messages,
  };

  if (!options.jsonMode) {
    return postChatCompletion(config, baseBody);
  }

  try {
    return await postChatCompletion(config, { ...baseBody, response_format: { type: 'json_object' } });
  } catch (error) {
    // Some OpenAI-compatible local servers (e.g. LM Studio) reject the older
    // 'json_object' response_format shorthand with "must be 'json_schema' or
    // 'text'". Retry in plain-text mode - the system prompt already asks for
    // strict JSON, most models still comply, and callers already tolerate a
    // JSON.parse failure by falling back to heuristics.
    const message = error instanceof Error ? error.message : '';
    if (!/response_format/i.test(message)) throw error;
    return postChatCompletion(config, baseBody);
  }
}
