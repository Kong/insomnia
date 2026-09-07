import { JSONPath } from 'jsonpath-plus';

const stringifyValue = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
};

export const extractStreamValueAtPath = (payload: string, keyPath: string): string | null => {
  try {
    const parsed = JSON.parse(payload);
    const path = keyPath.trim();
    const result = JSONPath({ path, json: parsed });
    if (Array.isArray(result)) {
      // An empty array means the path matched nothing at all (as opposed to matching a
      // field whose value happens to be an empty string), so it's treated the same as
      // a null/undefined result rather than joined into an empty-but-present fragment.
      if (result.length === 0) {
        return null;
      }
      return result
        .map(stringifyValue)
        .filter((value): value is string => value !== null)
        .join('');
    }
    return stringifyValue(result);
  } catch {
    return null;
  }
};

export const computeStreamSummary = (
  payloads: string[],
  keyPath: string,
): { fragmentCount: number; summary: string } => {
  const fragments = payloads
    .map(payload => extractStreamValueAtPath(payload, keyPath))
    .filter((value): value is string => value !== null);
  return { fragmentCount: fragments.length, summary: fragments.join('') };
};

const STANDARD_SSE_FIELD = /^(event|id|retry):/i;

export function candidateJsonPayloadsFromSseText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const candidates: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    const dataLines = lines
      .map(line => /^data:(?: ?)(.*)$/.exec(line)?.[1])
      .filter((line): line is string => line != null);

    if (dataLines.length > 0) {
      const payload = dataLines.join('\n').trim();
      if (payload) {
        candidates.push(payload);
      }
      continue;
    }

    const trimmedBlock = block.trim();
    if (!trimmedBlock) {
      continue;
    }

    if (trimmedBlock.startsWith('[')) {
      // Gemini's default (non-SSE, no `?alt=sse`) streaming response is a single top-level
      // JSON array with no blank lines between elements, so it lands here as one block.
      // Extract whichever elements have arrived complete so far, even mid-stream before the
      // array's closing `]` shows up, so the summary can render as chunks come in rather
      // than only once the whole response finishes.
      candidates.push(...extractCompleteTopLevelArrayElements(trimmedBlock));
      continue;
    }

    if (isParsableJson(trimmedBlock)) {
      candidates.push(trimmedBlock);
      continue;
    }

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        !trimmedLine ||
        trimmedLine.startsWith(':') ||
        STANDARD_SSE_FIELD.test(trimmedLine) ||
        !isParsableJson(trimmedLine)
      ) {
        continue;
      }
      candidates.push(trimmedLine);
    }
  }

  return candidates;
}

// Scans a (possibly unterminated) top-level JSON array and returns the substring of each
// element that has closed so far, tracking bracket depth and string escaping by hand rather
// than JSON.parse-ing the whole thing (which fails until the array's closing `]` arrives).
// An element still being streamed simply never closes, so it's correctly left out.
function extractCompleteTopLevelArrayElements(text: string): string[] {
  const elements: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let elementStart = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[' || char === '{') {
      if (depth === 1 && elementStart === -1) {
        elementStart = i;
      }
      depth++;
      continue;
    }

    if (char === ']' || char === '}') {
      depth--;
      if (depth === 1 && elementStart !== -1) {
        elements.push(text.slice(elementStart, i + 1));
        elementStart = -1;
      }
      continue;
    }
  }

  return elements;
}

function isParsableJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export interface StreamMessageEvent {
  type: string;
  direction: string;
  data: string;
}

export function getCandidatePayloadsFromEvents(events: StreamMessageEvent[]): string[] {
  // curl's findMany() reverse the event log for "latest event
  // first" display, so undo that exact reversal here (rather than sort by timestamp,
  // which has only millisecond resolution and can't disambiguate SSE chunks that arrive
  // within the same millisecond) to get back true chronological order.
  const incoming = events.filter(event => event.type === 'message' && event.direction === 'INCOMING').reverse();

  return candidateJsonPayloadsFromSseText(incoming.map(event => event.data).join(''));
}

const PATH_TO_JSONPATH: { pathname: string; jsonPath: string }[] = [
  // OpenAI: Chat Completions API
  { pathname: '/v1/chat/completions', jsonPath: '$.choices[0].delta.content' },
  // OpenAI: Completions API, Legacy
  { pathname: '/v1/completions', jsonPath: '$.choices[0].text' },
  // OpenAI Responses API
  { pathname: '/v1/responses', jsonPath: '$.delta' },
  // Anthropic Claude Messages API
  { pathname: '/v1/messages', jsonPath: '$.delta.text' },
];

export const inferStreamSummaryPath = (url: string): string | null => {
  try {
    const { pathname } = new URL(url);
    // Gemini uses a ":verb" suffix (.../models/gemini-pro:streamGenerateContent) rather than
    // a fixed REST path, so it can't go in PATH_TO_JSONPATH's exact-match table below.
    if (pathname.toLowerCase().includes(':streamgeneratecontent')) {
      return '$.candidates[0].content.parts[0].text';
    }
    const match = PATH_TO_JSONPATH.find(entry => entry.pathname === pathname);
    return match ? match.jsonPath : null;
  } catch {
    return null;
  }
};
