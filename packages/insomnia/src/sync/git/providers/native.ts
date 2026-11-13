import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

import type { GitCredentials } from 'insomnia-data';
import type { GitAuth } from 'isomorphic-git';

import type { GitAuthOptions, GitRemoteProvider, NativeProviderConfig, ValidationResult } from './types';

/**
 * A credential in git's credential protocol format: ordered `key=value`
 * attributes. Kept as a list (not an object) so repeated keys such as
 * `capability[]` / `wwwauth[]` and the original order survive a round trip.
 */
type CredentialAttributes = [key: string, value: string][];

type GitCredentialAction = 'fill' | 'approve' | 'reject';

/**
 * Key for a credential used against a remote from a given repository. The repository
 * is part of the key because its local git config can select a different credential
 * helper, so identical credentials may still carry different helper attributes.
 *
 * A rejected credential is replaced by a fresh `git credential fill` at most once:
 * one retry lets the helper start a new login after a stale token was rejected;
 * more would risk login loops.
 */
const credentialKey = (url: string, auth: GitAuth, repoPath?: string) =>
  `${repoPath ?? ''}\n${url}\n${auth.username ?? ''}\n${auth.password ?? ''}`;

const emptyAuth = (): GitAuth => ({ username: '', password: '' });

const getAttribute = (attributes: CredentialAttributes, key: string) =>
  attributes.find(([attributeKey]) => attributeKey === key)?.[1];

const getHost = (attributes: CredentialAttributes) => getAttribute(attributes, 'host') ?? '';

type FillOutcome =
  | { kind: 'filled'; auth: GitAuth }
  /** Timed out or canceled by the user. */
  | { kind: 'stopped' }
  | { kind: 'failed'; reason: NativeCredentialError['reason']; detail?: string };

/**
 * Build the `git credential` query for a remote URL, e.g.
 * 'https://github.com/owner/repo.git' → protocol=https, host=github.com, path=owner/repo.git
 */
const toCredentialQuery = (url?: string): CredentialAttributes | null => {
  if (!url) {
    console.warn('[NativeProvider] No URL provided — cannot query credential manager');
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn(`[NativeProvider] Invalid URL passed to credential manager: ${url}`);
    return null;
  }

  const { protocol, host } = parsed;

  if (!host) {
    console.warn(`[NativeProvider] URL has no host field — cannot query credential manager: ${url}`);
    return null;
  }

  // 'https:' → 'https'
  const attributes: CredentialAttributes = [
    ['protocol', protocol.slice(0, -1)],
    ['host', host],
  ];
  // git's credential protocol expects the path without a leading slash. Supplying it
  // scopes the lookup so the right credential is returned when a helper stores multiple
  // entries per host (honoured by helpers that have credential.useHttpPath set).
  const path = parsed.pathname.replace(/^\/+/, '');
  if (path) {
    attributes.push(['path', path]);
  }
  return attributes;
};

const parseCredentialOutput = (output: string): CredentialAttributes =>
  output.split('\n').reduce<CredentialAttributes>((acc, rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      acc.push([line.slice(0, eqIndex), line.slice(eqIndex + 1)]);
    }
    return acc;
  }, []);

const serializeCredential = (attributes: CredentialAttributes) =>
  `${attributes.map(([key, value]) => `${key}=${value}`).join('\n')}\n\n`;

/**
 * `fill` may wait for an interactive sign-in (e.g. Git Credential Manager opening
 * a browser), so it gets a generous timeout. approve/reject only talk to storage.
 */
export const FILL_TIMEOUT_MS = 5 * 60 * 1000;
const STORE_TIMEOUT_MS = 30 * 1000;
/** A fill still running after this long is most likely waiting for the user to sign in. */
export const SIGN_IN_NOTICE_DELAY_MS = 1500;
/** Grace period between SIGTERM and SIGKILL when stopping a credential process. */
const KILL_GRACE_MS = 3000;

type GitCredentialOutcome = 'exited' | 'spawn-error' | 'timeout' | 'canceled';

interface GitCredentialResult {
  outcome: GitCredentialOutcome;
  code: number | null;
  stdout: string;
  stderr: string;
  /** For `spawn-error`: why git could not be started. */
  spawnError?: { code?: string; message: string };
}

/** Keep logged helper output short; it is only diagnostic. */
const MAX_STDERR_LENGTH = 2000;

