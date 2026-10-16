import { describe, expect, it, vi } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import {
  collectLeafValues,
  createSensitiveValueCollector,
  redactConfidentialText,
  redactResponsePatch,
  redactTestResults,
  redactText,
  withRedaction,
} from './sensitive-value-collector';

describe('redactConfidentialText', () => {
  it('replaces a matching substring', () => {
    expect(redactConfidentialText('Bearer mysecret123', ['mysecret123'])).toBe('Bearer ••••••');
  });

  it('replaces all occurrences', () => {
    expect(redactConfidentialText('a mysecret a mysecret', ['mysecret'])).toBe('a •••••• a ••••••');
  });

  it('skips empty values', () => {
    expect(redactConfidentialText('unchanged', [''])).toBe('unchanged');
  });

  it('applies multiple values in order', () => {
    const result = redactConfidentialText('token=abc123 key=xyz789', ['abc123', 'xyz789']);
    expect(result).toBe('token=•••••• key=••••••');
  });

  it('returns unchanged text when no values match', () => {
    expect(redactConfidentialText('hello world', ['nomatch'])).toBe('hello world');
  });

  it('fully masks a value even when a shorter value it contains is registered first', () => {
    expect(redactConfidentialText('abc-secret-xyz', ['abc', 'abc-secret-xyz'])).toBe(CONFIDENTIAL_MASK_VALUE);
  });
});

describe('createSensitiveValueCollector', () => {
  it('returns null when hideSecretValues is false', () => {
    expect(createSensitiveValueCollector(false)).toBeNull();
  });

  it('returns a collector when hideSecretValues is true', () => {
    expect(createSensitiveValueCollector(true)).not.toBeNull();
  });

  describe('collector', () => {
    it('registers and redacts values', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('mysecret');
      expect(collector.redact('value=mysecret')).toBe('value=••••••');
    });

    it('deduplicates registrations', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('dup');
      collector.register('dup');
      expect(collector.redact('dup dup')).toBe('•••••• ••••••');
    });

    it('reports isEmpty correctly', () => {
      const collector = createSensitiveValueCollector(true)!;
      expect(collector.isEmpty).toBe(true);
      collector.register('val');
      expect(collector.isEmpty).toBe(false);
    });

    it('ignores empty string registration', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('');
      expect(collector.isEmpty).toBe(true);
    });

    it('redacts a value that reaches the timeline JSON-escaped', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('ab"cd');
      // How the value actually lands in an NDJSON timeline line.
      const timelineLine = JSON.stringify({ value: 'token=ab"cd' });
      expect(collector.redact(timelineLine)).toBe('{"value":"token=••••••"}');
    });

    it('redacts a value that reaches the timeline percent-encoded in a URL', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('p@ss word/1');
      expect(collector.redact('GET https://example.com?t=p%40ss%20word%2F1')).toBe(
        'GET https://example.com?t=••••••',
      );
    });

    it('does not throw on a lone surrogate, which encodeURIComponent rejects', () => {
      const collector = createSensitiveValueCollector(true)!;
      expect(() => collector.register(String.fromCodePoint(0xD8_00))).not.toThrow();
    });
  });
});

describe('collectLeafValues', () => {
  it('registers a top-level string', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues('secret', collector);
    expect(collector.redact('secret')).toBe('••••••');
  });

  it('registers strings nested in an object', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues({ a: 'val1', b: { c: 'val2' } }, collector);
    expect(collector.redact('val1 val2')).toBe('•••••• ••••••');
  });

  it('registers strings inside an array', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues(['x', 'y'], collector);
    expect(collector.redact('x y')).toBe('•••••• ••••••');
  });

  it('registers numeric leaves as their string form', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues({ pin: 1234, nested: { rate: 0.75 } }, collector);
    expect(collector.redact('pin=1234 rate=0.75')).toBe('pin=•••••• rate=••••••');
  });

  it('registers a top-level number', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues(987_654, collector);
    expect(collector.redact('987654')).toBe('••••••');
  });

  it('skips booleans, null and non-finite numbers', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafValues({ b: true, nil: null, nan: Number.NaN, inf: Number.POSITIVE_INFINITY }, collector);
    expect(collector.isEmpty).toBe(true);
  });
});

describe('redactText', () => {
  it('redacts registered values', () => {
    const collector = createSensitiveValueCollector(true)!;
    collector.register('sk_live_abc');
    expect(redactText('auth failed for sk_live_abc', collector)).toBe('auth failed for ••••••');
  });

  it('returns the text unchanged when the collector is null', () => {
    expect(redactText('sk_live_abc', null)).toBe('sk_live_abc');
  });

  it('passes undefined through', () => {
    const collector = createSensitiveValueCollector(true)!;
    collector.register('sk_live_abc');
    expect(redactText(undefined, collector)).toBeUndefined();
  });
});

