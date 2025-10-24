// shared types for private plugins

export interface ModelConfig {
  // ModelBackendConfig
  model: string;
  backend: 'gguf' | 'claude' | 'openai' | 'gemini';
  maxTokens?: number;

  apiKey?: string; // gemini, openai, claude

  // openai
  baseURL?: string;
  organization?: string;

  // openai, gemini, gguf
  topP?: number;
  temperature?: number;

  // gguf, gemini
  topK?: number;

  // gguf
  seed?: number;
  repeatPenalty?: number;
}

export interface MockRouteData {
  path: string;
  method: string;
  statusCode: number;
  headers: { name: string; value: string }[];
  mimeType?: string;
  body?: string;
}

export type GenerateCommitsFromDiffFunction = (
  input: {
    diff: string;
    recent_commits: string;
  },
  modelConfig: ModelConfig,
) => Promise<
  {
    message: string;
    files: string[];
  }[]
>;
