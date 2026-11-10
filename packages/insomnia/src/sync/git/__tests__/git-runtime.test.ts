import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGitRuntime, resetGitRuntimeForTests } from '../git-runtime';

const { spawnMock, accessMock, shellPathMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  accessMock: vi.fn(),
  shellPathMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));
vi.mock('node:fs/promises', () => ({ access: accessMock, constants: { X_OK: 1 } }));
vi.mock('shell-path', () => ({ shellPath: shellPathMock }));

const originalPlatform = process.platform;
const originalPath = process.env.PATH;

/** Executables that exist, by absolute path. */
let executables: Set<string>;
/** Exit codes by command; anything not listed exits 0. */
let exitCodes: Record<string, number>;

const setPlatform = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', { value: platform });
};

beforeEach(() => {
  resetGitRuntimeForTests();
  setPlatform('darwin');
  process.env.PATH = '/usr/bin:/bin';
  executables = new Set();
  exitCodes = {};

  shellPathMock.mockReset();
  shellPathMock.mockResolvedValue('/opt/homebrew/bin:/usr/bin:/bin');
  accessMock.mockReset();
  accessMock.mockImplementation(async (file: string) => {
    if (!executables.has(file)) {
      throw new Error('ENOENT');
    }
  });
  spawnMock.mockReset();
  spawnMock.mockImplementation((command: string) => {
    const listeners: Record<string, (value: any) => void> = {};
    setImmediate(() => {
      if (command.endsWith('git')) {
        listeners['stdout:data']?.(Buffer.from('git version 2.55.0\n'));
      }
      listeners.close?.(exitCodes[command] ?? 0);
    });
    return {
      on: (event: string, listener: (value: any) => void) => {
        listeners[event] = listener;
      },
      stdout: {
        on: (event: string, listener: (value: any) => void) => {
          listeners[`stdout:${event}`] = listener;
        },
      },
      kill: vi.fn(),
    };
  });
});

afterEach(() => {
  setPlatform(originalPlatform);
  process.env.PATH = originalPath;
});

const spawnedCommands = () => spawnMock.mock.calls.map(([command, args]) => [command, ...args].join(' '));

describe('getGitRuntime', () => {
  it('prefers git from the login shell PATH over the launchd default', async () => {
    executables.add('/opt/homebrew/bin/git');
    executables.add('/usr/bin/git');

    const runtime = await getGitRuntime();

    expect(runtime).toEqual({
      available: true,
      command: '/opt/homebrew/bin/git',
      env: expect.objectContaining({ PATH: '/opt/homebrew/bin:/usr/bin:/bin' }),
      version: 'git version 2.55.0',
    });
    expect(spawnedCommands()).toEqual(['/opt/homebrew/bin/git --version']);
  });

  it('keeps PATH entries missing from the login shell', async () => {
    process.env.PATH = '/usr/bin:/custom/bin';
    executables.add('/opt/homebrew/bin/git');

    const runtime = await getGitRuntime();

    expect(runtime.available && runtime.env.PATH).toBe('/opt/homebrew/bin:/usr/bin:/bin:/custom/bin');
  });

  it('falls back to the inherited PATH when the login shell fails', async () => {
    shellPathMock.mockRejectedValue(new Error('shell exploded'));
    executables.add('/usr/bin/git');

    const runtime = await getGitRuntime();

    expect(runtime).toMatchObject({ available: true, command: '/usr/bin/git', env: { PATH: '/usr/bin:/bin' } });
  });

  it('does not run the macOS git shim when the Command Line Tools are missing', async () => {
    shellPathMock.mockResolvedValue('/usr/bin:/bin');
    executables.add('/usr/bin/git');
    exitCodes['/usr/bin/xcode-select'] = 2;

    expect(await getGitRuntime()).toEqual({ available: false, reason: 'xcode-clt-missing' });
    expect(spawnedCommands()).toEqual(['/usr/bin/xcode-select -p']);
  });

  it('uses the macOS git shim when the Command Line Tools are installed', async () => {
    shellPathMock.mockResolvedValue('/usr/bin:/bin');
    executables.add('/usr/bin/git');

    expect(await getGitRuntime()).toMatchObject({ available: true, command: '/usr/bin/git' });
    expect(spawnedCommands()).toEqual(['/usr/bin/xcode-select -p', '/usr/bin/git --version']);
  });

  it('reports git-not-found and looks again on the next call', async () => {
    expect(await getGitRuntime()).toEqual({ available: false, reason: 'git-not-found' });

    executables.add('/opt/homebrew/bin/git');
    expect(await getGitRuntime()).toMatchObject({ available: true, command: '/opt/homebrew/bin/git' });
  });

  it('reports git-not-found when git --version fails', async () => {
    executables.add('/opt/homebrew/bin/git');
    exitCodes['/opt/homebrew/bin/git'] = 1;

    expect(await getGitRuntime()).toEqual({ available: false, reason: 'git-not-found' });
  });

  it('caches a found git', async () => {
    executables.add('/opt/homebrew/bin/git');

    await getGitRuntime();
    await getGitRuntime();

    expect(shellPathMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it('runs git from the inherited PATH on Windows without reading a login shell', async () => {
    setPlatform('win32');

    expect(await getGitRuntime()).toMatchObject({ available: true, command: 'git', env: process.env });
    expect(shellPathMock).not.toHaveBeenCalled();
  });
});
