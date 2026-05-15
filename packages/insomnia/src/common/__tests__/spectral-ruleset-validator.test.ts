import { describe, expect, it } from 'vitest';

import {
  isLocalFilePath,
  isPrivateOrLoopbackHost,
  toArray,
  validateSpectralRuleset,
} from '../spectral-ruleset-validator';

const expectInvalid = (content: string, errorContains?: string | RegExp): string => {
  const result = validateSpectralRuleset(content);
  expect(result.isValid).toBe(false);
  if (!result.isValid && errorContains) {
    expect(result.error).toMatch(errorContains);
  }
  return result.isValid ? '' : result.error;
};

const expectValid = (content: string): void => {
  expect(validateSpectralRuleset(content)).toEqual({ isValid: true });
};

const ruleWith = (body: string): string =>
  `rules:\n  my-rule:\n${body
    .split('\n')
    .map(l => (l ? `    ${l}` : l))
    .join('\n')}`;

describe('isLocalFilePath()', () => {
  it('returns true for explicit relative prefixes', () => {
    expect(isLocalFilePath('./foo.yaml')).toBe(true);
    expect(isLocalFilePath('../foo.yaml')).toBe(true);
    expect(isLocalFilePath('../../shared/foo.yaml')).toBe(true);
  });

  it('returns true for POSIX absolute paths', () => {
    expect(isLocalFilePath('/etc/spectral/rules.yaml')).toBe(true);
  });

  it('returns false for bare filenames', () => {
    expect(isLocalFilePath('foo.yaml')).toBe(false);
  });

  it('returns false for URLs', () => {
    expect(isLocalFilePath('https://example.com/rules.yaml')).toBe(false);
    expect(isLocalFilePath('http://example.com/rules.yaml')).toBe(false);
  });

  it('returns false for built-in Spectral identifiers', () => {
    expect(isLocalFilePath('spectral:oas')).toBe(false);
  });
});

describe('isPrivateOrLoopbackHost()', () => {
  it('returns true for localhost variants', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
    expect(isPrivateOrLoopbackHost('foo.localhost')).toBe(true);
  });

  it('returns true for loopback IPs (v4 and v6)', () => {
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('::1')).toBe(true);
  });

  it('returns true for RFC 1918 private ranges', () => {
    expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('192.168.1.1')).toBe(true);
  });

  it('returns true for link-local IPv4', () => {
    expect(isPrivateOrLoopbackHost('169.254.0.1')).toBe(true);
  });

  it('returns true for bracketed IPv6 hostnames (as produced by new URL().hostname)', () => {
    expect(isPrivateOrLoopbackHost('[::1]')).toBe(true);
  });

  it('returns false for public unicast IPs', () => {
    expect(isPrivateOrLoopbackHost('8.8.8.8')).toBe(false);
    expect(isPrivateOrLoopbackHost('1.1.1.1')).toBe(false);
  });

  it('returns false for non-IP hostnames (DNS resolution is handled elsewhere)', () => {
    expect(isPrivateOrLoopbackHost('example.com')).toBe(false);
  });
});

describe('toArray()', () => {
  it('returns [] for undefined', () => {
    const value = undefined;
    expect(toArray(value)).toEqual([]);
  });

  it('wraps a single value in an array', () => {
    expect(toArray('a')).toEqual(['a']);
    expect(toArray(0)).toEqual([0]);
  });

  it('returns arrays unchanged', () => {
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(toArray<number>([])).toEqual([]);
  });
});

