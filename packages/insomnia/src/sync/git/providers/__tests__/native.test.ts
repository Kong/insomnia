import type * as NodeFs from 'node:fs';

import type { GitCredentials } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import {
  cancelNativeSignIn,
  FILL_TIMEOUT_MS,
  type NativeCredentialError,
  NativeProvider,
  type NativeSignInStatus,
  onNativeCredentialError,
  onNativeSignInStatus,
  SIGN_IN_NOTICE_DELAY_MS,
} from '../native';

const { spawnMock, missingPaths } = vi.hoisted(() => ({ spawnMock: vi.fn(), missingPaths: new Set<string>() }));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));
vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof NodeFs>()),
  existsSync: (path: string) => !missingPaths.has(path),
}));


type Action = 'fill' | 'approve' | 'reject';

interface SpawnCall {
  action: Action;
  stdin: string;
  cwd?: string;
}

interface Response {
  code?: number;
  stdout?: string;
  stderr?: string;
  /** Fail to start. Defaults to ENOENT, like git missing from PATH. */
  spawnError?: boolean | { code: string; message: string };
  /** Never exit on its own, like a helper waiting for the user to sign in. */
  hang?: boolean;
}

const URL = 'https://dev.azure.com/org/project/_git/repo';
const QUERY = 'protocol=https\nhost=dev.azure.com\npath=org/project/_git/repo\n\n';
const credential = { provider: 'native' } as unknown as GitCredentials;

let calls: SpawnCall[];
let fillResponses: Response[];
let nextPid = 1000;
/** Make the next spawn throw synchronously, like spawn does for some invalid arguments on Windows. */
let throwOnSpawn = false;
/** Finishers for fills started with `hang: true`, in spawn order. */
let hangingFills: ((stdout: string) => void)[];
let credentialErrors: NativeCredentialError[];
let unsubscribeCredentialErrors: () => void;
/** Each test gets its own wall-clock time so credential error de-duplication does not leak between tests. */
let clock = Date.now();
let dateNowSpy: MockInstance<typeof Date.now>;

const fillOutput = (username: string, password: string, extra = '') =>
  `protocol=https\nhost=dev.azure.com\npath=org/project/_git/repo\nusername=${username}\npassword=${password}\n${extra}`;

beforeEach(() => {
  calls = [];
  fillResponses = [];
  hangingFills = [];
  missingPaths.clear();
  credentialErrors = [];
  unsubscribeCredentialErrors = onNativeCredentialError(error => credentialErrors.push(error));
  clock += 60_000;
  dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(clock);
  spawnMock.mockReset();
  spawnMock.mockImplementation((cmd: string, args: string[], options: { cwd?: string }) => {
    // Stopping a credential process on Windows spawns `taskkill`; it is not a credential action.
    if (cmd !== 'git') {
      return { on: vi.fn() };
    }
    if (throwOnSpawn) {
      throwOnSpawn = false;
      throw new Error('spawn EINVAL');
    }
    const action = args[1] as Action;
    const call: SpawnCall = { action, stdin: '', cwd: options.cwd };
    calls.push(call);

    const response: Response = action === 'fill' ? (fillResponses.shift() ?? { code: 0, stdout: '' }) : { code: 0 };

    // Minimal stand-in for the ChildProcess surface NativeProvider uses.
    const listeners: Record<string, (value: any) => void> = {};
    return {
      pid: nextPid++,
      on: (event: string, listener: (value: any) => void) => {
        listeners[event] = listener;
      },
      stdout: {
        on: (event: string, listener: (value: any) => void) => {
          listeners[`stdout:${event}`] = listener;
        },
      },
      stderr: {
        on: (event: string, listener: (value: any) => void) => {
          listeners[`stderr:${event}`] = listener;
        },
      },
      stdin: {
        on: vi.fn(),
        write: (data: string) => {
          call.stdin += data;
        },
        end: () => {
          if (response.hang) {
            hangingFills.push(stdout => {
              listeners['stdout:data']?.(Buffer.from(stdout));
              listeners.close?.(0);
            });
            return;
          }
          setImmediate(() => {
            if (response.spawnError) {
              const { code, message } =
                response.spawnError === true
                  ? { code: 'ENOENT', message: 'spawn git ENOENT' }
                  : (response.spawnError as { code: string; message: string });
              listeners.error?.(Object.assign(new Error(message), { code }));
              return;
            }
            if (response.stdout) {
              listeners['stdout:data']?.(Buffer.from(response.stdout));
            }
            if (response.stderr) {
              listeners['stderr:data']?.(Buffer.from(response.stderr));
            }
            listeners.close?.(response.code ?? 0);
          });
        },
      },
    };
  });
});

