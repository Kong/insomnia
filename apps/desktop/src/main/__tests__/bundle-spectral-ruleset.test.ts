import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

// Mock fs and dns so no real files or DNS lookups are needed.
vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
    },
  },
}));
vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

import dns from 'node:dns/promises';
import fs from 'node:fs';

import { bundleSpectralRuleset, compileSpectralRulesetFromContent } from '~/main/bundle-spectral-ruleset';

const mockReadFile = vi.mocked(fs.promises.readFile) as MockedFunction<(path: string) => Promise<string>>;

// Returns the absolute path that bundleSpectralRuleset will resolve for a given fake path.
function abs(fakePath: string) {
  return path.resolve(fakePath);
}

// Stub dns.lookup({ all: true }) to return the given addresses.
function mockResolvedAddresses(addresses: string[]) {
  vi.mocked(dns.lookup).mockResolvedValue(
    addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 })) as any,
  );
}

// Builds a fake fetch Response carrying a remote ruleset body.
function rulesetResponse(body: string, init?: { ok?: boolean; status?: number; statusText?: string }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: async () => body,
  } as unknown as Response;
}

const VALID_RULE = `
  remote-rule:
    given: "$.paths"
    severity: warn
    then:
      function: truthy
`;

beforeEach(() => {
  mockReadFile.mockReset();
  vi.mocked(dns.lookup).mockReset();
  // Default: any hostname resolves to a public address unless a test overrides this.
  mockResolvedAddresses(['93.184.216.34']);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bundleSpectralRuleset', () => {
  it('returns a simple ruleset with no extends unchanged', async () => {
    mockReadFile.mockResolvedValueOnce(
      `
rules:
  my-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`,
    );

    const result = await bundleSpectralRuleset('/fake/ruleset.yaml');
    expect(result).toContain('my-rule');
    expect(result).not.toContain('extends');
  });

  it('passes through spectral built-in identifier extends unchanged', async () => {
    mockReadFile.mockResolvedValueOnce(
      `
extends: "spectral:oas"
rules:
  my-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`,
    );

    const result = await bundleSpectralRuleset('/fake/ruleset.yaml');
    expect(result).toContain('spectral:oas');
    expect(result).toContain('my-rule');
  });

  it('flattens a local extends entry, merging child rules into the parent', async () => {
    const parentPath = '/fake/parent.yaml';
    const childPath = '/fake/child.yaml';

    mockReadFile.mockImplementation(async filePath => {
      if (filePath === abs(parentPath)) {
        return `
extends:
  - "./child.yaml"
rules:
  parent-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`;
      }
      if (filePath === abs(childPath)) {
        return `
rules:
  child-rule:
    given: "$.paths"
    severity: error
    then:
      function: truthy
`;
      }
      throw new Error(`Unexpected readFile call: ${filePath}`);
    });

    const result = await bundleSpectralRuleset(parentPath);
    expect(result).toContain('parent-rule');
    expect(result).toContain('child-rule');
    expect(result).not.toContain('./child.yaml');
  });

  it('parent rule overrides child rule with the same name', async () => {
    const parentPath = '/fake/parent.yaml';
    const childPath = '/fake/child.yaml';

    mockReadFile.mockImplementation(async filePath => {
      if (filePath === abs(parentPath)) {
        return `
extends:
  - "./child.yaml"
rules:
  shared-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`;
      }
      if (filePath === abs(childPath)) {
        return `
rules:
  shared-rule:
    given: "$.paths"
    severity: error
    then:
      function: truthy
`;
      }
      throw new Error(`Unexpected readFile call: ${filePath}`);
    });

    const result = await bundleSpectralRuleset(parentPath);
    // Parent's severity (warn) wins over child's (error).
    expect(result).toContain('warn');
    expect(result).not.toContain('error');
  });

  it('throws on a cycle in extends', async () => {
    const aPath = '/fake/a.yaml';
    const bPath = '/fake/b.yaml';

    mockReadFile.mockImplementation(async filePath => {
      if (filePath === abs(aPath)) {
        return `extends:\n  - "./b.yaml"\n`;
      }
      if (filePath === abs(bPath)) {
        return `extends:\n  - "./a.yaml"\n`;
      }
      throw new Error(`Unexpected readFile call: ${filePath}`);
    });

    await expect(bundleSpectralRuleset(aPath)).rejects.toThrow('"extends" cycle detected');
  });

  it('throws when extends nesting exceeds max depth', async () => {
    // 7 levels of nesting exceeds the max depth of 5, so this should throw an error.
    const files: Record<string, string> = {};
    for (let i = 0; i <= 6; i++) {
      const next = i < 6 ? `extends:\n  - "./depth${i + 1}.yaml"\n` : `rules: {}\n`;
      files[abs(`/fake/depth${i}.yaml`)] = next;
    }

    mockReadFile.mockImplementation(async filePath => {
      if (files[filePath]) {
        return files[filePath];
      }
      throw new Error(`Unexpected readFile call: ${filePath}`);
    });

    await expect(bundleSpectralRuleset('/fake/depth0.yaml')).rejects.toThrow('"extends" nested too deeply');
  });

  it('throws when extends points to a non-YAML file', async () => {
    mockReadFile.mockResolvedValueOnce(`extends:\n  - "./rules.txt"\n`);

    await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow(
      '"extends" target must be a .yaml or .yml file',
    );
  });

  it('throws when an extends entry uses tuple format', async () => {
    mockReadFile.mockResolvedValueOnce(
      `
extends:
  - - spectral:oas
    - recommended
`,
    );

    await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('tuple format');
  });

  it('throws when the ruleset file is not a YAML object', async () => {
    mockReadFile.mockResolvedValueOnce('- item1\n- item2\n');

    await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('must be an object at the top level');
  });

  it('rejects a local ruleset that declares custom functions (RCE vector)', async () => {
    mockReadFile.mockResolvedValueOnce(
      `
functions:
  - exec
rules:
  env-check:
    given: "$"
    then:
      function: exec
`,
    );

    await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('Invalid Spectral ruleset');
  });

  it('deduplicates spectral identifiers from multiple child files', async () => {
    const parentPath = '/fake/parent.yaml';
    const childAPath = '/fake/childA.yaml';
    const childBPath = '/fake/childB.yaml';

    mockReadFile.mockImplementation(async filePath => {
      if (filePath === abs(parentPath)) {
        return `extends:\n  - "./childA.yaml"\n  - "./childB.yaml"\n`;
      }
      if (filePath === abs(childAPath)) {
        return `extends:\n  - "spectral:oas"\n`;
      }
      if (filePath === abs(childBPath)) {
        return `extends:\n  - "spectral:oas"\n`;
      }
      throw new Error(`Unexpected readFile call: ${filePath}`);
    });

    const result = await bundleSpectralRuleset(parentPath);
    const matches = (result.match(/spectral:oas/g) ?? []).length;
    expect(matches).toBe(1);
  });

  describe('remote URL extends', () => {
    it('validates a remote ruleset and preserves the URL in extends', async () => {
      mockReadFile.mockResolvedValueOnce(
        `
extends:
  - "https://example.com/remote.yaml"
rules:
  local-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`,
      );
      vi.mocked(fetch).mockResolvedValue(rulesetResponse(`rules:${VALID_RULE}`));

      const result = await bundleSpectralRuleset('/fake/ruleset.yaml');
      // Local rules are merged in; remote URL is preserved for Spectral to fetch at lint time.
      expect(result).toContain('local-rule');
      expect(result).toContain('https://example.com/remote.yaml');
      // Remote content is NOT merged into the bundle.
      expect(result).not.toContain('remote-rule');
    });

    it('rejects a remote ruleset that declares custom functions (RCE vector)', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://example.com/exec.yaml"\n`);
      vi.mocked(fetch).mockResolvedValue(
        rulesetResponse(
          `
functions:
  - exec
rules:
  env-check:
    given: "$"
    then:
      function: exec
`,
        ),
      );

      // validateRemoteExtends calls validateSpectralRuleset on each fetched remote ruleset,
      // blocking "functions" before the URL is accepted into "extends".
      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('failed validation');
    });

    it('recursively validates nested remote extends', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://example.com/a.yaml"\n`);
      vi.mocked(fetch).mockImplementation(async (input: any) => {
        const href = String(input);
        if (href === 'https://example.com/a.yaml') {
          return rulesetResponse(`extends:\n  - "./b.yaml"\nrules:${VALID_RULE}`);
        }
        if (href === 'https://example.com/b.yaml') {
          return rulesetResponse(`rules:${VALID_RULE}`);
        }
        throw new Error(`Unexpected fetch call: ${href}`);
      });

      const result = await bundleSpectralRuleset('/fake/ruleset.yaml');
      // The top-level remote URL is preserved; nested remote extends are validated but not merged.
      expect(result).toContain('https://example.com/a.yaml');
    });

    it('rejects a non-https remote extends without fetching', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "http://example.com/remote.yaml"\n`);

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('must use https');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a remote extends pointing at a loopback host without fetching', async () => {
      const urls = [
        'https://localhost/remote.yaml',
        'https://foo.localhost/remote.yaml',
        'https://127.0.0.1/remote.yaml',
        'https://[::1]/remote.yaml',
      ];
      for (const url of urls) {
        mockReadFile.mockResolvedValueOnce(`extends:\n  - "${url}"\n`);
        await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('disallowed host');
        expect(fetch).not.toHaveBeenCalled();
      }
    });

    it('rejects a remote extends pointing at a private IP range without fetching', async () => {
      const urls = [
        'https://10.0.0.1/remote.yaml',
        'https://192.168.1.1/remote.yaml',
        'https://172.16.0.1/remote.yaml',
      ];
      for (const url of urls) {
        mockReadFile.mockResolvedValueOnce(`extends:\n  - "${url}"\n`);
        await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('disallowed host');
        expect(fetch).not.toHaveBeenCalled();
      }
    });

    it('rejects an extends entry that is not a valid identifier, path, or URL', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "not-a-real-thing"\n`);

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow(
        /not a valid spectral identifier|valid URL/i,
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects a remote host that resolves to a loopback address without fetching', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://app.localtest.me/remote.yaml"\n`);
      mockResolvedAddresses(['127.0.0.1']);

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('private or loopback address');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('throws when a remote ruleset cannot be fetched', async () => {
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://example.com/missing.yaml"\n`);
      vi.mocked(fetch).mockResolvedValue(rulesetResponse('', { ok: false, status: 404, statusText: 'Not Found' }));

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('Failed to fetch remote');
    });

    it('rejects a nested http:// extends inside a remote ruleset (recursive SSRF check)', async () => {
      // Local ruleset extends a valid https remote...
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://example.com/base.yaml"\n`);
      // ...but that remote itself extends an http:// localhost URL.
      vi.mocked(fetch).mockResolvedValueOnce(rulesetResponse(`extends:\n  - "http://localhost:8000/exec.yaml"\n`));

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('must use https');
    });

    it('rejects a functions: key inside a nested remote ruleset', async () => {
      // Local ruleset extends a valid https remote...
      mockReadFile.mockResolvedValueOnce(`extends:\n  - "https://example.com/base.yaml"\n`);
      // ...but that remote contains a functions: key (the RCE vector).
      vi.mocked(fetch).mockResolvedValueOnce(
        rulesetResponse(
          `functions:\n  - exec\nrules:\n  env-check:\n    given: "$"\n    then:\n      function: exec\n`,
        ),
      );

      await expect(bundleSpectralRuleset('/fake/ruleset.yaml')).rejects.toThrow('failed validation');
    });
  });
});

