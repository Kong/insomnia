import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdir: vi.fn(async () => {}),
      writeFile: vi.fn(async () => {}),
    },
  },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/userData') },
}));

vi.mock('~/common/bundle-spectral-ruleset', () => ({
  compileSpectralRuleset: vi.fn(),
}));

import fs from 'node:fs';

import { compileSpectralRuleset } from '~/common/bundle-spectral-ruleset';

import { compiledRulesetPathFor, contentHash, writeCompiledRuleset } from '../spectral-ruleset-cache';

const mockMkdir = vi.mocked(fs.promises.mkdir) as ReturnType<typeof vi.fn>;
const mockWriteFile = vi.mocked(fs.promises.writeFile) as ReturnType<typeof vi.fn>;
const mockCompile = vi.mocked(compileSpectralRuleset);

describe('contentHash', () => {
  it('returns a hex string', () => {
    const hash = contentHash('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for the same input', () => {
    expect(contentHash('same')).toBe(contentHash('same'));
  });

  it('returns different hashes for different inputs', () => {
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });
});

describe('compiledRulesetPathFor', () => {
  it('returns a path inside userData/lint-cache', () => {
    const result = compiledRulesetPathFor('/some/ruleset.yaml');
    expect(result).toContain('/fake/userData');
    expect(result).toContain('lint-cache');
  });

  it('ends with .spectral.yaml', () => {
    const result = compiledRulesetPathFor('/some/ruleset.yaml');
    expect(result).toMatch(/\.spectral\.yaml$/);
  });

  it('produces different paths for different source paths', () => {
    const a = compiledRulesetPathFor('/project-a/ruleset.yaml');
    const b = compiledRulesetPathFor('/project-b/ruleset.yaml');
    expect(a).not.toBe(b);
  });

  it('produces the same path for the same source path regardless of relative vs absolute', () => {
    const absolute = compiledRulesetPathFor(path.resolve('/some/ruleset.yaml'));
    const result = compiledRulesetPathFor('/some/ruleset.yaml');
    expect(result).toBe(absolute);
  });
});

describe('writeCompiledRuleset', () => {
  it('returns the compiled path, content, and a matching hash', async () => {
    const compiled = 'rules:\n  r:\n    given: "$"\n    then:\n      function: truthy\n';
    mockCompile.mockResolvedValueOnce(compiled);

    const { compiledPath, content, hash } = await writeCompiledRuleset('/fake/ruleset.yaml');

    expect(content).toBe(compiled);
    expect(hash).toBe(contentHash(compiled));
    expect(compiledPath).toBe(compiledRulesetPathFor('/fake/ruleset.yaml'));
  });

  it('creates the cache directory before writing', async () => {
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('/fake/ruleset.yaml');

    expect(mockMkdir).toHaveBeenCalledWith(path.dirname(compiledRulesetPathFor('/fake/ruleset.yaml')), {
      recursive: true,
    });
  });

  it('writes the compiled content to the cache path', async () => {
    const compiled = 'rules: {}';
    mockCompile.mockResolvedValueOnce(compiled);

    await writeCompiledRuleset('/fake/ruleset.yaml');

    expect(mockWriteFile).toHaveBeenCalledWith(compiledRulesetPathFor('/fake/ruleset.yaml'), compiled, 'utf8');
  });

  it('propagates errors thrown by compileSpectralRuleset', async () => {
    mockCompile.mockRejectedValueOnce(new Error('compile failed'));

    await expect(writeCompiledRuleset('/fake/bad.yaml')).rejects.toThrow('compile failed');
  });
});
