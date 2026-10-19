import { describe, expect, it } from 'vitest';

import {
  candidateJsonPayloadsFromSseText,
  computeStreamSummary,
  extractStreamValueAtPath,
  getCandidatePayloadsFromEvents,
  inferStreamSummaryPath,
} from './stream-summary';

describe('extractStreamValueAtPath', () => {
  it('extracts a string field', () => {
    const payload = JSON.stringify({ choices: [{ delta: { content: 'hello' } }] });
    expect(extractStreamValueAtPath(payload, '$.choices[0].delta.content')).toBe('hello');
  });

  it('stringifies a numeric field instead of dropping it', () => {
    const payload = JSON.stringify({ value: 42 });
    expect(extractStreamValueAtPath(payload, '$.value')).toBe('42');
  });

  it('stringifies an object field instead of dropping it', () => {
    const payload = JSON.stringify({ value: { foo: 'bar' } });
    expect(extractStreamValueAtPath(payload, '$.value')).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('joins array results', () => {
    const payload = JSON.stringify({ items: ['a', 'b', 'c'] });
    expect(extractStreamValueAtPath(payload, '$.items[*]')).toBe('abc');
  });

  it('returns null for invalid JSON payload', () => {
    expect(extractStreamValueAtPath('not json', '$.value')).toBeNull();
  });

  it('returns null for invalid JSONPath', () => {
    const payload = JSON.stringify({ value: 'hello' });
    expect(extractStreamValueAtPath(payload, '$[?(]')).toBeNull();
  });

  it('returns null when the path matches nothing', () => {
    const payload = JSON.stringify({ value: 'hello' });
    expect(extractStreamValueAtPath(payload, '$.missing')).toBeNull();
  });

  it('returns null (does not throw) for a truncated, still-streaming JSON payload', () => {
    const payload = '{"choices":[{"delta":{"content":"hi"';
    expect(() => extractStreamValueAtPath(payload, '$.choices[0].delta.content')).not.toThrow();
    expect(extractStreamValueAtPath(payload, '$.choices[0].delta.content')).toBeNull();
  });
});

describe('computeStreamSummary', () => {
  it('joins multiple payloads and reports fragmentCount', () => {
    const payloads = [
      JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'lo ' } }] }),
      JSON.stringify({ choices: [{ delta: {} }] }),
      JSON.stringify({ choices: [{ delta: { content: 'world' } }] }),
    ];
    const result = computeStreamSummary(payloads, '$.choices[0].delta.content');
    expect(result).toEqual({ fragmentCount: 3, summary: 'Hello world' });
  });

  it('renders Gemini text progressively as the array grows, mid-stream, before it closes', () => {
    const keyPath = '$.candidates[0].content.parts[0].text';
    // Each call simulates the accumulated wire text at a point in time as more of Gemini's
    // still-open array arrives; the array only closes on the last call.
    const atFirstElement = candidateJsonPayloadsFromSseText(
      '[{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}',
    );
    expect(computeStreamSummary(atFirstElement, keyPath)).toEqual({ fragmentCount: 1, summary: 'Hel' });

    const withSecondElementStillOpen = candidateJsonPayloadsFromSseText(
      '[{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n,\n{"candidates":[{"content":{"parts":[{"text":"lo',
    );
    expect(computeStreamSummary(withSecondElementStillOpen, keyPath)).toEqual({ fragmentCount: 1, summary: 'Hel' });

    const afterClose = candidateJsonPayloadsFromSseText(
      '[{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n,\n{"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n]',
    );
    expect(computeStreamSummary(afterClose, keyPath)).toEqual({ fragmentCount: 2, summary: 'Hello' });
  });
});

