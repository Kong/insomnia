import { describe, expect, it } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import { collectLeafStrings, createSensitiveValueCollector, redactConfidentialText } from './sensitive-value-collector';

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
