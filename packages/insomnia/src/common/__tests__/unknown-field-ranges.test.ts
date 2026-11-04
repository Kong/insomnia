import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { InsomniaFileSchema } from '../import-v5-parser';
import { checkStrictSchemaMatch } from '../zod/check-schema-mismatch';
import { findUnknownFieldRanges } from '../zod/find-unknown-field-ranges';

const fixtureDir = path.join(__dirname, '..', '__fixtures__', 'insomnia-v5-roundtrip');

// operations.yaml has a folder at collection[0] whose first child (children[0]) is a request.
function loadOperations(): any {
  return parse(fs.readFileSync(path.join(fixtureDir, 'operations.yaml'), 'utf8'));
}

function lineOf(text: string, needle: string) {
  const index = text.split('\n').findIndex(line => line.includes(needle));
  expect(index, `"${needle}" should be in the document`).toBeGreaterThanOrEqual(0);
  return index + 1;
}

describe('findUnknownFieldRanges', () => {
  it('returns nothing for a file without unknown fields', () => {
    expect(findUnknownFieldRanges(stringify(loadOperations()), InsomniaFileSchema)).toEqual([]);
  });

  it('highlights an unknown top-level field', () => {
    const text = stringify({ ...loadOperations(), topLevelFuture: 'x', lowerLevelFuture: 'y' });

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({
        startLine: lineOf(text, 'topLevelFuture:'),
        endLine: lineOf(text, 'topLevelFuture:'),
        message: expect.stringContaining('topLevelFuture'),
      }),
      expect.objectContaining({
        startLine: lineOf(text, 'lowerLevelFuture:'),
        endLine: lineOf(text, 'lowerLevelFuture:'),
        message: expect.stringContaining('lowerLevelFuture'),
      }),
    ]);
  });

  it('finds the correct leaf for a request inside a folder (plain z.union, no discriminator)', () => {
    const doc = loadOperations();
    doc.collection[0].children[0].someFutureField = 'x';
    const text = stringify(doc);
    const line = lineOf(text, 'someFutureField:');

    // Only the real mismatch is reported, not the noise from the 4 union branches the request doesn't belong to.
    const { errors } = checkStrictSchemaMatch(InsomniaFileSchema, doc);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('unrecognized_keys');
    expect(errors[0].keys).toEqual(['someFutureField']);

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({
        startLine: line,
        endLine: line,
        label: 'someFutureField',
        message: expect.stringContaining('someFutureField'),
      }),
    ]);
  });

  it('finds the correct leaf when both a folder and a request inside it have unknown fields', () => {
    const doc = loadOperations();
    doc.collection[0].folderFuture = 1;
    doc.collection[0].children[0].requestFuture = 2;
    const text = stringify(doc);

    const { errors } = checkStrictSchemaMatch(InsomniaFileSchema, doc);
    expect(errors.map(error => error.keys).sort()).toEqual([['folderFuture'], ['requestFuture']]);

    const ranges = findUnknownFieldRanges(text, InsomniaFileSchema);
    expect(ranges.map(range => range.startLine)).toEqual(
      [lineOf(text, 'folderFuture:'), lineOf(text, 'requestFuture:')].sort((a, b) => a - b),
    );
  });

  it('highlights every line of an unknown field with a nested value', () => {
    const doc = loadOperations();
    doc.collection[0].children[0].futureObject = { a: 1, nested: { b: 2, c: [3, 4] } };
    const text = stringify(doc);
    const lines = text.split('\n');
    const start = lineOf(text, 'futureObject:');
    // futureObject spans until the indentation drops back to the request's level
    const indent = lines[start - 1].search(/\S/);
    let end = start;
    while (end < lines.length && (lines[end].trim() === '' ? false : lines[end].search(/\S/) > indent)) {
      end++;
    }

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({ startLine: start, endLine: end }),
    ]);
  });

  it('highlights an unknown field nested inside a known object', () => {
    const doc = loadOperations();
    doc.collection[0].children[0].body = { mimeType: 'text/plain', futureBodyField: 1 };
    const text = stringify(doc);
    const line = lineOf(text, 'futureBodyField:');

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({ startLine: line, endLine: line, message: expect.stringContaining('futureBodyField') }),
    ]);
  });

  it('highlights an unknown auth type on a request inside a folder', () => {
    const doc = loadOperations();
    doc.collection[0].children[0].authentication = { type: 'someFutureAuthType2026', apiKey: 'x' };
    const text = stringify(doc);

    const ranges = findUnknownFieldRanges(text, InsomniaFileSchema);
    const typeLine = lineOf(text, 'type: someFutureAuthType2026');
    const apiKeyLine = lineOf(text, 'apiKey: x');
    expect(ranges.some(range => range.startLine <= typeLine && range.endLine >= typeLine)).toBe(true);
    expect(ranges.some(range => range.startLine <= apiKeyLine && range.endLine >= apiKeyLine)).toBe(true);
    // The request's own (wrong) union branches must not leak in as extra highlights elsewhere in the file
    expect(ranges.every(range => range.startLine >= typeLine - 1 && range.endLine <= apiKeyLine + 1)).toBe(true);
  });

  it('highlights only the unknown field of an auth block, not the whole block', () => {
    const doc = loadOperations();
    // AuthenticationSchema is `z.union([z.discriminatedUnion('type', [...]), z.object({})])`: for the block below the
    // empty fallback object reports every field as unknown, which must not reach the editor.
    doc.collection[0].children[0].authentication = {
      type: 'oauth2',
      disabled: false,
      grantType: 'mcp_auth_flow',
      extraPropertyInAuth: 'foo',
      clientId: '',
      scope: '',
      tokenPrefix: 'bearer',
    };
    const text = stringify(doc);
    const line = lineOf(text, 'extraPropertyInAuth:');

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({
        startLine: line,
        endLine: line,
        label: 'extraPropertyInAuth',
        message: expect.stringContaining('extraPropertyInAuth'),
      }),
    ]);
  });

  it('does not highlight valid nodes reported by the branches of a union they do not belong to', () => {
    const doc = loadOperations();
    // SpecSchema is a plain z.union of `{ file }` and `{ contents }`; the `{ file }` branch reports both
    // "spec.file: expected string" and `contents` as an unknown key, neither of which is a real mismatch.
    doc.spec = { contents: { openapi: '3.0.3' }, specFuture: 1 };
    const text = stringify(doc);
    const line = lineOf(text, 'specFuture:');

    const { errors } = checkStrictSchemaMatch(InsomniaFileSchema, doc);
    expect(errors.every(error => error.keys)).toBe(true);

    expect(findUnknownFieldRanges(text, InsomniaFileSchema)).toEqual([
      expect.objectContaining({ startLine: line, endLine: line, label: 'specFuture' }),
    ]);
  });

  it('ignores YAML that is not an Insomnia file', () => {
    const openApi = fs.readFileSync(path.join(fixtureDir, 'security.yaml'), 'utf8');
    expect(findUnknownFieldRanges(openApi, InsomniaFileSchema)).toEqual([]);
  });

  it('does not throw on invalid YAML', () => {
    expect(findUnknownFieldRanges('a: [unclosed', InsomniaFileSchema)).toEqual([]);
    expect(findUnknownFieldRanges('', InsomniaFileSchema)).toEqual([]);
  });
});

