import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';

import { shellPath } from 'shell-path';

/**
 * Locates the system `git` used by System Git Credentials (`git credential`,
 * `git config`) and the environment to run it with.
 *
 * Apps launched from the macOS Dock/Finder inherit launchd's minimal PATH
 * (/usr/bin:/bin:/usr/sbin:/sbin), so `git` resolves to the Xcode Command Line
 * Tools shim instead of the git the user runs in their terminal, and credential
 * helpers referenced by name (e.g. `credential.helper = oauth`,
 * `!aws codecommit credential-helper $@`) cannot be found. Like the MCP stdio
 * transport, we take PATH from the user's login shell.
 */

export type GitUnavailableReason = 'git-not-found' | 'xcode-clt-missing';

export type GitRuntime =
  | { available: true; command: string; env: NodeJS.ProcessEnv; version: string }
  | { available: false; reason: GitUnavailableReason };

const SHELL_PATH_TIMEOUT_MS = 5000;
const PROBE_TIMEOUT_MS = 10_000;
/** The macOS stub that prompts to install the Xcode Command Line Tools when they are missing. */
const MACOS_GIT_SHIM = '/usr/bin/git';

const mergePaths = (...paths: (string | undefined)[]) => {
  const entries = paths.flatMap(value => (value ? value.split(path.delimiter) : [])).filter(Boolean);
  return [...new Set(entries)].join(path.delimiter);
};

const resolveShellPath = async (): Promise<string | undefined> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    const shellPathValue = await Promise.race([
      shellPath(),
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          console.warn('[git-runtime] Timed out reading PATH from the login shell');
          resolve();
        }, SHELL_PATH_TIMEOUT_MS);
      }),
    ]);
    return shellPathValue || undefined;
  } catch (error) {
    console.warn('[git-runtime] Failed to read PATH from the login shell', error);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

const resolveEnv = async (): Promise<NodeJS.ProcessEnv> => {
  if (process.platform === 'win32') {
    // GUI apps on Windows already inherit the user's PATH.
    return process.env;
  }
  // Login shell entries first, so git resolves the same way it does in the user's terminal.
  return { ...process.env, PATH: mergePaths(await resolveShellPath(), process.env.PATH) };
};

const findExecutable = async (name: string, pathEnv = ''): Promise<string | null> => {
  for (const dir of pathEnv.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not in this directory.
    }
  }
  return null;
};

/** Run a short command, resolving with its exit code (null if it failed to start or timed out) and stdout. */
const probe = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  new Promise<{ code: number | null; stdout: string }>(resolve => {
    const output: string[] = [];
    const proc = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ code: null, stdout: '' });
    }, PROBE_TIMEOUT_MS);
    proc.stdout?.on('data', (data: Buffer) => output.push(data.toString()));
    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ code: null, stdout: '' });
    });
    proc.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout: output.join('').trim() });
    });
  });

const detectGitRuntime = async (): Promise<GitRuntime> => {
  const env = await resolveEnv();

  let command = 'git';
  if (process.platform !== 'win32') {
    const found = await findExecutable('git', env.PATH);
    if (!found) {
      return { available: false, reason: 'git-not-found' };
    }
    command = found;

    // Running the shim without the Command Line Tools pops up an install dialog,
    // so check for them first instead of running it.
    if (process.platform === 'darwin' && command === MACOS_GIT_SHIM) {
      const { code } = await probe('/usr/bin/xcode-select', ['-p'], env);
      if (code !== 0) {
        return { available: false, reason: 'xcode-clt-missing' };
      }
    }
  }

  const { code, stdout } = await probe(command, ['--version'], env);
  if (code !== 0) {
    return { available: false, reason: 'git-not-found' };
  }

  return { available: true, command, env, version: stdout };
};

let cachedRuntime: Promise<GitRuntime> | null = null;

/**
 * Resolve the system git. A found git is cached for the app's lifetime; when git
 * is missing the lookup is repeated next time, so installing git takes effect
 * without restarting Insomnia.
 */
export const getGitRuntime = (): Promise<GitRuntime> => {
  if (!cachedRuntime) {
    cachedRuntime = detectGitRuntime().then(runtime => {
      if (runtime.available) {
        console.log(`[git-runtime] Using ${runtime.command} (${runtime.version})`);
      } else {
        console.warn(`[git-runtime] System git is unavailable: ${runtime.reason}`);
        cachedRuntime = null;
      }
      return runtime;
    });
  }
  return cachedRuntime;
};

/** Test helper: forget the cached runtime. */
export const resetGitRuntimeForTests = () => {
  cachedRuntime = null;
};