describe('redactTestResults', () => {
  const result = {
    testCase: 'login with sk_live_abc',
    status: 'failed' as const,
    executionTime: 1,
    errorMessage: "expected 'sk_live_abc' to deeply equal 'x'",
    category: 'after-response' as const,
  };

  it('redacts both the test name and the assertion message', () => {
    const collector = createSensitiveValueCollector(true)!;
    collector.register('sk_live_abc');

    const [redacted] = redactTestResults([result], collector);

    expect(redacted.testCase).toBe('login with ••••••');
    expect(redacted.errorMessage).toBe("expected '••••••' to deeply equal 'x'");
    expect(redacted.status).toBe('failed');
  });

  it('does not introduce an errorMessage key when there was none', () => {
    const collector = createSensitiveValueCollector(true)!;
    const { errorMessage: _omitted, ...passing } = result;

    const [redacted] = redactTestResults([passing], collector);

    expect('errorMessage' in redacted).toBe(false);
  });

  it('returns the results unchanged when the collector is null', () => {
    const results = [result];
    expect(redactTestResults(results, null)).toBe(results);
  });
});

describe('redactResponsePatch', () => {
  it('redacts url, error and test results', () => {
    const collector = createSensitiveValueCollector(true)!;
    collector.register('sk_live_abc');

    const redacted = redactResponsePatch(
      {
        elapsedTime: 10,
        url: 'https://example.com/?token=sk_live_abc',
        error: 'Script executor returns error: sk_live_abc is not valid JSON',
        requestTestResults: [
          {
            testCase: 'uses sk_live_abc',
            status: 'passed',
            executionTime: 1,
            category: 'pre-request',
          },
        ],
      },
      collector,
    );

    expect(redacted.url).toBe('https://example.com/?token=••••••');
    expect(redacted.error).toBe('Script executor returns error: •••••• is not valid JSON');
    expect(redacted.requestTestResults?.[0].testCase).toBe('uses ••••••');
  });

  it('leaves absent fields absent', () => {
    const collector = createSensitiveValueCollector(true)!;
    const redacted = redactResponsePatch({ elapsedTime: 10, statusCode: 200 }, collector);

    expect(redacted.url).toBeUndefined();
    expect(redacted.error).toBeUndefined();
    expect('requestTestResults' in redacted).toBe(false);
  });

  it('returns the patch unchanged when the collector is null', () => {
    const patch = { elapsedTime: 10, url: 'https://example.com/?token=sk_live_abc' };
    expect(redactResponsePatch(patch, null)).toBe(patch);
  });
});

describe('withRedaction', () => {
  const makeRuntime = () => ({
    appendTimeline: vi.fn(async () => {}),
    appendTimelineOnError: vi.fn(async () => {}),
  });

  it('returns the runtime unchanged when the collector is null', () => {
    const runtime = makeRuntime();
    expect(withRedaction(runtime, null)).toBe(runtime);
  });

  it('redacts every log line before delegating to the wrapped appendTimeline', async () => {
    const runtime = makeRuntime();
    const collector = createSensitiveValueCollector(true)!;
    collector.register('mysecret');

    await withRedaction(runtime, collector).appendTimeline('/tmp/timeline', ['value=mysecret', 'unrelated']);

    expect(runtime.appendTimeline).toHaveBeenCalledWith('/tmp/timeline', ['value=••••••', 'unrelated']);
  });

  it('redacts the error payload before delegating to the wrapped appendTimelineOnError', async () => {
    const runtime = makeRuntime();
    const collector = createSensitiveValueCollector(true)!;
    collector.register('mysecret');

    await withRedaction(runtime, collector).appendTimelineOnError('/tmp/timeline', 'auth failed for mysecret');

    expect(runtime.appendTimelineOnError).toHaveBeenCalledWith('/tmp/timeline', 'auth failed for ••••••');
  });

  it('picks up values registered after the wrapper was constructed', async () => {
    const runtime = makeRuntime();
    const collector = createSensitiveValueCollector(true)!;
    const redactingRuntime = withRedaction(runtime, collector);

    collector.register('late-secret');
    await redactingRuntime.appendTimeline('/tmp/timeline', ['late-secret']);

    expect(runtime.appendTimeline).toHaveBeenCalledWith('/tmp/timeline', ['••••••']);
  });
});