// Builds a collection of `total` requests spread over folders, cloned from a real request in operations.yaml.
function buildLargeCollection(total: number, requestsPerFolder: number, withUnknownField: boolean) {
  const doc = loadOperations();
  const folderTemplate = doc.collection[0];
  const requestTemplate = folderTemplate.children[0];

  const folders: any[] = [];
  let requestCount = 0;
  while (requestCount < total) {
    const folder = structuredClone({ ...folderTemplate, children: [] });
    folder.meta = { ...folderTemplate.meta, id: `fld_${String(folders.length).padStart(32, '0')}` };
    for (let i = 0; i < requestsPerFolder && requestCount < total; i++, requestCount++) {
      const request = structuredClone(requestTemplate);
      request.meta = { ...requestTemplate.meta, id: `req_${String(requestCount).padStart(32, '0')}` };
      request.name = `Request ${requestCount}`;
      if (withUnknownField) {
        request.futureField = `value-${requestCount}`;
      }
      folder.children.push(request);
    }
    folders.push(folder);
  }
  doc.collection = folders;
  return stringify(doc);
}

describe('findUnknownFieldRanges performance on large files', () => {
  // Measured at roughly 120ms (500 requests), 240ms (1000) and 490ms (2000) with an unknown field on every request;
  // the budget is ~20x that so slow CI machines don't make the test flaky while real regressions are still caught.
  const TIME_BUDGET_MS = 5000;

  it.each([500, 1000])(
    'finds the unknown field of every request in a file with %i requests',
    total => {
      const text = buildLargeCollection(total, 25, true);

      const start = performance.now();
      const ranges = findUnknownFieldRanges(text, InsomniaFileSchema);
      const elapsedMs = performance.now() - start;

      console.info(
        `[perf] ${total} requests, ${(text.length / 1024).toFixed(0)}KB, ${text.split('\n').length} lines: ${elapsedMs.toFixed(0)}ms`,
      );

      // One range per request, each on exactly the line of that request's unknown field
      const expectedLines = text
        .split('\n')
        .flatMap((line, index) => (line.includes('futureField: value-') ? [index + 1] : []));
      expect(expectedLines).toHaveLength(total);
      expect(ranges.map(range => range.startLine)).toEqual(expectedLines);
      expect(ranges.every(range => range.startLine === range.endLine && range.label === 'futureField')).toBe(true);

      expect(elapsedMs).toBeLessThan(TIME_BUDGET_MS);
    },
    30_000,
  );

  it('is fast for a large file without any unknown fields', () => {
    const text = buildLargeCollection(1000, 25, false);

    const start = performance.now();
    const ranges = findUnknownFieldRanges(text, InsomniaFileSchema);
    const elapsedMs = performance.now() - start;

    console.info(`[perf] 1000 requests without unknown fields: ${elapsedMs.toFixed(0)}ms`);

    expect(ranges).toEqual([]);
    expect(elapsedMs).toBeLessThan(TIME_BUDGET_MS);
  }, 30_000);
});
