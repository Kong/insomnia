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
  compileSpectralRulesetFromContent: vi.fn(),
}));

import fs from 'node:fs';

import { compileSpectralRulesetFromContent } from '~/common/bundle-spectral-ruleset';

import { compiledRulesetPathFor, writeCompiledRuleset } from '../spectral-ruleset-cache';

const mockMkdir = vi.mocked(fs.promises.mkdir) as ReturnType<typeof vi.fn>;
const mockWriteFile = vi.mocked(fs.promises.writeFile) as ReturnType<typeof vi.fn>;
const mockCompile = vi.mocked(compileSpectralRulesetFromContent);

describe('compiledRulesetPathFor', () => {
  it('returns a path inside userData/projects/{projectId}', () => {
    const result = compiledRulesetPathFor('proj_123');
    expect(result).toBe(path.join('/fake/userData', 'projects', 'proj_123', '.spectral.yaml'));
  });

  it('produces different paths for different project IDs', () => {
    const a = compiledRulesetPathFor('proj_aaa');
    const b = compiledRulesetPathFor('proj_bbb');
    expect(a).not.toBe(b);
  });
});

describe('writeCompiledRuleset', () => {
  it('writes the compiled content to the project path', async () => {
    const compiled = 'rules:\n  r:\n    given: "$"\n    then:\n      function: truthy\n';
    mockCompile.mockResolvedValueOnce(compiled);

    const { compiledPath } = await writeCompiledRuleset('proj_write', 'extends:\n  - spectral:oas\n');

    expect(compiledPath).toBe(compiledRulesetPathFor('proj_write'));
    expect(mockWriteFile).toHaveBeenCalledWith(compiledPath, compiled, 'utf8');
  });

  it('creates the project directory before writing', async () => {
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_mkdir', 'extends:\n  - spectral:oas\n');

    expect(mockMkdir).toHaveBeenCalledWith(
      path.dirname(compiledRulesetPathFor('proj_mkdir')),
      { recursive: true },
    );
  });

  it('propagates errors thrown by compileSpectralRulesetFromContent', async () => {
    mockCompile.mockRejectedValueOnce(new Error('compile failed'));

    await expect(writeCompiledRuleset('proj_error', 'bad content')).rejects.toThrow('compile failed');
  });

  it('skips recompilation when called again with the same content', async () => {
    const content = 'extends:\n  - spectral:oas\n';
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_skip', content);
    mockWriteFile.mockClear();
    mockCompile.mockClear();

    await writeCompiledRuleset('proj_skip', content);

    expect(mockCompile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('recompiles when content changes', async () => {
    mockCompile.mockResolvedValueOnce('rules: {}');
    await writeCompiledRuleset('proj_change', 'extends:\n  - spectral:oas\n');

    mockCompile.mockClear();
    mockWriteFile.mockClear();
    mockCompile.mockResolvedValueOnce('rules: {updated: true}');
    await writeCompiledRuleset('proj_change', 'extends:\n  - spectral:oas\nrules: {}\n');

    expect(mockCompile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
