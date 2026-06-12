/**
 * Security tests for getPluginPreview.
 *
 * These tests exercise the REAL getPluginPreview → getPluginInfo → runYarnCommand
 * call chain end-to-end. External I/O boundaries are mocked; the install-plugin
 * module itself is NOT mocked so the actual transformation logic runs.
 *
 * Key property under test: untrusted URLs from npm metadata (publisher.icon, etc.)
 * must never appear in the IPC response sent to the renderer.
 *
 * Implementation note — why execFilePromiseMock uses util.promisify.custom:
 *   install-plugin.ts does `export const execFilePromise = promisify(execFile)`.
 *   The real node `execFile` has util.promisify.custom set, so promisify() returns
 *   a function that resolves with { stdout, stderr }. A plain vi.fn() lacks that
 *   symbol, so promisify falls back to the single-value callback convention and
 *   resolves with just stdout — causing `const { stdout } = await execFilePromise(…)`
 *   to destructure undefined. We hoist the symbol so the mock factory can attach
 *   it before install-plugin.ts is loaded.
 */

import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, net } from 'electron';
import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted helpers (run before all mocks and imports) ──────────────────────

const { execFilePromiseMock, PROMISIFY_CUSTOM } = vi.hoisted(() => {
  // require is available in vi.hoisted (Node.js environment).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { promisify } = require('node:util') as typeof import('node:util');
  return {
    execFilePromiseMock: vi.fn(),
    PROMISIFY_CUSTOM: promisify.custom as symbol,
  };
});

// ─── Mock declarations ────────────────────────────────────────────────────────

vi.mock('node:child_process', () => {
  const execFileMock = vi.fn();
  // Attach util.promisify.custom so that promisify(execFileMock) === execFilePromiseMock.
  // Without this, promisify falls back to single-value mode and stdout destructuring fails.
  Object.defineProperty(execFileMock, PROMISIFY_CUSTOM, {
    value: execFilePromiseMock,
    configurable: true,
    writable: true,
  });
  return { execFile: execFileMock };
});

vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  lstat: vi.fn(),
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), getAppPath: vi.fn() },
  net: { fetch: vi.fn() },
}));

vi.mock('insomnia-data', () => ({
  services: { settings: { get: vi.fn() } },
}));

const dnsLookupMock = vi.hoisted(() => vi.fn());
vi.mock('node:dns/promises', () => ({ default: { lookup: dnsLookupMock } }));

vi.mock('~/main/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  AnalyticsEvent: { installPlugin: 'Plugin Installed' },
}));

// ─── Import actual function AFTER mock declarations ───────────────────────────
import { getPluginPreview } from '../main/install-plugin';

// ─── Constants ────────────────────────────────────────────────────────────────

// The directory that install-plugin.ts lives in. Passed to app.getAppPath() so
// getYarnPath()'s path safety check (resolvedAppPath.startsWith(SAFE_APP_BASE))
// passes without mocking node:path.
const INSTALL_PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../main');

/** Wrap plugin data in the { data: {...} } envelope that `yarn info --json` produces. */
function yarnInfoPayload(data: Record<string, unknown>): { stdout: Buffer; stderr: Buffer } {
  return {
    stdout: Buffer.from(JSON.stringify({ data })),
    // stderr must be a string (not a Buffer) — containsOnlyDeprecationWarnings calls
    // output.split('\n'), which Buffer does not implement.
    stderr: '',
  };
}

