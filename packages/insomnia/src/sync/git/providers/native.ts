import { spawn } from 'node:child_process';

import type { GitCredentials } from 'insomnia-data';
import type { GitAuth } from 'isomorphic-git';

import type { GitRemoteProvider, NativeProviderConfig, ValidationResult } from './types';

/**
 * A credential in git's credential protocol format: ordered `key=value`
 * attributes. Kept as a list (not an object) so repeated keys such as
 * `capability[]` / `wwwauth[]` and the original order survive a round trip.
 */
type CredentialAttributes = [key: string, value: string][];

type GitCredentialAction = 'fill' | 'approve' | 'reject';

/**
 * How many times a rejected credential is replaced by a fresh `git credential fill`
 * within a single authentication attempt. One retry lets the helper start a new
 * login after a stale token was rejected; more would risk login loops.
 */
const MAX_AUTH_RETRIES = 1;

const emptyAuth = (): GitAuth => ({ username: '', password: '' });

const getAttribute = (attributes: CredentialAttributes, key: string) =>
  attributes.find(([attributeKey]) => attributeKey === key)?.[1];

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

/**
 * Run `git credential <action>` with the given attributes on stdin.
 * Resolves with the exit code (null when git could not be spawned) and stdout.
 */
const runGitCredential = (
  action: GitCredentialAction,
  attributes: CredentialAttributes,
  repoPath?: string,
): Promise<{ code: number | null; stdout: string }> =>
  new Promise(resolve => {
    const output: string[] = [];

    const proc = spawn('git', ['credential', action], {
      ...(repoPath ? { cwd: repoPath } : {}),
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    });

    proc.on('error', err => {
      console.warn(`[NativeProvider] Failed to spawn git credential ${action}:`, err.message);
      resolve({ code: null, stdout: '' });
    });

    proc.on('close', code => {
      resolve({ code, stdout: output.join('') });
    });

    proc.stdout.on('data', (data: Buffer) => output.push(data.toString()));

    proc.stdin.on('error', err => {
      console.warn(`[NativeProvider] Failed to write to git credential ${action}:`, err.message);
    });
    proc.stdin.write(`${attributes.map(([key, value]) => `${key}=${value}`).join('\n')}\n\n`);
    proc.stdin.end();
  });

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
   * Full `git credential fill` output of the credential last handed to
   * isomorphic-git, keyed by remote URL. It is passed back verbatim to
   * approve/reject so helper-specific attributes (e.g. `password_expiry_utc`,
   * `oauth_refresh_token`) are preserved, as the git CLI does.
   */
  private readonly filledCredentials = new Map<string, CredentialAttributes>();

  /** Number of fresh fills done after auth failures, keyed by remote URL. */
  private readonly authRetries = new Map<string, number>();

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

  async authCallback(_credential: GitCredentials, url?: string, repoPath?: string): Promise<GitAuth> {
    const query = toCredentialQuery(url);
    if (!url || !query) {
      return emptyAuth();
    }

    // A new authentication attempt starts here (first 401 of a request).
    this.authRetries.delete(url);
    return this.fill(url, query, repoPath);
  }

  async authSuccessCallback(_credential: GitCredentials, url: string, auth: GitAuth, repoPath?: string) {
    this.authRetries.delete(url);

    const credential = this.takeFilledCredential(url, auth);
    if (!credential) {
      return;
    }

    const { code } = await runGitCredential('approve', credential, repoPath);
    if (code !== 0) {
      console.warn(`[NativeProvider] git credential approve exited with code ${code}`);
    }
  }

  async authFailureCallback(
    _credential: GitCredentials,
    url?: string,
    auth?: GitAuth,
    repoPath?: string,
  ): Promise<GitAuth> {
    const query = toCredentialQuery(url);
    if (!url || !query) {
      return { cancel: true };
    }

    const credential = this.takeFilledCredential(url, auth);
    if (!credential) {
      // The credential manager had nothing for this remote — nothing to reject or retry.
      this.authRetries.delete(url);
      console.log('[NativeProvider] Auth failed. Check your system git credential manager.');
      return { cancel: true };
    }

    // Tell the helper the credential is invalid so it is not returned again.
    const { code } = await runGitCredential('reject', credential, repoPath);
    if (code !== 0) {
      console.warn(`[NativeProvider] git credential reject exited with code ${code}`);
    }

    const retries = this.authRetries.get(url) ?? 0;
    if (retries >= MAX_AUTH_RETRIES) {
      this.authRetries.delete(url);
      console.log('[NativeProvider] Auth failed after retry. Check your system git credential manager.');
      return { cancel: true };
    }
    this.authRetries.set(url, retries + 1);

    // Ask again: helpers such as Git Credential Manager start a new login once
    // the stale credential has been rejected.
    console.log('[NativeProvider] Credential rejected by the server, requesting a new one');
    const nextAuth = await this.fill(url, query, repoPath);
    if (!nextAuth.username && !nextAuth.password) {
      this.authRetries.delete(url);
      return { cancel: true };
    }
    return nextAuth;
  }

  private async fill(url: string, query: CredentialAttributes, repoPath?: string): Promise<GitAuth> {
    this.filledCredentials.delete(url);

    const { code, stdout } = await runGitCredential('fill', query, repoPath);
    if (code !== 0) {
      if (code !== null) {
        console.warn(`[NativeProvider] git credential fill exited with code ${code}`);
      }
      return emptyAuth();
    }

    const filled = parseCredentialOutput(stdout);
    const username = getAttribute(filled, 'username') ?? '';
    const password = getAttribute(filled, 'password') ?? '';
    if (!username && !password) {
      return emptyAuth();
    }

    // `fill` echoes the full credential, but fall back to the query for any
    // identifying attribute it omitted so approve/reject target the same entry.
    const missing = query.filter(([key]) => key !== 'path' && getAttribute(filled, key) === undefined);
    this.filledCredentials.set(url, [...missing, ...filled]);

    return { username, password };
  }

  /**
   * Take (and forget) the remembered fill result for `url`, provided it is the
   * credential isomorphic-git actually used.
   */
  private takeFilledCredential(url: string, auth?: GitAuth): CredentialAttributes | null {
    const credential = this.filledCredentials.get(url);
    this.filledCredentials.delete(url);

    if (!credential) {
      return null;
    }

    if (
      auth &&
      ((auth.username ?? '') !== (getAttribute(credential, 'username') ?? '') ||
        (auth.password ?? '') !== (getAttribute(credential, 'password') ?? ''))
    ) {
      return null;
    }

    return credential;
  }
}