afterEach(() => {
  unsubscribeCredentialErrors();
  dateNowSpy.mockRestore();
});

describe('NativeProvider', () => {
  describe('authCallback', () => {
    it('queries git credential fill with protocol, host and path', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'token') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL, '/repo');

      expect(auth).toEqual({ username: 'user', password: 'token' });
      expect(calls).toEqual([{ action: 'fill', stdin: QUERY, cwd: '/repo' }]);
    });

    it('runs git with terminal prompts disabled', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'token') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      await provider.authCallback(credential, URL);

      expect(spawnMock).toHaveBeenCalledWith(
        'git',
        ['credential', 'fill'],
        expect.objectContaining({ env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
      );
    });

    it('cancels and reports missing credentials, with the helper output, when fill fails', async () => {
      fillResponses.push({
        code: 128,
        stderr:
          "helper: no credentials for dev.azure.com\nfatal: could not read Username for 'https://dev.azure.com': terminal prompts disabled\n",
      });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, URL)).toEqual({ cancel: true });
      expect(credentialErrors).toEqual([
        {
          host: 'dev.azure.com',
          reason: 'no-credentials',
          detail: 'helper: no credentials for dev.azure.com',
        },
      ]);
    });

    it('runs without cwd when the repository directory does not exist', async () => {
      missingPaths.add('/gone');
      fillResponses.push({ stdout: fillOutput('user', 'token') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, URL, '/gone')).toEqual({ username: 'user', password: 'token' });
      expect(calls[0].cwd).toBeUndefined();
      expect(credentialErrors).toEqual([]);
    });

    it('cancels and reports when git cannot be started', async () => {
      fillResponses.push({ spawnError: true });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, URL)).toEqual({ cancel: true });
      expect(credentialErrors).toEqual([{ host: 'dev.azure.com', reason: 'git-not-found', detail: undefined }]);
    });

    it('does not claim git is missing when it exists but cannot be started', async () => {
      fillResponses.push({ spawnError: { code: 'EACCES', message: 'spawn git EACCES' } });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, URL)).toEqual({ cancel: true });
      expect(credentialErrors).toEqual([
        { host: 'dev.azure.com', reason: 'git-failed-to-start', detail: 'spawn git EACCES' },
      ]);
    });

    it('reports a failure shared by concurrent requests once', async () => {
      fillResponses.push({ code: 1 });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      await Promise.all([provider.authCallback(credential, URL), provider.authCallback(credential, URL)]);

      expect(calls.map(call => call.action)).toEqual(['fill']);
      expect(credentialErrors).toHaveLength(1);
    });

    it('returns empty credentials without spawning git for invalid URLs', async () => {
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, 'not a url')).toEqual({ username: '', password: '' });
      expect(await provider.authCallback(credential)).toEqual({ username: '', password: '' });
      expect(calls).toEqual([]);
    });
  });

  describe('authSuccessCallback', () => {
    it('approves the full fill output, including helper-specific attributes', async () => {
      const filled = fillOutput('user', 'token', 'password_expiry_utc=1700000000\noauth_refresh_token=refresh\n');
      fillResponses.push({ stdout: filled });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL, '/repo');
      await provider.authSuccessCallback(credential, URL, auth, '/repo');

      expect(calls[1]).toEqual({ action: 'approve', stdin: `${filled}\n`, cwd: '/repo' });
    });

    it('approves only once per fill', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'token') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      await provider.authSuccessCallback(credential, URL, auth);
      await provider.authSuccessCallback(credential, URL, auth);

      expect(calls.map(call => call.action)).toEqual(['fill', 'approve']);
    });

    it('does not approve credentials that did not come from fill', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'token') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      await provider.authCallback(credential, URL);
      await provider.authSuccessCallback(credential, URL, { username: 'other', password: 'secret' });
      await provider.authSuccessCallback(credential, 'https://github.com/a/b.git', {
        username: 'user',
        password: 'token',
      });

      expect(calls.map(call => call.action)).toEqual(['fill']);
    });

    it('does not approve when fill returned nothing', async () => {
      fillResponses.push({ code: 0, stdout: 'protocol=https\nhost=dev.azure.com\n' });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      await provider.authSuccessCallback(credential, URL, { username: '', password: '' });

      expect(auth).toEqual({ cancel: true });
      expect(calls.map(call => call.action)).toEqual(['fill']);
    });
  });

  describe('authFailureCallback', () => {
    it('rejects the stale credential and retries fill once', async () => {
      const stale = fillOutput('user', 'stale');
      fillResponses.push({ stdout: stale }, { stdout: fillOutput('user', 'fresh') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL, '/repo');
      const retryAuth = await provider.authFailureCallback(credential, URL, auth, '/repo');

      expect(retryAuth).toEqual({ username: 'user', password: 'fresh' });
      expect(calls).toEqual([
        { action: 'fill', stdin: QUERY, cwd: '/repo' },
        { action: 'reject', stdin: `${stale}\n`, cwd: '/repo' },
        { action: 'fill', stdin: QUERY, cwd: '/repo' },
      ]);
    });

    it('approves the retried credential when it succeeds', async () => {
      const fresh = fillOutput('user', 'fresh');
      fillResponses.push({ stdout: fillOutput('user', 'stale') }, { stdout: fresh });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      const retryAuth = await provider.authFailureCallback(credential, URL, auth);
      await provider.authSuccessCallback(credential, URL, retryAuth);

      expect(calls.map(call => call.action)).toEqual(['fill', 'reject', 'fill', 'approve']);
      expect(calls[3].stdin).toBe(`${fresh}\n`);
    });

    it('rejects and cancels when the retried credential also fails', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'stale') }, { stdout: fillOutput('user', 'still-bad') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      const retryAuth = await provider.authFailureCallback(credential, URL, auth);
      const result = await provider.authFailureCallback(credential, URL, retryAuth);

      expect(result).toEqual({ cancel: true });
      expect(calls.map(call => call.action)).toEqual(['fill', 'reject', 'fill', 'reject']);
      expect(credentialErrors).toEqual([{ host: 'dev.azure.com', reason: 'rejected' }]);
    });

    it('cancels when the retry fill returns nothing', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'stale') }, { code: 1 });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      expect(await provider.authFailureCallback(credential, URL, auth)).toEqual({ cancel: true });
      expect(credentialErrors).toEqual([{ host: 'dev.azure.com', reason: 'rejected', detail: undefined }]);
    });

    it('cancels without rejecting when the failed request carried no credentials', async () => {
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const result = await provider.authFailureCallback(credential, URL, { username: '', password: '' });

      expect(result).toEqual({ cancel: true });
      expect(calls).toEqual([]);
    });

    it('does not let a concurrent operation reset the retry budget', async () => {
      fillResponses.push(
        { stdout: fillOutput('user', 'stale') },
        { stdout: fillOutput('user', 'retried') },
        { stdout: fillOutput('user', 'other') },
      );
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const first = await provider.authCallback(credential, URL);
      const retryAuth = await provider.authFailureCallback(credential, URL, first);
      // Another operation on the same remote starts authenticating in between.
      await provider.authCallback(credential, URL);

      expect(await provider.authFailureCallback(credential, URL, retryAuth)).toEqual({ cancel: true });
      expect(calls.map(call => call.action)).toEqual(['fill', 'reject', 'fill', 'fill', 'reject']);
    });

    it('gives each of several operations that retried together its own retry budget', async () => {
      fillResponses.push(
        { stdout: fillOutput('user', 'stale') },
        { stdout: fillOutput('user', 'stale') },
        { stdout: fillOutput('user', 'retried') },
        { stdout: fillOutput('user', 'retried') },
        { stdout: fillOutput('user', 'unexpected') },
      );
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const firstAuth = await provider.authCallback(credential, URL);
      const secondAuth = await provider.authCallback(credential, URL);
      const firstRetry = await provider.authFailureCallback(credential, URL, firstAuth);
      const secondRetry = await provider.authFailureCallback(credential, URL, secondAuth);

      // Both operations were handed the same retried credential and both are rejected again.
      expect(await provider.authFailureCallback(credential, URL, firstRetry)).toEqual({ cancel: true });
      expect(await provider.authFailureCallback(credential, URL, secondRetry)).toEqual({ cancel: true });
      expect(calls.filter(call => call.action === 'fill')).toHaveLength(4);
    });

    it('keeps fill output of different repositories apart even for identical credentials', async () => {
      const fillA = fillOutput('user', 'token', 'oauth_refresh_token=a\n');
      const fillB = fillOutput('user', 'token', 'oauth_refresh_token=b\n');
      fillResponses.push({ stdout: fillA }, { stdout: fillB });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const authA = await provider.authCallback(credential, URL, '/repo-a');
      const authB = await provider.authCallback(credential, URL, '/repo-b');
      await provider.authSuccessCallback(credential, URL, authA, '/repo-a');
      await provider.authSuccessCallback(credential, URL, authB, '/repo-b');

      expect(calls.slice(2)).toEqual([
        { action: 'approve', stdin: `${fillA}\n`, cwd: '/repo-a' },
        { action: 'approve', stdin: `${fillB}\n`, cwd: '/repo-b' },
      ]);
    });

    it('rejects a failed credential even when another operation consumed its fill output', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'stale') }, { stdout: fillOutput('user', 'fresh') });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      // A concurrent operation that used the same credential succeeded and approved it.
      await provider.authSuccessCallback(credential, URL, auth);
      await provider.authFailureCallback(credential, URL, auth);

      expect(calls.map(call => call.action)).toEqual(['fill', 'approve', 'reject', 'fill']);
      expect(calls[2].stdin).toBe(`${QUERY.trimEnd()}\nusername=user\npassword=stale\n\n`);
    });

    it('allows a retry again on the next authentication attempt', async () => {
      fillResponses.push(
        { stdout: fillOutput('user', 'a') },
        { stdout: fillOutput('user', 'b') },
        { stdout: fillOutput('user', 'c') },
        { stdout: fillOutput('user', 'd') },
      );
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const first = await provider.authCallback(credential, URL);
      await provider.authFailureCallback(credential, URL, first);

      const second = await provider.authCallback(credential, URL);
      const retryAuth = await provider.authFailureCallback(credential, URL, second);

      expect(retryAuth).toEqual({ username: 'user', password: 'd' });
    });
  });
});