const toSpawnError = (err: unknown): { code?: string; message: string } => ({
  code: (err as NodeJS.ErrnoException).code,
  message: (err as Error).message,
});

/**
 * git's own fallback after a helper fails to provide credentials (with terminal
 * prompts disabled). It says nothing about why the helper failed.
 */
const GIT_PROMPT_FALLBACK = /^fatal: could not read (Username|Password) for /;

/** Last non-empty line of the helper's stderr, ignoring git's own prompt fallback line. */
const summarizeStderr = (stderr: string) =>
  stderr
    .split('\n')
    .map(line => line.trim())
    .findLast(line => line && !GIT_PROMPT_FALLBACK.test(line))
    ?.slice(0, 300);

interface RunningGitCredential {
  result: Promise<GitCredentialResult>;
  cancel: () => void;
}

/**
 * Stop the credential process and everything it started. Helpers such as Git
 * Credential Manager run as children of git, so killing git alone would leave
 * them (and their sign-in windows) behind.
 */
const killProcessTree = (proc: ChildProcess) => {
  const { pid } = proc;
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }).on('error', err => {
      console.warn('[NativeProvider] Failed to stop git credential process:', err.message);
    });
    return;
  }

  // POSIX: the process was spawned detached, i.e. as the leader of its own process group.
  const killGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch {
      // The group is already gone.
    }
  };
  killGroup('SIGTERM');
  setTimeout(() => killGroup('SIGKILL'), KILL_GRACE_MS).unref?.();
};

/**
 * Run `git credential <action>` with the given attributes on stdin. The result
 * settles when git exits, when it cannot be spawned, on timeout, or on cancel.
 */