/** Minimal valid InsomniaPlugin metadata — override per test as needed. */
const BASE_PLUGIN_DATA: Record<string, unknown> = {
  name: 'insomnia-plugin-test',
  version: '1.0.0',
  insomnia: {
    displayName: 'Test Plugin',
    description: 'A test plugin',
  },
  dist: {
    shasum: 'abc123',
    tarball: 'https://registry.npmjs.org/insomnia-plugin-test/-/insomnia-plugin-test-1.0.0.tgz',
    integrity: 'sha512-abc123',
  },
  dependencies: {},
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('getPluginPreview — publisher.icon is stripped from the IPC response', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // getYarnPath safety check: make the "app path" equal the actual install-plugin
    // source directory so resolvedAppPath.startsWith(SAFE_APP_BASE) is satisfied
    // without needing to mock the real node:path module.
    vi.mocked(app.getAppPath).mockReturnValue(INSTALL_PLUGIN_DIR);
    vi.mocked(app.getPath).mockReturnValue('/tmp/insomnia-test-data');

    // getYarnPath lstat: the yarn binary exists and is not a symlink.
    vi.mocked(lstat).mockResolvedValue({ isSymbolicLink: () => false } as any);

    // Default settings: no custom registry configured.
    vi.mocked(services.settings.get).mockResolvedValue({ npmRegistryUrl: '' } as any);

    // DNS: registry.npmjs.org resolves to a public address (not loopback/rebinding).
    dnsLookupMock.mockResolvedValue([{ address: '104.16.0.1', family: 4 }]);

    // Best-effort download stats — not relevant to security tests.
    vi.mocked(net.fetch).mockResolvedValue({ ok: false } as any);

    // Default execFilePromise response: the base plugin data for all yarn calls.
    // fetchPackageReadme / fetchPackageTimes receive the same payload; they look
    // for `data` to be a string / have .created — they silently return undefined
    // when the shape doesn't match, which is fine for our tests.
    execFilePromiseMock.mockResolvedValue(yarnInfoPayload(BASE_PLUGIN_DATA));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ─── publisher.icon stripping ──────────────────────────────────────────────

  it('omits icon when the publisher provides one', async () => {
    execFilePromiseMock.mockResolvedValue(
      yarnInfoPayload({
        ...BASE_PLUGIN_DATA,
        insomnia: {
          displayName: 'Test Plugin',
          description: 'A test plugin',
          publisher: {
            name: 'Publisher Corp',
            icon: 'https://evil.com/tracking-pixel.png',
          },
        },
      }),
    );

    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(preview.publisher?.name).toBe('Publisher Corp');
    // An arbitrary author-supplied URL must never reach the renderer.
    expect((preview.publisher as any)?.icon).toBeUndefined();
  });

  it('publisher object contains ONLY the name key — no extra npm metadata fields', async () => {
    execFilePromiseMock.mockResolvedValue(
      yarnInfoPayload({
        ...BASE_PLUGIN_DATA,
        insomnia: {
          displayName: 'Test Plugin',
          description: 'A test plugin',
          publisher: {
            name: 'Publisher Corp',
            icon: 'https://evil.com/tracking-pixel.png',
            website: 'https://evil.com',
            extraField: '<script>alert(1)</script>',
          },
        },
      }),
    );

    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(Object.keys(preview.publisher ?? {})).toEqual(['name']);
  });

  it('sets publisher to undefined when publisher has no name (icon-only publisher is discarded)', async () => {
    execFilePromiseMock.mockResolvedValue(
      yarnInfoPayload({
        ...BASE_PLUGIN_DATA,
        insomnia: {
          displayName: 'Test Plugin',
          description: 'A test plugin',
          publisher: {
            // name is intentionally absent — only an icon URL
            icon: 'https://evil.com/tracking-pixel.png',
          },
        },
      }),
    );

    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(preview.publisher).toBeUndefined();
  });

  it('preserves publisher name when no icon is present', async () => {
    execFilePromiseMock.mockResolvedValue(
      yarnInfoPayload({
        ...BASE_PLUGIN_DATA,
        insomnia: {
          displayName: 'Test Plugin',
          description: 'A test plugin',
          publisher: { name: 'Legitimate Corp' },
        },
      }),
    );

    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(preview.publisher?.name).toBe('Legitimate Corp');
    expect((preview.publisher as any)?.icon).toBeUndefined();
  });

  it('sets publisher to undefined when insomnia.publisher is absent', async () => {
    // BASE_PLUGIN_DATA has no publisher field.
    const preview = await getPluginPreview('insomnia-plugin-test', false);
    expect(preview.publisher).toBeUndefined();
  });

  // ─── Sanity: correct metadata still flows through ─────────────────────────

  it('returns correct name, version, dist fields, and tarballHostAllowed', async () => {
    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(preview.name).toBe('insomnia-plugin-test');
    expect(preview.version).toBe('1.0.0');
    expect(preview.dist.shasum).toBe('abc123');
    expect(preview.dist.tarball).toBe(
      'https://registry.npmjs.org/insomnia-plugin-test/-/insomnia-plugin-test-1.0.0.tgz',
    );
    expect(preview.tarballHostAllowed).toBe(true);
  });

  it('sets tarballHostAllowed to false for a tarball on an off-allowlist host', async () => {
    execFilePromiseMock.mockResolvedValue(
      yarnInfoPayload({
        ...BASE_PLUGIN_DATA,
        dist: {
          shasum: 'abc123',
          tarball: 'https://custom-registry.example.com/pkg/-/pkg-1.0.0.tgz',
          integrity: 'sha512-abc',
        },
      }),
    );
    // DNS resolves to a public IP — not loopback, so SSRF guard passes.
    dnsLookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    const preview = await getPluginPreview('insomnia-plugin-test', false);

    expect(preview.tarballHostAllowed).toBe(false);
  });
});
