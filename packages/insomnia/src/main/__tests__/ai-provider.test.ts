import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  generateCommitsFromDiff,
  generateMcpSamplingResponse,
  generateMockRouteDataFromText,
  generateText,
  parseJsonArray,
} from '../ai-provider.mjs';

const mockFetch = (body: unknown) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const requestOf = (fetchMock: ReturnType<typeof mockFetch>) => {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
};

const messages = [{ role: 'user', content: 'Hello' }];

describe('ai-provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls Anthropic with the system prompt and key', async () => {
    const fetchMock = mockFetch({ content: [{ type: 'text', text: 'Hi' }] });

    const text = await generateText('Be brief', messages, { backend: 'claude', model: 'm', apiKey: 'k' });

    const { url, headers, body } = requestOf(fetchMock);
    expect(text).toBe('Hi');
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('k');
    expect(body).toMatchObject({ model: 'm', system: 'Be brief', messages });
  });

  it('calls OpenAI with a system message', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: 'Hi' } }] });

    await generateText('Be brief', messages, { backend: 'openai', model: 'm', apiKey: 'k', maxTokens: 10 });

    const { url, headers, body } = requestOf(fetchMock);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headers.Authorization).toBe('Bearer k');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Be brief' });
    expect(body.max_completion_tokens).toBe(10);
  });

  it('calls a local OpenAI compatible server without a key', async () => {
    const fetchMock = mockFetch({ choices: [{ message: { content: 'Hi' } }] });

    await generateText(undefined, messages, { backend: 'url', model: 'm', url: 'http://localhost:11434/v1' });

    const { url, headers } = requestOf(fetchMock);
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(headers.Authorization).toBeUndefined();
  });

  it('calls Gemini with mapped roles', async () => {
    const fetchMock = mockFetch({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] });

    await generateText(undefined, [{ role: 'assistant', content: 'Hey' }], {
      backend: 'gemini',
      model: 'm',
      apiKey: 'k',
    });

    const { url, body } = requestOf(fetchMock);
    expect(url).toContain('/models/m:generateContent');
    expect(body.contents[0].role).toBe('model');
  });

  it('reports provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad key', { status: 401 })),
    );

    await expect(generateText(undefined, messages, { backend: 'claude', model: 'm' })).rejects.toThrow(
      'api.anthropic.com returned 401: bad key',
    );
  });

  it('rejects unsupported backends', () => {
    expect(() => generateText(undefined, messages, { backend: 'gguf', model: 'm' })).toThrow('Unsupported AI backend');
  });

  it('parses JSON wrapped in prose and fences', () => {
    expect(parseJsonArray('Sure:\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(() => parseJsonArray('no json')).toThrow('did not return a JSON array');
  });

  it('generates commits', async () => {
    mockFetch({ content: [{ type: 'text', text: '[{"message":"Fix","files":["a.ts"]}]' }] });

    await expect(
      generateCommitsFromDiff({ diff: 'diff', recent_commits: '' }, { backend: 'claude', model: 'm' }),
    ).resolves.toEqual([{ message: 'Fix', files: ['a.ts'] }]);
  });

  it('generates mock routes with default headers', async () => {
    mockFetch({ content: [{ type: 'text', text: '[{"path":"/a","method":"GET","statusCode":200}]' }] });

    await expect(generateMockRouteDataFromText('spec', { backend: 'claude', model: 'm' })).resolves.toEqual([
      { path: '/a', method: 'GET', statusCode: 200, headers: [] },
    ]);
  });

  it('returns sampling text', async () => {
    mockFetch({ content: [{ type: 'text', text: 'Hi' }] });

    await expect(
      generateMcpSamplingResponse(messages, undefined, { backend: 'claude', model: 'm' }),
    ).resolves.toBe('Hi');
  });
});