describe('inferStreamSummaryPath', () => {
  it('matches OpenAI chat completions', () => {
    expect(inferStreamSummaryPath('https://api.openai.com/v1/chat/completions')).toBe('$.choices[0].delta.content');
  });

  it('matches OpenAI responses API on a proxy host', () => {
    expect(inferStreamSummaryPath('https://my-proxy.example.com/v1/responses')).toBe('$.delta');
  });

  it('matches Anthropic messages API', () => {
    expect(inferStreamSummaryPath('https://api.anthropic.com/v1/messages')).toBe('$.delta.text');
  });

  it('matches Google Gemini streamGenerateContent', () => {
    expect(
      inferStreamSummaryPath('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent'),
    ).toBe('$.candidates[0].content.parts[0].text');
  });

  it('returns null when no pathname matches', () => {
    expect(inferStreamSummaryPath('https://example.com/v1/unknown')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(inferStreamSummaryPath('not a url')).toBeNull();
  });
});

describe('candidateJsonPayloadsFromSseText', () => {
  it('extracts a single data frame', () => {
    const text = 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual([
      '{"choices":[{"delta":{"content":"hi"}}]}',
    ]);
  });

  it('extracts multiple frames separated by blank lines', () => {
    const text = 'data: {"a":1}\n\ndata: {"b":2}\n\n';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  it('extracts a frame with event:/id: fields mixed in', () => {
    const text = 'event: message\nid: 42\ndata: {"a":1}\n\n';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual(['{"a":1}']);
  });

  it('joins a multi-line data: continuation frame', () => {
    const text = 'data: {"a":1,\ndata: "b":2}\n\n';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual(['{"a":1,\n"b":2}']);
  });

  it('falls back to a bare JSON blob with no data: prefix', () => {
    const text = '{"a":1}';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual(['{"a":1}']);
  });

  it('splits a bare top-level JSON array into one candidate per element (Gemini non-SSE streaming)', () => {
    // Gemini's default streamGenerateContent (no ?alt=sse) sends one top-level JSON array
    // with no blank lines between elements, not per-chunk `data:` frames.
    const text = '[{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n,\n{"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n]';
    expect(candidateJsonPayloadsFromSseText(text)).toEqual([
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] }),
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'lo' }] } }] }),
    ]);
  });

  it('returns only the elements that have closed so far from a still-open, unterminated array (does not throw)', () => {
    // Same Gemini shape as above, but mid-stream: the array's closing `]` (and the second
    // element's closing `}`) haven't arrived yet.
    const text = '[{"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n,\n{"candidates":[{"content":{"parts":[{"text":"lo';
    expect(() => candidateJsonPayloadsFromSseText(text)).not.toThrow();
    expect(candidateJsonPayloadsFromSseText(text)).toEqual([
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] }),
    ]);
  });

  it('returns nothing (does not throw) for a single element that has not closed yet', () => {
    const text = '[{"candidates":[{"content":{"parts":[{"text":"Hel"';
    expect(() => candidateJsonPayloadsFromSseText(text)).not.toThrow();
    expect(candidateJsonPayloadsFromSseText(text)).toEqual([]);
  });
});

describe('getCandidatePayloadsFromEvents', () => {
  it('reconstructs curl SSE chunks in chronological order given a newest-first input array', () => {
    const chunkA = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n';
    const chunkB = 'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n';
    // findMany() returns newest-first, so the true arrival order (A then B) appears reversed here.
    const newestFirst = [
      { type: 'message', direction: 'INCOMING', data: chunkB },
      { type: 'message', direction: 'INCOMING', data: chunkA },
    ];
    expect(getCandidatePayloadsFromEvents(newestFirst)).toEqual([
      '{"choices":[{"delta":{"content":"Hel"}}]}',
      '{"choices":[{"delta":{"content":"lo"}}]}',
    ]);
  });

  it('reconstructs curl SSE frames split across multiple chunks, given a newest-first input array', () => {
    // True arrival order is 'data: {"a"' then ':1}\n\n'; findMany() returns newest-first.
    const newestFirst = [
      { type: 'message', direction: 'INCOMING', data: ':1}\n\n' },
      { type: 'message', direction: 'INCOMING', data: 'data: {"a"' },
    ];
    expect(getCandidatePayloadsFromEvents(newestFirst)).toEqual(['{"a":1}']);
  });

  it('ignores outgoing and non-message events', () => {
    const events = [
      { type: 'message', direction: 'INCOMING', data: '{"delta":"kept"}' },
      { type: 'message', direction: 'OUTGOING', data: '{"delta":"ignored"}' },
      { type: 'open', direction: '', data: '' },
    ];
    expect(getCandidatePayloadsFromEvents(events)).toEqual(['{"delta":"kept"}']);
  });
});
