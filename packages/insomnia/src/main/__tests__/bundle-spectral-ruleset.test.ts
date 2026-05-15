import path from 'node:path';

import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

// Mock fs so no real files are needed.
vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
    },
  },
}));

import fs from 'node:fs';

import { bundleSpectralRuleset } from '../bundle-spectral-ruleset';

const mockReadFile = vi.mocked(fs.promises.readFile) as MockedFunction<(path: string) => Promise<string>>;

// Returns the absolute path that bundleSpectralRuleset will resolve for a given fake path.
function abs(fakePath: string) {
  return path.resolve(fakePath);
}

beforeEach(() => {
  mockReadFile.mockReset();
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

  it('passes through remote URL extends unchanged', async () => {
    mockReadFile.mockResolvedValueOnce(
      `
extends:
  - "https://example.com/ruleset.yaml"
rules:
  my-rule:
    given: "$.info"
    severity: warn
    then:
      function: truthy
`,
    );

    const result = await bundleSpectralRuleset('/fake/ruleset.yaml');
    expect(result).toContain('https://example.com/ruleset.yaml');
    expect(result).toContain('my-rule');
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

    mockReadFile.mockImplementation(async (filePath) => {
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

    mockReadFile.mockImplementation(async (filePath) => {
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

    mockReadFile.mockImplementation(async (filePath) => {
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

    mockReadFile.mockImplementation(async (filePath) => {
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

  it('deduplicates remote extends from multiple child files', async () => {
    const parentPath = '/fake/parent.yaml';
    const childAPath = '/fake/childA.yaml';
    const childBPath = '/fake/childB.yaml';

    mockReadFile.mockImplementation(async (filePath) => {
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
});
