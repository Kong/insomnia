import { spawn } from 'node:child_process';

import type { GitAuth } from 'isomorphic-git';

import type { GitCredentials } from '~/insomnia-data';

import type { GitRemoteProvider, NativeProviderConfig, ValidationResult } from './types';

/**
 * Native Git Credential Provider
 *
 * Delegates authentication to the operating system's native git credential
 * manager at runtime via `git credential fill`. No tokens are stored in
 * Insomnia's database — credentials are resolved on every auth request.
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

  authCallback(_credential: GitCredentials, url?: string, repoPath?: string): Promise<GitAuth> {
    if (!url) {
      console.warn('[NativeProvider] No URL provided to authCallback — cannot query credential manager');
      return Promise.resolve({ username: '', password: '' });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      console.warn(`[NativeProvider] Invalid URL passed to authCallback: ${url}`);
      return Promise.resolve({ username: '', password: '' });
    }

    const { protocol, host } = parsed;

    if (!host) {
      console.warn(`[NativeProvider] URL has no host field — cannot query credential manager: ${url}`);
      return Promise.resolve({ username: '', password: '' });
    }

    // 'https:' → 'https'
    const protocolWithoutColon = protocol.slice(0, -1);

    return new Promise(resolve => {
      const output: string[] = [];

      const proc = spawn('git', ['credential', 'fill'], {
        ...(repoPath ? { cwd: repoPath } : {}),
      });

      proc.on('error', err => {
        console.warn('[NativeProvider] Failed to spawn git credential fill:', err.message);
        resolve({ username: '', password: '' });
      });

      proc.on('close', code => {
        if (code !== 0) {
          console.warn(`[NativeProvider] git credential fill exited with code ${code}`);
          resolve({ username: '', password: '' });
          return;
        }

        const result = output
          .join('\n')
          .split('\n')
          .reduce<Record<string, string>>((acc, line) => {
            const eqIndex = line.indexOf('=');
            if (eqIndex !== -1) {
              const key = line.slice(0, eqIndex).trim();
              const val = line.slice(eqIndex + 1).trim();
              if (key === 'username' || key === 'password') {
                acc[key] = val;
              }
            }
            return acc;
          }, {});

        resolve({
          username: result.username ?? '',
          password: result.password ?? '',
        });
      });

      proc.stdout.on('data', (data: Buffer) => output.push(data.toString()));

      proc.stdin.write(`protocol=${protocolWithoutColon}\nhost=${host}\n\n`);
      proc.stdin.end();
    });
  }

  authFailureCallback(_credential: GitCredentials): GitAuth {
    // The native credential manager owns credential refresh/expiry externally.
    // Return cancel so isomorphic-git stops retrying and surfaces the error to the user.
    console.log('[NativeProvider] Auth failed. Check your system git credential manager.');
    return { cancel: true };
  }
}
