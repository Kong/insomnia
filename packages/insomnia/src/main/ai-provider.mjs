/* eslint-disable no-undef */
// Bring-your-own-key AI. Runs in the generation utility processes and only talks to the configured provider.
import { readFile } from 'node:fs/promises';

const DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_VERSION = '2023-06-01';

const postJson = async (url, headers, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
};

const sendClaude = async (system, messages, config) => {
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': config.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    {
      model: config.model,
      max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages,
      ...(system ? { system } : {}),
      ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
    },
  );
  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
};

const sendOpenAICompatible = async (url, tokenField, system, messages, config) => {
  const data = await postJson(url, config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}, {
    model: config.model,
    messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
    ...(config.maxTokens === undefined ? {} : { [tokenField]: config.maxTokens }),
    ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
    ...(config.topP === undefined ? {} : { top_p: config.topP }),
  });
  return data.choices[0].message.content;
};

const sendGemini = async (system, messages, config) => {
  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
    { 'x-goog-api-key': config.apiKey },
    {
      contents: messages.map(({ role, content }) => ({
        role: role === 'assistant' ? 'model' : 'user',
        parts: [{ text: content }],
      })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        maxOutputTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
        ...(config.topP === undefined ? {} : { topP: config.topP }),
        ...(config.topK === undefined ? {} : { topK: config.topK }),
      },
    },
  );
  return data.candidates[0].content.parts.map(part => part.text).join('');
};

export const generateText = (system, messages, config) => {
  switch (config.backend) {
    case 'claude': {
      return sendClaude(system, messages, config);
    }
    case 'openai': {
      const baseUrl = config.baseURL || 'https://api.openai.com/v1';
      return sendOpenAICompatible(`${baseUrl}/chat/completions`, 'max_completion_tokens', system, messages, config);
    }
    case 'gemini': {
      return sendGemini(system, messages, config);
    }
    case 'url': {
      const baseUrl = config.url.endsWith('/') ? config.url : `${config.url}/`;
      return sendOpenAICompatible(new URL('chat/completions', baseUrl).href, 'max_tokens', system, messages, config);
    }
    default: {
      throw new Error(`Unsupported AI backend "${config.backend}". Choose a provider in Preferences > AI.`);
    }
  }
};

// Models often wrap JSON in prose or code fences
export const parseJsonArray = text => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('The model did not return a JSON array');
  }
  return JSON.parse(text.slice(start, end + 1));
};

const generateJsonArray = async (system, prompt, config) =>
  parseJsonArray(await generateText(system, [{ role: 'user', content: prompt }], config));

const COMMITS_PROMPT = `You group git changes into logical commits.
Reply with only a JSON array of objects with "message" (a concise commit message) and "files" (paths taken exactly from the diff).
Every changed file must appear in exactly one commit. Match the style of the recent commits.`;

export const generateCommitsFromDiff = ({ diff, recent_commits }, config) =>
  generateJsonArray(
    COMMITS_PROMPT,
    `Recent commits:\n${recent_commits}\n\nDiff:\n${typeof diff === 'string' ? diff : JSON.stringify(diff)}`,
    config,
  );

const MOCK_ROUTES_PROMPT = `You generate mock server routes from an API description.
Reply with only a JSON array of objects with "path", "method" (uppercase), "statusCode" (number), "headers" (array of {"name", "value"}), "mimeType" and "body" (a string).
Create one route per operation with a realistic success response.`;

const DYNAMIC_RESPONSES_PROMPT = `
Where values should vary between calls, use Liquid faker tags in the body, for example {{ faker.randomFullName }}.`;

const generateMockRoutes = async (source, config, { additionalFiles = [], useDynamicMockResponses = false } = {}) => {
  const files = await Promise.all(additionalFiles.map(file => readFile(file, 'utf8')));
  const prompt = [source, ...files.map((file, index) => `Additional file ${index + 1}:\n${file}`)].join('\n\n');
  const routes = await generateJsonArray(
    MOCK_ROUTES_PROMPT + (useDynamicMockResponses ? DYNAMIC_RESPONSES_PROMPT : ''),
    prompt,
    config,
  );
  return routes.map(route => ({ ...route, headers: route.headers ?? [] }));
};

export const generateMockRouteDataFromOpenAPISpec = (spec, config, options) =>
  generateMockRoutes(typeof spec === 'string' ? spec : JSON.stringify(spec), config, options);

export const generateMockRouteDataFromText = generateMockRoutes;

export const generateMockRouteDataFromUrl = async (url, config, options) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  }
  return generateMockRoutes(await response.text(), config, options);
};

export const generateMcpSamplingResponse = (messages, systemPrompt, config) =>
  generateText(systemPrompt, messages, config);
