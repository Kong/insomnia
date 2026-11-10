import type { GitCredentials } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeProvider } from '../native';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('node:child_process', () => ({ spawn: spawnMock }));

type Action = 'fill' | 'approve' | 'reject';

interface SpawnCall {
  action: Action;
  stdin: string;
  cwd?: string;
}

interface Response {
  code?: number;
  stdout?: string;
}

const URL = 'https://dev.azure.com/org/project/_git/repo';
const QUERY = 'protocol=https\nhost=dev.azure.com\npath=org/project/_git/repo\n\n';
const credential = { provider: 'native' } as unknown as GitCredentials;

let calls: SpawnCall[];
let fillResponses: Response[];

const fillOutput = (username: string, password: string, extra = '') =>
  `protocol=https\nhost=dev.azure.com\npath=org/project/_git/repo\nusername=${username}\npassword=${password}\n${extra}`;

beforeEach(() => {
  calls = [];
  fillResponses = [];
  spawnMock.mockReset();
  spawnMock.mockImplementation((_cmd: string, args: string[], options: { cwd?: string }) => {
    const action = args[1] as Action;
    const call: SpawnCall = { action, stdin: '', cwd: options.cwd };
    calls.push(call);

    const response: Response = action === 'fill' ? (fillResponses.shift() ?? { code: 0, stdout: '' }) : { code: 0 };

    // Minimal stand-in for the ChildProcess surface NativeProvider uses.
    const listeners: Record<string, (value: any) => void> = {};
    return {
      on: (event: string, listener: (value: any) => void) => {
        listeners[event] = listener;
      },
      stdout: {
        on: (event: string, listener: (value: any) => void) => {
          listeners[`stdout:${event}`] = listener;
        },
      },
      stdin: {
        on: vi.fn(),
        write: (data: string) => {
          call.stdin += data;
        },
        end: () => {
          setImmediate(() => {
            if (response.stdout) {
              listeners['stdout:data']?.(Buffer.from(response.stdout));
            }
            listeners.close?.(response.code ?? 0);
          });
        },
      },
    };
  });
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

    it('returns empty credentials when fill fails', async () => {
      fillResponses.push({ code: 128 });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      expect(await provider.authCallback(credential, URL)).toEqual({ username: '', password: '' });
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
      await provider.authSuccessCallback(credential, URL, auth);

      expect(auth).toEqual({ username: '', password: '' });
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
    });

    it('cancels when the retry fill returns nothing', async () => {
      fillResponses.push({ stdout: fillOutput('user', 'stale') }, { code: 1 });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      expect(await provider.authFailureCallback(credential, URL, auth)).toEqual({ cancel: true });
    });

    it('cancels without rejecting when the credential manager had nothing', async () => {
      fillResponses.push({ code: 128 });
      const provider = new NativeProvider({ type: 'native', displayName: 'System' });

      const auth = await provider.authCallback(credential, URL);
      const result = await provider.authFailureCallback(credential, URL, auth);

      expect(result).toEqual({ cancel: true });
      expect(calls.map(call => call.action)).toEqual(['fill']);
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
