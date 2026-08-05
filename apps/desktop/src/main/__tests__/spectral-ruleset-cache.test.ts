import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    promises: {
      access: vi.fn(async () => {}),
      mkdir: vi.fn(async () => {}),
      rm: vi.fn(async () => {}),
      writeFile: vi.fn(async () => {}),
    },
  },
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/fake/userData') },
}));

vi.mock('~/main/bundle-spectral-ruleset', () => ({
  compileSpectralRulesetFromContent: vi.fn(),
}));

import fs from 'node:fs';

import { compileSpectralRulesetFromContent } from '~/main/bundle-spectral-ruleset';

import { compiledRulesetPathFor, deleteCompiledRuleset, writeCompiledRuleset } from '../spectral-ruleset-cache';

const mockAccess = vi.mocked(fs.promises.access);
const mockMkdir = vi.mocked(fs.promises.mkdir);
const mockRm = vi.mocked(fs.promises.rm);
const mockWriteFile = vi.mocked(fs.promises.writeFile);
const mockCompile = vi.mocked(compileSpectralRulesetFromContent);

// Ensure INSOMNIA_DATA_PATH doesn't interfere with userData path assertions.
const ORIG_DATA_PATH = process.env['INSOMNIA_DATA_PATH'];
beforeEach(() => {
  delete process.env['INSOMNIA_DATA_PATH'];
});
afterEach(() => {
  if (ORIG_DATA_PATH !== undefined) {
    process.env['INSOMNIA_DATA_PATH'] = ORIG_DATA_PATH;
  }
});

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

  it('uses INSOMNIA_DATA_PATH when set', () => {
    process.env['INSOMNIA_DATA_PATH'] = '/custom/data';
    const result = compiledRulesetPathFor('proj_env');
    expect(result).toBe(path.join('/custom/data', 'projects', 'proj_env', '.spectral.yaml'));
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

    expect(mockMkdir).toHaveBeenCalledWith(path.dirname(compiledRulesetPathFor('proj_mkdir')), { recursive: true });
  });

  it('propagates errors thrown by compileSpectralRulesetFromContent', async () => {
    mockCompile.mockRejectedValueOnce(new Error('compile failed'));

    await expect(writeCompiledRuleset('proj_error', 'bad content')).rejects.toThrow('compile failed');
  });

  it('skips recompilation when called again with the same content and file exists', async () => {
    const content = 'extends:\n  - spectral:oas\n';
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_skip', content);
    mockWriteFile.mockClear();
    mockCompile.mockClear();

    await writeCompiledRuleset('proj_skip', content);

    expect(mockCompile).not.toHaveBeenCalled();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('recompiles when content is unchanged but file was deleted externally', async () => {
    const content = 'extends:\n  - spectral:oas\n';
    mockCompile.mockResolvedValueOnce('rules: {}');

    // First write — hash miss, access is never called, file is compiled and written.
    await writeCompiledRuleset('proj_deleted', content);
    mockWriteFile.mockClear();
    mockCompile.mockClear();

    // Simulate external deletion — access throws ENOENT on the cache-hit path.
    mockAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_deleted', content);

    expect(mockCompile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
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

describe('deleteCompiledRuleset', () => {
  it('removes the project directory', async () => {
    await deleteCompiledRuleset('proj_del');

    expect(mockRm).toHaveBeenCalledWith(path.dirname(compiledRulesetPathFor('proj_del')), {
      recursive: true,
      force: true,
    });
  });

  it('clears the hash cache so next write always recompiles', async () => {
    const content = 'extends:\n  - spectral:oas\n';
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_del_cache', content);

    await deleteCompiledRuleset('proj_del_cache');

    mockCompile.mockClear();
    mockWriteFile.mockClear();
    mockCompile.mockResolvedValueOnce('rules: {}');

    await writeCompiledRuleset('proj_del_cache', content);

    expect(mockCompile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