describe('NativeProvider interactive sign-in', () => {
  let statuses: NativeSignInStatus[];
  let unsubscribe: () => void;
  let killSpy: MockInstance<typeof process.kill>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    statuses = [];
    unsubscribe = onNativeSignInStatus(status => statuses.push(status));
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
  });

  afterEach(() => {
    unsubscribe();
    killSpy.mockRestore();
    vi.useRealTimers();
  });

  it('does not report fills that finish quickly', async () => {
    fillResponses.push({ stdout: fillOutput('user', 'token') });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    await provider.authCallback(credential, URL);
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS * 2);

    expect(statuses).toEqual([]);
  });

  it('times out a fill that waits too long and stops its process group', async () => {
    fillResponses.push({ hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const authPromise = provider.authCallback(credential, URL);
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS);
    expect(statuses).toEqual([{ id: expect.any(String), host: 'dev.azure.com', state: 'pending' }]);

    await vi.advanceTimersByTimeAsync(FILL_TIMEOUT_MS);

    expect(await authPromise).toEqual({ cancel: true });
    expect(statuses.map(status => status.state)).toEqual(['pending', 'timeout']);
    if (process.platform !== 'win32') {
      expect(killSpy).toHaveBeenCalledWith(-1 * (nextPid - 1), 'SIGTERM');
    }
  });

  it('shares one fill between concurrent requests and cancels all of them together', async () => {
    fillResponses.push({ hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const first = provider.authCallback(credential, URL);
    const second = provider.authCallback(credential, URL);
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS);

    expect(calls.map(call => call.action)).toEqual(['fill']);
    expect(statuses).toHaveLength(1);

    cancelNativeSignIn(statuses[0].id);

    expect(await first).toEqual({ cancel: true });
    expect(await second).toEqual({ cancel: true });
    expect(statuses.map(status => status.state)).toEqual(['pending', 'canceled']);
  });

  it('reports completion when a slow fill succeeds, then starts a fresh fill next time', async () => {
    fillResponses.push({ hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const authPromise = provider.authCallback(credential, URL);
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS);
    cancelNativeSignIn('unknown-id');
    hangingFills[0](fillOutput('user', 'token'));

    expect(await authPromise).toEqual({ username: 'user', password: 'token' });
    expect(statuses.map(status => status.state)).toEqual(['pending', 'completed']);

    fillResponses.push({ stdout: fillOutput('user', 'token2') });
    expect(await provider.authCallback(credential, URL)).toEqual({ username: 'user', password: 'token2' });
    expect(calls.map(call => call.action)).toEqual(['fill', 'fill']);
  });

  it('cancels the git operation when the retry fill is canceled', async () => {
    fillResponses.push({ stdout: fillOutput('user', 'stale') }, { hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const auth = await provider.authCallback(credential, URL);
    const retryPromise = provider.authFailureCallback(credential, URL, auth);
    // Wait for reject to finish and the retry fill to start before moving the clock.
    while (calls.length < 3) {
      await new Promise(resolve => setImmediate(resolve));
    }
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS);
    cancelNativeSignIn(statuses[0].id);

    expect(await retryPromise).toEqual({ cancel: true });
    expect(calls.map(call => call.action)).toEqual(['fill', 'reject', 'fill']);
  });

  it('does not open sign-ins or show the notice for background operations', async () => {
    fillResponses.push({ hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const authPromise = provider.authCallback(credential, URL, undefined, { interactive: false });
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS * 2);

    expect(statuses).toEqual([]);
    expect(spawnMock).toHaveBeenCalledWith(
      'git',
      ['credential', 'fill'],
      expect.objectContaining({ env: expect.objectContaining({ GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' }) }),
    );

    hangingFills[0](fillOutput('user', 'token'));
    expect(await authPromise).toEqual({ username: 'user', password: 'token' });
  });

  it('does not share a background fill with an interactive one', async () => {
    fillResponses.push({ hang: true }, { hang: true });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    const background = provider.authCallback(credential, URL, undefined, { interactive: false });
    const interactive = provider.authCallback(credential, URL);
    await vi.advanceTimersByTimeAsync(0);

    expect(calls.map(call => call.action)).toEqual(['fill', 'fill']);
    hangingFills.forEach(finish => finish(fillOutput('user', 'token')));
    await Promise.all([background, interactive]);
  });

  it('does not report credential errors for background operations', async () => {
    fillResponses.push({ code: 1, stderr: 'fatal: no credentials\n' });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    expect(await provider.authCallback(credential, URL, undefined, { interactive: false })).toEqual({ cancel: true });
    expect(credentialErrors).toEqual([]);
  });

  it('rejects a stale credential but does not retry in background operations', async () => {
    fillResponses.push({ stdout: fillOutput('user', 'stale') });
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });
    const options = { interactive: false };

    const auth = await provider.authCallback(credential, URL, undefined, options);
    expect(await provider.authFailureCallback(credential, URL, auth, undefined, options)).toEqual({ cancel: true });

    expect(calls.map(call => call.action)).toEqual(['fill', 'reject']);
  });

  it('handles spawn throwing synchronously without leaving the fill pending', async () => {
    throwOnSpawn = true;
    const provider = new NativeProvider({ type: 'native', displayName: 'System' });

    expect(await provider.authCallback(credential, URL)).toEqual({ cancel: true });
    await vi.advanceTimersByTimeAsync(SIGN_IN_NOTICE_DELAY_MS * 2);
    expect(statuses).toEqual([]);

    // The next fill for the same remote starts a new process.
    fillResponses.push({ stdout: fillOutput('user', 'token') });
    expect(await provider.authCallback(credential, URL)).toEqual({ username: 'user', password: 'token' });
  });
});
