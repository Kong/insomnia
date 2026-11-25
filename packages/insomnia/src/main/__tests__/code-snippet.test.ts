import { HTTPSnippet } from 'httpsnippet';
import { describe, expect, it } from 'vitest';

import { describeCodeSnippetError, toCodeSnippetError } from '../code-snippet';

const validationError = (errors: unknown[]) => ({ name: 'HARError', errors });

describe('describeCodeSnippetError()', () => {
  it('names the field that failed HAR validation', () => {
    let error: unknown;
    try {
      new HTTPSnippet({
        method: 'GET',
        url: '',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        queryString: [],
        headersSize: -1,
        bodySize: -1,
      });
    } catch (err) {
      error = err;
    }

    expect(describeCodeSnippetError(error)).toContain('URL is not a valid URL');
  });

  it('names the missing property and its position', () => {
    const error = validationError([
      { instancePath: '/cookies/0', message: "must have required property 'value'", params: { missingProperty: 'value' } },
    ]);

    expect(describeCodeSnippetError(error)).toBe('Could not generate code: cookie 1 is missing "value".');
  });

  it('descends into nested object fields without inventing an index', () => {
    const error = validationError([{ instancePath: '/postData/mimeType', message: 'must be string' }]);

    expect(describeCodeSnippetError(error)).toBe('Could not generate code: request body > mimeType must be string.');
  });

  it('counts array indexes at any depth', () => {
    const error = validationError([{ instancePath: '/postData/params/0/value', message: 'must be string' }]);

    expect(describeCodeSnippetError(error)).toBe(
      'Could not generate code: request body > params > 1 > value must be string.',
    );
  });

  it('ignores errors without validation details', () => {
    expect(describeCodeSnippetError(new Error('boom'))).toBeNull();
  });
});

describe('toCodeSnippetError()', () => {
  it('turns HAR validation details into a plain error, the only shape IPC keeps', () => {
    const wrapped = toCodeSnippetError(validationError([{ instancePath: '/url', message: 'must match format "uri"' }]));

    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped instanceof Error ? wrapped.name : '').toBe('Error');
    expect(wrapped instanceof Error ? wrapped.message : '').toContain('URL is not a valid URL');
  });

  it('leaves errors without validation details untouched', () => {
    const error = new Error('boom');

    expect(toCodeSnippetError(error)).toBe(error);
  });
});