describe('validateSpectralRuleset()', () => {
  // Top-level shape
  it('rejects empty string', () => {
    expectInvalid('', /empty/i);
  });

  it('rejects whitespace-only content', () => {
    expectInvalid('   \n  \t\n', /empty/i);
  });

  it('rejects unparseable YAML', () => {
    expectInvalid('rules: [unterminated', /yaml|json/i);
  });

  it('rejects YAML that parses to a non-object', () => {
    expectInvalid('"just a string"', /object/i);
    expectInvalid('- a\n- b\n', /object/i);
    expectInvalid('null', /object/i);
  });

  it('rejects an empty object', () => {
    expectInvalid('{}', /declare at least one/i);
  });

  it('rejects unsupported top-level keys', () => {
    const error = expectInvalid('functions:\n  - exec\n', /unsupported top-level/i);
    expect(error).toContain('functions');
  });

  it('accepts JSON input (YAML is a superset of JSON)', () => {
    expectValid('{"extends": ["spectral:oas"]}');
  });

  // extends — covers validateExtends() in full
  it('accepts every built-in extends identifier', () => {
    expectValid('extends:\n  - spectral:oas\n  - spectral:asyncapi\n  - spectral:arazzo\n');
  });

  it('accepts a bare-string extends identifier (single, not array)', () => {
    expectValid('extends: spectral:oas\n');
  });

  it('accepts relative file paths in extends', () => {
    expectValid('extends:\n  - ./rules.yaml\n');
    expectValid('extends:\n  - ../shared/rules.yml\n');
  });

  it('accepts absolute file paths in extends', () => {
    expectValid('extends:\n  - /tmp/rules.yaml\n');
  });

  it('accepts https URLs to public hosts', () => {
    expectValid('extends:\n  - https://example.com/rules.yaml\n');
  });

  it('rejects non-string extends entries', () => {
    expectInvalid('extends:\n  - 42\n', /must be strings/i);
  });

  it('rejects http URLs in extends', () => {
    expectInvalid('extends:\n  - http://example.com/rules.yaml\n', /must use https/i);
  });

  it('rejects extends URLs targeting localhost variants', () => {
    expectInvalid('extends:\n  - https://localhost/rules.yaml\n', /disallowed host/i);
    expectInvalid('extends:\n  - https://foo.localhost/rules.yaml\n', /disallowed host/i);
  });

  it('rejects extends URLs targeting loopback IPs (v4 and v6)', () => {
    expectInvalid('extends:\n  - https://127.0.0.1/rules.yaml\n', /disallowed host/i);
    expectInvalid('extends:\n  - "https://[::1]/rules.yaml"\n', /disallowed host/i);
  });

  it('rejects extends URLs targeting RFC 1918 private ranges', () => {
    expectInvalid('extends:\n  - https://10.0.0.1/rules.yaml\n', /disallowed host/i);
    expectInvalid('extends:\n  - https://192.168.1.1/rules.yaml\n', /disallowed host/i);
    expectInvalid('extends:\n  - https://172.16.0.1/rules.yaml\n', /disallowed host/i);
  });

  it('rejects extends strings that are neither identifiers nor paths nor valid URLs', () => {
    expectInvalid('extends:\n  - not-a-real-thing\n', /not a recognized|valid URL/i);
  });

  // rules + rule body + then — covers validateRules(), validateRuleBody(), validateThen()
  it('rejects rules that is not an object', () => {
    expectInvalid('rules:\n  - foo\n', /"rules" must be an object/);
    expectInvalid('rules: "string"\n', /"rules" must be an object/);
    expectInvalid('rules: null\n', /"rules" must be an object/);
  });

  it('rejects prototype-pollution rule names with object bodies', () => {
    // YAML produces an own property for these names, unlike a JS object literal.
    expectInvalid('"rules":\n  "__proto__":\n    given: $\n    then:\n      function: truthy\n', /not allowed/i);
    expectInvalid('rules:\n  constructor:\n    given: $\n    then:\n      function: truthy\n', /not allowed/i);
    expectInvalid('rules:\n  prototype:\n    given: $\n    then:\n      function: truthy\n', /not allowed/i);
  });

  it('accepts shorthand boolean rule definitions', () => {
    expectValid('rules:\n  my-rule: true\n');
    expectValid('rules:\n  my-rule: false\n');
  });

  it('accepts shorthand severity-string rule definitions', () => {
    expectValid('rules:\n  my-rule: warn\n');
    expectValid('rules:\n  my-rule: error\n');
  });

  it('rejects rule bodies that are not objects, booleans, or severity strings', () => {
    expectInvalid('rules:\n  my-rule: 42\n', /must be an object, boolean, or severity string/i);
  });

  it('rejects given expressions containing each prototype-pollution token', () => {
    expectInvalid(ruleWith('given: "$.__proto__.x"\nthen:\n  function: truthy'), /disallowed token/i);
    expectInvalid(ruleWith('given: "$.prototype.x"\nthen:\n  function: truthy'), /disallowed token/i);
    expectInvalid(ruleWith('given: "$.constructor.x"\nthen:\n  function: truthy'), /disallowed token/i);
  });

  it('rejects when any entry of a given array is unsafe', () => {
    expectInvalid(ruleWith('given:\n  - $.paths[*]\n  - $.__proto__\nthen:\n  function: truthy'), /disallowed token/i);
  });

  it('accepts non-string given values (only strings are checked)', () => {
    expectValid(ruleWith('given: 42\nthen:\n  function: truthy'));
  });

  it('rejects rule documentationUrl with unsafe schemes', () => {
    expectInvalid(
      ruleWith('given: $\ndocumentationUrl: http://example.com\nthen:\n  function: truthy'),
      /documentationUrl/i,
    );
    expectInvalid(
      ruleWith('given: $\ndocumentationUrl: "ftp://example.com"\nthen:\n  function: truthy'),
      /documentationUrl/i,
    );
    expectInvalid(
      ruleWith('given: $\ndocumentationUrl: "javascript:alert(1)"\nthen:\n  function: truthy'),
      /documentationUrl/i,
    );
    expectInvalid(ruleWith('given: $\ndocumentationUrl: "not a url"\nthen:\n  function: truthy'), /documentationUrl/i);
  });

  it('accepts rule documentationUrl that is https', () => {
    expectValid(ruleWith('given: $\ndocumentationUrl: https://example.com\nthen:\n  function: truthy'));
  });

  it('skips non-string documentationUrl (the string check is the only gate)', () => {
    expectValid(ruleWith('given: $\ndocumentationUrl: 42\nthen:\n  function: truthy'));
  });

  it('rejects then.field containing prototype-pollution tokens', () => {
    expectInvalid(ruleWith('given: $\nthen:\n  field: __proto__\n  function: truthy'), /field/i);
    expectInvalid(ruleWith('given: $\nthen:\n  field: prototype\n  function: truthy'), /field/i);
    expectInvalid(ruleWith('given: $\nthen:\n  field: constructor\n  function: truthy'), /field/i);
  });

  it('rejects then.field containing path traversal characters', () => {
    expectInvalid(ruleWith('given: $\nthen:\n  field: a.b\n  function: truthy'), /field/i);
    expectInvalid(ruleWith('given: $\nthen:\n  field: "a[0]"\n  function: truthy'), /field/i);
    expectInvalid(ruleWith('given: $\nthen:\n  field: "a]b"\n  function: truthy'), /field/i);
  });

  it('accepts then.field that is a plain property name', () => {
    expectValid(ruleWith('given: $\nthen:\n  field: summary\n  function: truthy'));
  });

  it('rejects then.function that is not a built-in', () => {
    expectInvalid(ruleWith('given: $\nthen:\n  function: exec'), /not an allowed/i);
    expectInvalid(ruleWith('given: $\nthen:\n  function: arbitrary'), /not an allowed/i);
  });

  it('rejects non-string then.function values', () => {
    expectInvalid(ruleWith('given: $\nthen:\n  function: 123'), /not an allowed/i);
  });

  it('accepts every documented built-in Spectral function', () => {
    const builtins = [
      'alphabetical',
      'casing',
      'defined',
      'enumeration',
      'falsy',
      'length',
      'pattern',
      'schema',
      'truthy',
      'typedEnum',
      'undefined',
      'unreferencedReusableObject',
      'or',
      'xor',
    ];
    for (const fn of builtins) {
      expectValid(ruleWith(`given: $\nthen:\n  function: ${fn}`));
    }
  });

  it('iterates an array of then clauses and rejects any invalid entry', () => {
    expectInvalid(
      `rules:
  my-rule:
    given: $
    then:
      - function: truthy
      - function: exec
`,
      /not an allowed/i,
    );
  });

  it('accepts an array of then clauses when all are valid', () => {
    expectValid(`
rules:
  my-rule:
    given: $
    then:
      - field: summary
        function: truthy
      - field: description
        function: truthy
`);
  });

  it('skips non-object entries inside a then array', () => {
    expectValid(`
rules:
  my-rule:
    given: $
    then:
      - null
      - function: truthy
`);
  });

  it('accepts a full ruleset combining extends, rules, and a documentationUrl', () => {
    expectValid(`
extends:
  - spectral:oas
  - ./shared.yaml
rules:
  my-rule:
    description: My rule
    given: $.paths[*]
    severity: warn
    documentationUrl: https://example.com/docs
    then:
      field: summary
      function: truthy
`);
  });
});