const runGitCredential = (
  action: GitCredentialAction,
  attributes: CredentialAttributes,
  { repoPath, timeoutMs, env }: { repoPath?: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
): RunningGitCredential => {
  let stop: (outcome: 'timeout' | 'canceled') => void = () => {};

  const result = new Promise<GitCredentialResult>(resolve => {
    const output: string[] = [];
    // Only the tail of stderr is kept, so a chatty helper cannot grow memory while it runs.
    let errorTail = '';
    let settled = false;
    // `stop` is assigned once the process exists; until then a timeout is a no-op.
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    const settle = (value: GitCredentialResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    };

    let proc: ChildProcess;
    try {
      proc = spawn('git', ['credential', action], {
        // A missing cwd makes spawn fail with ENOENT, which looks like git is missing.
        // Fall back to the global/system git config instead of failing.
        ...(repoPath && existsSync(repoPath) ? { cwd: repoPath } : {}),
        // There is no terminal to prompt in: fail fast with a clear message instead.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        // Own process group on POSIX so the whole tree can be stopped (see killProcessTree).
        detached: process.platform !== 'win32',
      });
    } catch (err) {
      // spawn can also throw synchronously (e.g. EINVAL/EACCES on Windows).
      console.warn(`[NativeProvider] Failed to spawn git credential ${action}:`, (err as Error).message);
      settle({ outcome: 'spawn-error', code: null, stdout: '', stderr: '', spawnError: toSpawnError(err) });
      return;
    }

    stop = outcome => {
      if (settled) {
        return;
      }
      console.warn(`[NativeProvider] git credential ${action} ${outcome === 'timeout' ? 'timed out' : 'was canceled'}`);
      killProcessTree(proc);
      settle({ outcome, code: null, stdout: '', stderr: '' });
    };

    proc.on('error', err => {
      console.warn(`[NativeProvider] Failed to spawn git credential ${action}:`, err.message);
      settle({ outcome: 'spawn-error', code: null, stdout: '', stderr: '', spawnError: toSpawnError(err) });
    });

    proc.on('close', code => {
      const stderr = errorTail;
      if (code !== 0 && stderr.trim()) {
        console.warn(`[NativeProvider] git credential ${action} stderr:\n${stderr.trim()}`);
      }
      settle({ outcome: 'exited', code, stdout: output.join(''), stderr });
    });

    proc.stdout?.on('data', (data: Buffer) => output.push(data.toString()));
    proc.stderr?.on('data', (data: Buffer) => {
      errorTail = (errorTail + data.toString()).slice(-MAX_STDERR_LENGTH);
    });

    proc.stdin?.on('error', err => {
      console.warn(`[NativeProvider] Failed to write to git credential ${action}:`, err.message);
    });
    proc.stdin?.write(serializeCredential(attributes));
    proc.stdin?.end();
  });

  return { result, cancel: () => stop('canceled') };
};

const runStoreAction = async (action: 'approve' | 'reject', credential: CredentialAttributes, repoPath?: string) => {
  const { outcome, code } = await runGitCredential(action, credential, { repoPath, timeoutMs: STORE_TIMEOUT_MS })
    .result;
  if (outcome === 'exited' && code !== 0) {
    console.warn(`[NativeProvider] git credential ${action} exited with code ${code}`);
  }
};

/**
 * Status of a `git credential fill` that is waiting for the user, e.g. to finish
 * signing in through Git Credential Manager. `pending` is only reported once a
 * fill has run longer than SIGN_IN_NOTICE_DELAY_MS, and a final state is only
 * reported for fills that were reported as pending.
 */
export interface NativeSignInStatus {
  id: string;
  host: string;
  state: 'pending' | 'completed' | 'canceled' | 'timeout';
}

type NativeSignInStatusListener = (status: NativeSignInStatus) => void;

const signInStatusListeners = new Set<NativeSignInStatusListener>();

export const onNativeSignInStatus = (listener: NativeSignInStatusListener) => {
  signInStatusListeners.add(listener);
  return () => {
    signInStatusListeners.delete(listener);
  };
};

const emitSignInStatus = (status: NativeSignInStatus) => {
  for (const listener of signInStatusListeners) {
    try {
      listener(status);
    } catch (error) {
      console.warn('[NativeProvider] Sign-in status listener failed', error);
    }
  }
};

/**
 * Why System Git Credentials could not provide credentials, reported so the UI
 * can explain what to do (the git operation itself fails with a generic
 * authentication error).
 */
export interface NativeCredentialError {
  host: string;
  reason: 'git-not-found' | 'git-failed-to-start' | 'no-credentials' | 'rejected';
  /** Last line of the credential helper's stderr, if any. */
  detail?: string;
}

type NativeCredentialErrorListener = (error: NativeCredentialError) => void;

const credentialErrorListeners = new Set<NativeCredentialErrorListener>();

export const onNativeCredentialError = (listener: NativeCredentialErrorListener) => {
  credentialErrorListeners.add(listener);
  return () => {
    credentialErrorListeners.delete(listener);
  };
};

/** Concurrent git operations fail together; report each problem once. */
const CREDENTIAL_ERROR_DEDUPE_MS = 5000;
const lastCredentialErrors = new Map<string, number>();

const emitCredentialError = (error: NativeCredentialError) => {
  const key = `${error.host}\n${error.reason}`;
  const now = Date.now();
  if (now - (lastCredentialErrors.get(key) ?? Number.NEGATIVE_INFINITY) < CREDENTIAL_ERROR_DEDUPE_MS) {
    return;
  }
  lastCredentialErrors.set(key, now);

  for (const listener of credentialErrorListeners) {
    try {
      listener(error);
    } catch (listenerError) {
      console.warn('[NativeProvider] Credential error listener failed', listenerError);
    }
  }
};

interface FillRequest {
  id: string;
  result: Promise<GitCredentialResult>;
  cancel: () => void;
}

/** In-flight fills keyed by mode + working directory + query, shared by concurrent callers. */
const inFlightFills = new Map<string, FillRequest>();

/**
 * Cancel a pending fill (e.g. from the sign-in notice in the UI). Every caller
 * sharing that fill receives a canceled result.
 */
export const cancelNativeSignIn = (id: string) => {
  for (const request of inFlightFills.values()) {
    if (request.id === id) {
      request.cancel();
    }
  }
};

/**
 * Environment for fills that must not interact with the user (background git
 * operations): Git Credential Manager does not open sign-ins, and git does not
 * try to prompt on a terminal. Stored credentials are still returned.
 */
const NON_INTERACTIVE_ENV = { GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' };

/**
 * Run `git credential fill`, reusing an identical fill that is already running so
 * concurrent git operations trigger a single sign-in. Non-interactive fills never
 * report a sign-in status.
 */
const requestFill = (
  query: CredentialAttributes,
  repoPath: string | undefined,
  interactive: boolean,
): Promise<GitCredentialResult> => {
  const key = `${interactive ? 'interactive' : 'background'}\n${repoPath ?? ''}\n${serializeCredential(query)}`;
  const existing = inFlightFills.get(key);
  if (existing) {
    return existing.result;
  }

  const id = randomUUID();
  const host = getHost(query);
  const running = runGitCredential('fill', query, {
    repoPath,
    timeoutMs: FILL_TIMEOUT_MS,
    ...(interactive ? {} : { env: NON_INTERACTIVE_ENV }),
  });

  let noticeShown = false;
  const noticeTimer = interactive
    ? setTimeout(() => {
        noticeShown = true;
        emitSignInStatus({ id, host, state: 'pending' });
      }, SIGN_IN_NOTICE_DELAY_MS)
    : undefined;

  const result = running.result.then(fillResult => {
    clearTimeout(noticeTimer);
    inFlightFills.delete(key);
    if (noticeShown) {
      const state =
        fillResult.outcome === 'timeout' ? 'timeout' : fillResult.outcome === 'canceled' ? 'canceled' : 'completed';
      emitSignInStatus({ id, host, state });
    }
    return fillResult;
  });

  inFlightFills.set(key, { id, result, cancel: running.cancel });
  return result;
};

/**
 * Native Git Credential Provider
 *
 * Delegates authentication to the operating system's native git credential
 * manager at runtime via `git credential fill`. No tokens are stored in
 * Insomnia's database — credentials are resolved on every auth request.
 *
 * Like the git CLI, it completes the credential protocol: credentials the server
 * accepts are reported back with `git credential approve` (so helpers such as
 * Git Credential Manager persist OAuth tokens and account bindings), and rejected
 * ones with `git credential reject` (so helpers drop stale credentials).
 *
 * Works with: macOS Keychain, Windows Credential Manager,
 * git-credential-manager, git-credential-store, and any other helper
 * configured in the user's global or repo-local git config.
 */
export class NativeProvider implements GitRemoteProvider<NativeProviderConfig> {
  readonly config: NativeProviderConfig;
  readonly supportsOAuth = false;
  readonly supportsFetchRepos = false;
  readonly supportsFetchEmails = false;
  readonly supportsAutoRenew = false;

  /**
   * Full `git credential fill` output of credentials handed to isomorphic-git,
   * keyed by repository + remote URL + username + password (see credentialKey) so
   * concurrent operations do not overwrite each other. It is passed back
   * verbatim to approve/reject so helper-specific attributes (e.g.
   * `password_expiry_utc`, `oauth_refresh_token`) are preserved, as the git CLI does.
   */
  private readonly filledCredentials = new Map<string, CredentialAttributes>();

  /**
   * Number of operations currently holding a credential obtained by a retry after a
   * rejection (see credentialKey). Operations that retried at the same time share the
   * same credential, so each one counts. If a retried credential is rejected too, that
   * operation gives up instead of retrying again.
   */
  private readonly retriedCredentials = new Map<string, number>();

  private markRetried(key: string) {
    this.retriedCredentials.set(key, (this.retriedCredentials.get(key) ?? 0) + 1);
  }

  /** Releases one retry holder of `key`; returns whether there was one. */
  private releaseRetried(key: string) {
    const count = this.retriedCredentials.get(key) ?? 0;
    if (count <= 1) {
      this.retriedCredentials.delete(key);
    } else {
      this.retriedCredentials.set(key, count - 1);
    }
    return count > 0;
  }

  constructor(config: NativeProviderConfig) {
    this.config = config;
  }

  async validateUrl(url: string): Promise<ValidationResult> {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          valid: false,
          error: 'URL must use HTTP or HTTPS protocol',
          suggestion: `Try: https://${parsed.hostname}${parsed.pathname}`,
        };
      }

      if (!url.endsWith('.git')) {
        return {
          valid: true,
          suggestion: 'Consider adding .git suffix to the URL for better compatibility',
        };
      }

      return { valid: true };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  async authCallback(
    _credential: GitCredentials,
    url?: string,
    repoPath?: string,
    options?: GitAuthOptions,
  ): Promise<GitAuth> {
    const query = toCredentialQuery(url);
    if (!url || !query) {
      return emptyAuth();
    }

    const interactive = options?.interactive ?? true;
    const result = await this.fill(url, query, repoPath, interactive);
    if (result.kind === 'filled') {
      return result.auth;
    }
    // Background operations fail quietly; the user is told on their next action.
    if (result.kind === 'failed' && interactive) {
      emitCredentialError({ host: getHost(query), reason: result.reason, detail: result.detail });
    }
    // Stop here: retrying the request without credentials cannot succeed.
    return { cancel: true };
  }

  async authSuccessCallback(_credential: GitCredentials, url: string, auth: GitAuth, repoPath?: string) {
    const key = credentialKey(url, auth, repoPath);
    this.releaseRetried(key);

    // Only approve what `fill` returned. Another operation that used the same
    // credential may already have approved (and forgotten) it.
    const credential = this.filledCredentials.get(key);
    this.filledCredentials.delete(key);
    if (!credential) {
      return;
    }

    await runStoreAction('approve', credential, repoPath);
  }

  async authFailureCallback(
    _credential: GitCredentials,
    url?: string,
    auth?: GitAuth,
    repoPath?: string,
    options?: GitAuthOptions,
  ): Promise<GitAuth> {
    const interactive = options?.interactive ?? true;
    const query = toCredentialQuery(url);
    if (!url || !query) {
      return { cancel: true };
    }

    if (!auth?.username && !auth?.password) {
      // The credential manager had nothing for this remote — nothing to reject or retry.
      console.log('[NativeProvider] Auth failed. Check your system git credential manager.');
      return { cancel: true };
    }

    const key = credentialKey(url, auth, repoPath);
    // Fall back to the failed credential itself when another operation that used
    // it already consumed the remembered fill output.
    const credential = this.filledCredentials.get(key) ?? [
      ...query,
      ['username', auth.username ?? ''],
      ['password', auth.password ?? ''],
    ];
    this.filledCredentials.delete(key);

    // Tell the helper the credential is invalid so it is not returned again.
    await runStoreAction('reject', credential, repoPath);

    if (this.releaseRetried(key)) {
      console.log('[NativeProvider] Auth failed after retry. Check your system git credential manager.');
      if (interactive) {
        emitCredentialError({ host: getHost(query), reason: 'rejected' });
      }
      return { cancel: true };
    }

    if (!interactive) {
      // A background operation cannot start a new sign-in; the next user-initiated one will.
      return { cancel: true };
    }

    // Ask again: helpers such as Git Credential Manager start a new login once
    // the stale credential has been rejected.
    console.log('[NativeProvider] Credential rejected by the server, requesting a new one');
    const result = await this.fill(url, query, repoPath, interactive);
    if (result.kind === 'filled') {
      this.markRetried(credentialKey(url, result.auth, repoPath));
      return result.auth;
    }

    if (result.kind === 'failed') {
      // The stored credential was rejected and the helper had nothing new to offer.
      emitCredentialError({
        host: getHost(query),
        reason: result.reason === 'no-credentials' ? 'rejected' : result.reason,
        detail: result.detail,
      });
    }
    return { cancel: true };
  }

  private async fill(
    url: string,
    query: CredentialAttributes,
    repoPath: string | undefined,
    interactive: boolean,
  ): Promise<FillOutcome> {
    const { outcome, code, stdout, stderr, spawnError } = await requestFill(query, repoPath, interactive);
    switch (outcome) {
      case 'timeout':
      case 'canceled': {
        // Already reported through the sign-in status.
        return { kind: 'stopped' };
      }
      case 'spawn-error': {
        // git itself could not be started: not installed / not on PATH (ENOENT), or present but not runnable.
        return spawnError?.code === 'ENOENT'
          ? { kind: 'failed', reason: 'git-not-found' }
          : { kind: 'failed', reason: 'git-failed-to-start', detail: spawnError?.message };
      }
      default: {
        break;
      }
    }

    if (code !== 0) {
      console.warn(`[NativeProvider] git credential fill exited with code ${code}`);
      return { kind: 'failed', reason: 'no-credentials', detail: summarizeStderr(stderr) };
    }

    const filled = parseCredentialOutput(stdout);
    const username = getAttribute(filled, 'username') ?? '';
    const password = getAttribute(filled, 'password') ?? '';
    if (!username && !password) {
      return { kind: 'failed', reason: 'no-credentials', detail: summarizeStderr(stderr) };
    }

    // `fill` echoes the full credential, but fall back to the query for any
    // identifying attribute it omitted so approve/reject target the same entry.
    const missing = query.filter(([key]) => key !== 'path' && getAttribute(filled, key) === undefined);
    this.filledCredentials.set(credentialKey(url, { username, password }, repoPath), [...missing, ...filled]);

    return { kind: 'filled', auth: { username, password } };
  }
}
