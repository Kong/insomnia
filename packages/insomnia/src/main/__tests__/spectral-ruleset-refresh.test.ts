import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Temp-file ops used while compiling are no-ops in tests.
vi.mock('node:fs', () => ({
  default: {
    promises: {
      mkdtemp: vi.fn(async () => '/tmp/spectral-refresh-test'),
      writeFile: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined),
    },
  },
}));

const send = vi.fn();
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/userData') },
  BrowserWindow: {
    getAllWindows: () => [{ webContents: { send } }],
  },
}));

vi.mock('~/common/bundle-spectral-ruleset', () => ({
  compileSpectralRuleset: vi.fn(),
}));

vi.mock('~/insomnia-data', () => ({
  services: {
    projectLintRuleset: {
      all: vi.fn(),
    },
  },
}));

import { compileSpectralRuleset } from '~/common/bundle-spectral-ruleset';
import { services } from '~/insomnia-data';

import { refreshOnce, stop } from '../spectral-ruleset-refresh';

const mockAll = vi.mocked(services.projectLintRuleset.all);
const mockCompile = vi.mocked(compileSpectralRuleset);

const REMOTE_SOURCE = 'extends:\n  - "https://example.com/remote.yaml"\n';
const LOCAL_SOURCE = 'rules:\n  r:\n    given: "$"\n    then:\n      function: truthy\n';

beforeEach(() => {
  send.mockReset();
  mockAll.mockReset();
  mockCompile.mockReset();
});

afterEach(() => {
  // Clears the in-memory baseline hash map between tests.
  stop();
});

describe('spectral-ruleset-refresh', () => {
  it('does not notify when the compiled output is unchanged', async () => {
    mockAll.mockResolvedValue([{ parentId: 'proj1', rulesetContent: REMOTE_SOURCE }] as any);
    mockCompile.mockResolvedValue('rules: {}');

    await refreshOnce(); // baseline
    await refreshOnce(); // unchanged

    expect(send).not.toHaveBeenCalled();
  });

  it('notifies the renderer when the compiled output changes', async () => {
    mockAll.mockResolvedValue([{ parentId: 'proj1', rulesetContent: REMOTE_SOURCE }] as any);
    mockCompile.mockResolvedValueOnce('rules: {a: 1}'); // baseline
    mockCompile.mockResolvedValueOnce('rules: {a: 2}'); // changed upstream

    await refreshOnce();
    await refreshOnce();

    expect(send).toHaveBeenCalledWith('spectral-ruleset.updated', { projectId: 'proj1' });
  });

  it('skips sources without remote extends', async () => {
    mockAll.mockResolvedValue([{ parentId: 'proj1', rulesetContent: LOCAL_SOURCE }] as any);

    await refreshOnce();

    expect(mockCompile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the last baseline and does not throw when compile fails', async () => {
    mockAll.mockResolvedValue([{ parentId: 'proj1', rulesetContent: REMOTE_SOURCE }] as any);
    mockCompile.mockRejectedValue(new Error('fetch failed'));

    await expect(refreshOnce()).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
