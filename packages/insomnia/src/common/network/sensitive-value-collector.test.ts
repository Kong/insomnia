import { describe, expect, it, vi } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import {
  collectLeafStrings,
  createSensitiveValueCollector,
  redactConfidentialText,
  redactDeep,
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

    it('exposes every registered value as a snapshot array, for cross-IPC transfer (T10)', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('a');
      collector.register('b');
      collector.register('a');
      expect([...collector.values].sort()).toEqual(['a', 'b']);
    });

    it('returns an empty array from values when nothing was registered', () => {
      const collector = createSensitiveValueCollector(true)!;
      expect(collector.values).toEqual([]);
    });

    it('does not let external mutation of the values snapshot affect subsequent redaction', () => {
      const collector = createSensitiveValueCollector(true)!;
      collector.register('secret');
      const snapshot = collector.values as string[];
      snapshot.push('unregistered');
      expect(collector.redact('secret unregistered')).toBe('•••••• unregistered');
    });
  });
});

describe('redactDeep', () => {
  it('redacts a top-level string', () => {
    expect(redactDeep('mysecret', ['mysecret'])).toBe('••••••');
  });

  it('redacts string leaves nested in an object, preserving shape', () => {
    const input = { a: 'mysecret', b: { c: 'mysecret', d: 42 } };
    expect(redactDeep(input, ['mysecret'])).toEqual({ a: '••••••', b: { c: '••••••', d: 42 } });
  });

  it('redacts string leaves inside an array', () => {
    expect(redactDeep(['mysecret', 'unrelated'], ['mysecret'])).toEqual(['••••••', 'unrelated']);
  });

  it('redacts a value containing quotes and newlines before JSON.stringify would have escaped them', () => {
    const secret = 'p@ss"with\nquotes';
    const input = { data: secret };
    expect(redactDeep(input, [secret])).toEqual({ data: '••••••' });
  });

  it('leaves non-plain-object values (e.g. Buffer, Error) unchanged', () => {
    const buf = Buffer.from('mysecret');
    expect(redactDeep(buf, ['mysecret'])).toBe(buf);
    const err = new Error('mysecret');
    expect(redactDeep(err, ['mysecret'])).toBe(err);
  });

  it('leaves numbers, booleans and null unchanged', () => {
    expect(redactDeep(42, ['x'])).toBe(42);
    expect(redactDeep(true, ['x'])).toBe(true);
    expect(redactDeep(null, ['x'])).toBe(null);
  });
});

describe('collectLeafStrings', () => {
  it('registers a top-level string', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafStrings('secret', collector);
    expect(collector.redact('secret')).toBe('••••••');
  });

  it('registers strings nested in an object', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafStrings({ a: 'val1', b: { c: 'val2' } }, collector);
    expect(collector.redact('val1 val2')).toBe('•••••• ••••••');
  });

  it('registers strings inside an array', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafStrings(['x', 'y'], collector);
    expect(collector.redact('x y')).toBe('•••••• ••••••');
  });

  it('skips non-string leaves', () => {
    const collector = createSensitiveValueCollector(true)!;
    collectLeafStrings({ n: 42, b: true, nil: null }, collector);
    expect(collector.isEmpty).toBe(true);
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