describe('compileSpectralRulesetFromContent', () => {
  it('fully inlines remote ruleset content and drops the URL', async () => {
    const content = `
extends:
  - "https://example.com/remote.yaml"
rules:
  local-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`;
    vi.mocked(fetch).mockResolvedValue(rulesetResponse(`rules:${VALID_RULE}`));

    const result = await compileSpectralRulesetFromContent(content);
    expect(result).toContain('local-rule');
    expect(result).toContain('remote-rule');
    expect(result).not.toContain('https://example.com/remote.yaml');
  });

  it('recursively inlines nested remote extends', async () => {
    vi.mocked(fetch).mockImplementation(async (input: any) => {
      const href = String(input);
      if (href === 'https://example.com/a.yaml') {
        return rulesetResponse(`extends:\n  - "./b.yaml"\nrules:${VALID_RULE}`);
      }
      if (href === 'https://example.com/b.yaml') {
        return rulesetResponse(
          `rules:\n  nested-rule:\n    given: "$.servers"\n    severity: warn\n    then:\n      function: truthy\n`,
        );
      }
      throw new Error(`Unexpected fetch call: ${href}`);
    });

    const result = await compileSpectralRulesetFromContent(`extends:\n  - "https://example.com/a.yaml"\n`);
    expect(result).toContain('remote-rule');
    expect(result).toContain('nested-rule');
    expect(result).not.toContain('https://example.com');
  });

  it('preserves built-in identifiers surfaced by a remote ruleset', async () => {
    vi.mocked(fetch).mockResolvedValue(rulesetResponse(`extends:\n  - spectral:oas\nrules:${VALID_RULE}`));

    const result = await compileSpectralRulesetFromContent(`extends:\n  - "https://example.com/remote.yaml"\n`);
    expect(result).toContain('spectral:oas');
    expect(result).toContain('remote-rule');
    expect(result).not.toContain('https://example.com/remote.yaml');
  });

  it('rejects a remote ruleset that declares custom functions (RCE vector)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      rulesetResponse(`functions:\n  - exec\nrules:\n  env-check:\n    given: "$"\n    then:\n      function: exec\n`),
    );

    await expect(compileSpectralRulesetFromContent(`extends:\n  - "https://example.com/exec.yaml"\n`)).rejects.toThrow(
      'failed validation',
    );
  });

  it('rejects a non-https remote extends without fetching', async () => {
    await expect(compileSpectralRulesetFromContent(`extends:\n  - "http://example.com/remote.yaml"\n`)).rejects.toThrow(
      'must use https',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a remote extends pointing at a loopback host without fetching', async () => {
    await expect(compileSpectralRulesetFromContent(`extends:\n  - "https://127.0.0.1/remote.yaml"\n`)).rejects.toThrow(
      'disallowed host',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects content that is not an object at the top level', async () => {
    await expect(compileSpectralRulesetFromContent(`- item1\n- item2\n`)).rejects.toThrow(
      'must be an object at the top level',
    );
  });
});
