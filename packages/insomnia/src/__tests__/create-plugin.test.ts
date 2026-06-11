import { mkdir, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => '/mock/user/data'),
    },
  },
}));

import { createPlugin } from '../main/create-plugin';

describe('createPlugin', () => {
  let originalDataPath: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalDataPath = process.env['INSOMNIA_DATA_PATH'];
    process.env['INSOMNIA_DATA_PATH'] = '/mock/user/data';
  });

  afterEach(() => {
    if (originalDataPath === undefined) {
      delete process.env['INSOMNIA_DATA_PATH'];
    } else {
      process.env['INSOMNIA_DATA_PATH'] = originalDataPath;
    }
  });

  it('creates the plugin directory and starter files', async () => {
    await createPlugin('insomnia-plugin-demo', '// starter');

    expect(mkdir).toHaveBeenCalledWith('/mock/user/data/plugins/insomnia-plugin-demo', { recursive: true });
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      '/mock/user/data/plugins/insomnia-plugin-demo/package.json',
      expect.stringContaining('"name": "insomnia-plugin-demo"'),
      { flag: 'wx' },
    );
    expect(writeFile).toHaveBeenNthCalledWith(2, '/mock/user/data/plugins/insomnia-plugin-demo/main.js', '// starter', {
      flag: 'wx',
    });
  });

  it('normalizes filesystem failures to the existing user-facing error', async () => {
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('disk full'));

    await expect(createPlugin('insomnia-plugin-demo', '// starter')).rejects.toThrow(
      'Plugin creation failed. Please try again.',
    );
  });
});
