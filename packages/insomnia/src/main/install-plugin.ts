import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { app, net } from 'electron';
import { services } from 'insomnia-data';

import { AnalyticsEvent, trackAnalyticsEvent } from '~/main/analytics';

import { isDevelopment } from '../common/constants';
import { assertNotLoopbackUrl, isLoopbackHost } from '../common/private-host';
import { validatePluginName } from '../utils/plugin-name';

// Promisified version of execFile to use async/await
export const execFilePromise = promisify(execFile);

// Default allowed tarball hostnames for security
// This is a security measure to prevent downloading from untrusted sources
// and to ensure that the tarball is from a known source.
// The list can be expanded as needed, but should be kept minimal for security.
// Currently, only npmjs.org and GitHub Packages are allowed.
const defaultAllowedTarballHostnames = ['registry.npmjs.org', 'npm.pkg.github.com'];

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/';

interface InsomniaPlugin {
  // Insomnia attribute from package.json
  insomnia: {
    name: string;
    displayName: string;
    description: string;

    // Used by the plugin hub, not currently used by Insomnia
    // Each image is relative to package root
    images?: {
      icon?: string;
      cover?: string;
    };

    unlisted?: boolean;

    publisher?: {
      name: string;
      // absolute URL
      icon: string;
    };
  };

  // NPM specific properties
  name: string;
  version: string;
  dist: {
    shasum: string;
    tarball: string;
    // Immutable, verifiable characteristics surfaced for the install review page
    integrity?: string;
    unpackedSize?: number;
    fileCount?: number;
  };
  dependencies: Record<string, string>;
  // Email of the package author/publisher, used to derive a Gravatar profile image.
  authorEmail?: string;
}

/**
 * Extracts an email address from an npm "author"/"maintainer" field, which may be an object
 * ({ name, email }) or a string ("Name <email> (url)").
 */
function extractEmail(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'object' && 'email' in value && typeof (value as any).email === 'string') {
    return (value as any).email;
  }
  if (typeof value === 'string') {
    const match = value.match(/<([^>]+)>/);
    return match?.[1];
  }
  return undefined;
}

/**
 * Builds the author's Gravatar URL from their email (the same image npm shows, which it proxies via
 * /npm-avatar). Uses d=404 so packages whose author has no Gravatar fall back to our own icon
 * instead of a generated placeholder. Returns undefined when no author email is available.
 */
function gravatarUrlFromEmail(email?: string): string | undefined {
  if (!email) {
    return undefined;
  }
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=128&d=404`;
}

/**
 * Install an Insomnia plugin by name.
 * allowScopedPackageNames - If true, allows scoped package names (e.g., @scope/plugin).
 * This is something we might want to support in the future, but for now, we don't.
 * @param pluginName - The npm package name of the plugin to install
 */
export default async function installPlugin(pluginName: string, allowScopedPackageNames = false): Promise<void> {
  const validationError = validatePluginName(pluginName, allowScopedPackageNames);

  if (validationError) {
    throw new Error(validationError);
  }

  let tmpDir = '';

  try {
    // Step 1: Validate the plugin and fetch its npm metadata
    const info: InsomniaPlugin = await getPluginInfo(pluginName, allowScopedPackageNames);

    // Get the normalized module name (without version suffixes)
    const moduleName = info.name;

    // Check the module name for any invalid characters
    // This is a basic validation to ensure the module name is safe
    // and doesn't contain any unexpected characters.
    const validationError = validatePluginName(moduleName, allowScopedPackageNames);

    if (validationError) {
      throw new Error(validationError);
    }

    // Determine the target plugin installation directory
    const userDataPath = process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');
    const pluginDir = path.resolve(userDataPath, 'plugins', moduleName);

    console.log(`[plugins] Installing plugin ${moduleName} to ${pluginDir}`);

    // Step 2: Create the plugin directory if it doesn't exist
    await mkdir(pluginDir, { recursive: true });

    if (!info.dist?.tarball) {
      throw new Error('Invalid plugin metadata: missing tarball URL');
    }

    // Step 3: Validate the tarball host against the allowlist and check for DNS rebinding before
    // handing off to Yarn. Yarn resolves and downloads the tarball itself (the original install
    // path); we don't pre-fetch it — that would break on registries that redirect .tgz downloads.
    await assertTarballUrlAllowed(info.dist.tarball);

    // Step 4: Install the plugin into a temporary directory
    tmpDir = await installPluginToTmpDir(pluginName, allowScopedPackageNames);
    console.log(`[plugins] Moving plugin from temp directory ${tmpDir} to final plugin directory ${pluginDir}`);

    // Step 5: Move the main plugin folder into the plugin directory
    await cp(path.resolve(tmpDir, moduleName), pluginDir, {
      recursive: true,
      verbatimSymlinks: true,
    });

    // Step 6: Handle the plugin's dependencies
    // Create a node_modules directory inside the plugin directory
    const pluginModulesDir = path.resolve(pluginDir, 'node_modules');
    await mkdir(pluginModulesDir, { recursive: true });

    // Read all folders/files in the temp directory
    const tmpFiles = await readdir(tmpDir);

    // Filter out the main plugin directory and non-directories
    // and copy each directory to the plugin's node_modules directory
    // Use Promise.all to copy all directories in parallel
    const filtered = await Promise.all(
      tmpFiles.map(async filename => {
        const fullPath = path.resolve(tmpDir, filename);
        const fileStat = await stat(fullPath);
        return { filename, include: filename !== moduleName && fileStat.isDirectory() };
      }),
    );

    await Promise.all(
      filtered
        .filter(f => f.include)
        .map(async ({ filename }) => {
          const src = path.resolve(tmpDir, filename);
          const dest = path.resolve(pluginModulesDir, filename);
          await cp(src, dest, { recursive: true, verbatimSymlinks: true });
        }),
    );

    trackAnalyticsEvent(AnalyticsEvent.installPlugin, {
      pluginName: moduleName,
      pluginVersion: info.version,
    });
  } catch (err) {
    // Log and rethrow any installation errors
    console.error(`[plugins] Failed to install plugin ${pluginName}:`, err);
    throw err;
  } finally {
    // Ensure the temporary directory is cleaned up
    if (tmpDir) {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[plugins] Failed to clean tmp dir ${tmpDir}:`, error);
      }
    }
  }
}

/**
 * Executes a Yarn command safely inside the app.
 * Handles environment setup, timeout, and stderr validation.
 */
export async function runYarnCommand(args: string[], cwd?: string) {
  const yarnPath = await getYarnPath();

  const { stdout, stderr } = await execFilePromise(process.execPath, ['--no-deprecation', yarnPath, ...args], {
    cwd,
    env: await getYarnEnvValues(),
    timeout: 5 * 60 * 1000, // 5 minutes
    maxBuffer: 1024 * 1024, // 1MB buffer
  });

  if (stderr && !containsOnlyDeprecationWarnings(stderr)) {
    throw new Error(`Yarn error: ${stderr}`);
  }

  return stdout.toString();
}

/**
 * Checks if the given npm package is an Insomnia plugin.
 * Verifies that the package contains an "insomnia" attribute.
 */
export async function getPluginInfo(lookupName: string, allowScopedPackageNames = false): Promise<InsomniaPlugin> {
  const validationError = validatePluginName(lookupName, allowScopedPackageNames);

  if (validationError) {
    throw new Error(validationError);
  }

  console.log('[plugins] Fetching module info from npm');

  const registryUrl = await getRegistryUrl();
  let stdout: string;
  try {
    stdout = await runYarnCommand(['info', lookupName, '--json', '--registry', registryUrl]);
  } catch (err) {
    // Yarn writes a JSON error object to stderr when the package doesn't exist on the registry.
    // Parse it and surface a readable message instead of the raw JSON string.
    const raw = err instanceof Error ? err.message : String(err);
    const match = raw.match(/\{.*\}/s);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed?.type === 'error') {
          const detail: string = parsed.data ?? '';
          if (/invalid response|not found|404|does not exist/i.test(detail)) {
            throw new Error(`Plugin "${lookupName}" was not found on the registry.`);
          }
        }
      } catch (innerErr) {
        if (innerErr instanceof Error && innerErr.message.startsWith('Plugin "')) {
          throw innerErr;
        }
      }
    }
    throw err;
  }

  let yarnOutput;
  try {
    yarnOutput = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Invalid JSON received from yarn: ${(err as Error).message}`);
  }

  // Yarn can also surface errors via stdout JSON (type: 'error') for some registry failures.
  if (yarnOutput?.type === 'error') {
    const detail: string = yarnOutput.data ?? '';
    if (/invalid response|not found|404|does not exist/i.test(detail)) {
      throw new Error(`Plugin "${lookupName}" was not found on the registry.`);
    }
    throw new Error(detail || 'Unknown yarn error');
  }

  const data = yarnOutput.data;
  if (!data || typeof data !== 'object') {
    throw new Error(`Unexpected yarn output structure`);
  }

  if (!data.insomnia) {
    throw new Error(`Package "${lookupName}" is not an Insomnia plugin (missing "insomnia" attribute)`);
  }

  return {
    insomnia: data.insomnia,
    name: data.name,
    version: data.version,
    dist: {
      shasum: data.dist.shasum,
      tarball: data.dist.tarball,
      integrity: data.dist.integrity,
      unpackedSize: data.dist.unpackedSize,
      fileCount: data.dist.fileCount,
    },
    dependencies: data.dependencies ?? {},
    authorEmail:
      extractEmail(data.author) ||
      extractEmail(data._npmUser) ||
      (Array.isArray(data.maintainers) ? extractEmail(data.maintainers[0]) : undefined),
  };
}

/**
 * Immutable, verifiable characteristics of the package that would be installed, surfaced to the
 * renderer so the user can review exactly what will land on disk before accepting the install.
 */
export interface PluginPreview {
  // Exact resolved npm package name (what actually gets installed)
  name: string;
  // From the package's "insomnia" attribute - treated as untrusted plain text in the UI
  displayName?: string;
  description?: string;
  // Raw README markdown - sanitized in the renderer via markdownToHTML (DOMPurify)
  readme?: string;
  version: string;
  publisher?: {
    name: string;
    icon?: string;
  };
  // Author's Gravatar profile image URL (d=404, so it fails over to the UI's fallback icon when the
  // author has no Gravatar). Undefined when no author email is published.
  avatarUrl?: string;
  npmUrl: string;
  dist: {
    shasum: string;
    integrity?: string;
    tarball: string;
    unpackedSize?: number;
    fileCount?: number;
  };
  dependencies: Record<string, string>;
  // Whether the tarball host is on the install allowlist; if false the UI must disable install.
  tarballHostAllowed: boolean;
  // Best-effort npm stats for the review screen (any may be undefined if unavailable).
  downloads?: number;
  releaseDate?: string;
  lastUpdatedAt?: string;
}

/**
 * Fetches and verifies a plugin's npm metadata WITHOUT installing anything. Used by the install
 * review page to display what would be installed. Performs the same SSRF/allowlist checks the real
 * install does, but never touches the filesystem.
 */
export async function getPluginPreview(lookupName: string, allowScopedPackageNames = false): Promise<PluginPreview> {
  const validationError = validatePluginName(lookupName, allowScopedPackageNames);
  if (validationError) {
    throw new Error(validationError);
  }

  const info = await getPluginInfo(lookupName, allowScopedPackageNames);

  if (!info.dist?.tarball) {
    throw new Error('Invalid plugin metadata: missing tarball URL');
  }

  // Reject tarballs that resolve to the user's own machine (SSRF), incl. DNS rebinding.
  await assertNotLoopbackUrl(info.dist.tarball);

  const allowedTarballHostnames = await getAllowedTarballHostnames();
  const tarballHostAllowed = allowedTarballHostnames.includes(new URL(info.dist.tarball).hostname);

  const registryUrl = await getRegistryUrl();

  // README, publish times, and download counts are all best-effort extras for the review screen;
  // fetch them in parallel and tolerate any of them being unavailable.
  const [readme, time, downloads] = await Promise.all([
    fetchPackageReadme(lookupName, registryUrl),
    fetchPackageTimes(lookupName, registryUrl),
    fetchMonthlyDownloads(info.name),
  ]);

  return {
    name: info.name,
    displayName: info.insomnia?.displayName,
    description: info.insomnia?.description,
    readme,
    version: info.version,
    publisher: info.insomnia?.publisher,
    avatarUrl: gravatarUrlFromEmail(info.authorEmail),
    npmUrl: `https://www.npmjs.com/package/${info.name}`,
    dist: {
      shasum: info.dist.shasum,
      integrity: info.dist.integrity,
      tarball: info.dist.tarball,
      unpackedSize: info.dist.unpackedSize,
      fileCount: info.dist.fileCount,
    },
    dependencies: info.dependencies,
    tarballHostAllowed,
    downloads,
    releaseDate: time?.created,
    lastUpdatedAt: time?.modified,
  };
}

/** Best-effort fetch of a package's README markdown (older packages may not publish one). */
async function fetchPackageReadme(lookupName: string, registryUrl: string): Promise<string | undefined> {
  try {
    const stdout = await runYarnCommand(['info', lookupName, 'readme', '--json', '--registry', registryUrl]);
    const parsed = JSON.parse(stdout);
    return typeof parsed?.data === 'string' ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Best-effort fetch of a package's publish times ({ created, modified } from the registry). */
async function fetchPackageTimes(
  lookupName: string,
  registryUrl: string,
): Promise<{ created?: string; modified?: string } | undefined> {
  try {
    const stdout = await runYarnCommand(['info', lookupName, 'time', '--json', '--registry', registryUrl]);
    const parsed = JSON.parse(stdout);
    const time = parsed?.data;
    if (time && typeof time === 'object') {
      return { created: time.created, modified: time.modified };
    }
  } catch {
    // Times unavailable.
  }
  return undefined;
}

/** Best-effort fetch of last-month download count from the public npm downloads API. */
async function fetchMonthlyDownloads(packageName: string): Promise<number | undefined> {
  try {
    const res = await net.fetch(`https://api.npmjs.org/downloads/point/last-month/${packageName}`, { redirect: 'error' });
    if (!res.ok) {
      return undefined;
    }
    const json = await res.json();
    return typeof json?.downloads === 'number' ? json.downloads : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Installs a plugin into a temporary directory using Yarn.
 * Creates a minimal package.json and downloads the dependency.
 */
export async function installPluginToTmpDir(lookupName: string, allowScopedPackageNames = false) {
  const validationError = validatePluginName(lookupName, allowScopedPackageNames);

  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const tmpDir = await mkdtemp(path.resolve(tmpdir(), `${lookupName.replace('/', '-')}-${Date.now()}`));

    await writeFile(
      path.resolve(tmpDir, 'package.json'),
      JSON.stringify({ license: 'ISC', workspaces: [] }, null, 2),
      'utf8',
    );

    console.log(`[plugins] Installing plugin into temp dir: ${tmpDir}`);

    const registryUrl = await getRegistryUrl();
    await runYarnCommand(
      [
        'add',
        lookupName,
        '--modules-folder',
        tmpDir,
        '--cwd',
        tmpDir,
        '--no-lockfile',
        '--production',
        '--no-progress',
        '--ignore-workspace-root-check',
        '--registry',
        registryUrl,
      ],
      tmpDir,
    );

    // Check if the plugin was installed successfully
    const pluginDir = path.resolve(tmpDir, lookupName);
    const pluginExists = await stat(pluginDir)
      .then(() => true)
      .catch(() => false);
    if (!pluginExists) {
      throw new Error(`Plugin "${lookupName}" not found in temporary directory`);
    }

    console.log(`[plugins] Plugin installed successfully in temp dir: ${tmpDir}`);

    // Check if the plugin has a package.json file
    const packageJsonPath = path.resolve(pluginDir, 'package.json');
    const packageJsonExists = await stat(packageJsonPath)
      .then(() => true)
      .catch(() => false);

    if (!packageJsonExists) {
      throw new Error(`Plugin "${lookupName}" does not have a package.json file`);
    }

    return tmpDir;
  } catch (err) {
    throw new Error(`Failed to install plugin: ${(err as Error).message}`);
  }
}

/**
 * Resolves and validates the path to the standalone Yarn binary.
 * Ensures no symlinks and the path is within the app folder.
 */
export async function getYarnPath() {
  const SAFE_APP_BASE = path.resolve(__dirname, '..');

  const appPath = app.getAppPath();
  const resolvedAppPath = path.resolve(appPath);

  // Validate app path is safe
  if (!resolvedAppPath.startsWith(SAFE_APP_BASE)) {
    throw new Error('Unsafe app path detected.');
  }

  const yarnPath = isDevelopment()
    ? path.resolve(resolvedAppPath, './bin/yarn-standalone.js')
    : path.resolve(resolvedAppPath, '../bin/yarn-standalone.js');

  if (!yarnPath.startsWith(SAFE_APP_BASE)) {
    throw new Error('Unsafe yarn path detected.');
  }

  // Ensure file exists and is not a symlink
  try {
    const stats = await lstat(yarnPath);

    if (stats.isSymbolicLink()) {
      throw new Error('yarn-standalone.js is a symlink, refusing to use it.');
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(`yarn-standalone.js not found at expected location: ${yarnPath}`);
    }
    throw err;
  }

  return yarnPath;
}

/**
 * Checks if the Yarn stderr output only contains deprecation warnings.
 */
export function containsOnlyDeprecationWarnings(output: string): boolean {
  const MAX_LINES = 20;
  const MAX_LINE_LENGTH = 300;

  if (!output) return true;

  if (hasUnexpectedBinaryData(output)) {
    return false; // Contains unexpected binary data
  }

  const lines = output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length > MAX_LINES) {
    return false;
  }

  const deprecationPatterns = [
    /^warning:.*deprecated/i,
    /^deprecated:/i,
    /this feature is deprecated/i,
    /will be removed/i,
    /deprecation warning/i,
  ];

  return lines.every(line => {
    if (line.length > MAX_LINE_LENGTH) return false;
    return deprecationPatterns.some(pattern => pattern.test(line));
  });
}

/**
 * Checks for unexpected binary characters in a string output.
 * Only printable ASCII characters, tabs, CR, and LF are allowed.
 */
export function hasUnexpectedBinaryData(output: string): boolean {
  for (let i = 0; i < output.length; i++) {
    const code = output.codePointAt(i);
    if (code && !(code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e))) {
      return true;
    }
  }
  return false;
}

/**
 * Trims a string safely.
 * Returns undefined if input is not a string or becomes empty after trimming.
 */
export function safeTrim(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

/**
 * Constructs the environment variables needed for running Yarn.
 * Pulls settings from the application models.
 */
export async function getYarnEnvValues(): Promise<Record<string, string>> {
  const settings = await services.settings.get();

  const yarnEnv: Record<string, string> = {
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: 'true',
  };

  // Add extra certificates if defined
  const extraCerts = safeTrim(settings.pluginNodeExtraCerts);
  if (extraCerts) {
    yarnEnv.NODE_EXTRA_CA_CERTS = extraCerts;
  }

  // Add proxy settings if enabled
  if (settings.proxyEnabled === true) {
    Object.assign(yarnEnv, buildProxyEnv(settings));
  }

  if (isDevelopment()) {
    const NODE_AUTH_TOKEN = process.env['NODE_AUTH_TOKEN'];
    // In development, set a default NODE_AUTH_TOKEN for .npmrc if not exists
    yarnEnv.NODE_AUTH_TOKEN = NODE_AUTH_TOKEN || 'PLACEHOLDER_TOKEN_VALUE';
  }

  return yarnEnv;
}

/**
 * Builds proxy-related environment variables from settings.
 */
export function buildProxyEnv(settings: any): Record<string, string> {
  const proxyEnv: Record<string, string> = {};

  const httpProxy = safeTrim(settings.httpProxy);
  if (httpProxy) {
    proxyEnv.HTTP_PROXY = httpProxy;
  }

  const httpsProxy = safeTrim(settings.httpsProxy);
  if (httpsProxy && isValidProxyUrl(httpsProxy)) {
    proxyEnv.HTTPS_PROXY = httpsProxy;
  }

  const noProxy = safeTrim(settings.noProxy);
  if (noProxy) {
    proxyEnv.NO_PROXY = noProxy;
  }

  return proxyEnv;
}

/**
 * Returns the npm registry URL from settings, falling back to the default.
 */
export async function getRegistryUrl(): Promise<string> {
  const settings = await services.settings.get();
  const customRegistry = safeTrim(settings.npmRegistryUrl);
  if (customRegistry) {
    // Validate it's a proper URL
    try {
      const parsed = new URL(customRegistry);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        console.warn(`[plugins] npmRegistryUrl must be http/https, got "${parsed.protocol}", using default`);
        return DEFAULT_NPM_REGISTRY;
      }
      // Reject a registry pointing at the user's own machine (SSRF). Private LAN addresses are
      // intentionally allowed so internal company registries keep working.
      if (isLoopbackHost(parsed.hostname)) {
        console.warn(`[plugins] npmRegistryUrl must not target a loopback host "${parsed.hostname}", using default`);
        return DEFAULT_NPM_REGISTRY;
      }
    } catch {
      console.warn(`[plugins] Invalid npmRegistryUrl "${customRegistry}", using default`);
      return DEFAULT_NPM_REGISTRY;
    }
    // Ensure trailing slash for consistency
    return customRegistry.endsWith('/') ? customRegistry : customRegistry + '/';
  }
  return DEFAULT_NPM_REGISTRY;
}

/**
 * Returns the list of allowed tarball hostnames, including the custom registry hostname if configured.
 */
export async function getAllowedTarballHostnames(): Promise<string[]> {
  const settings = await services.settings.get();
  const customRegistry = safeTrim(settings.npmRegistryUrl);
  if (customRegistry) {
    try {
      const registryHostname = new URL(customRegistry).hostname;
      if (!defaultAllowedTarballHostnames.includes(registryHostname)) {
        return [...defaultAllowedTarballHostnames, registryHostname];
      }
    } catch {
      // Invalid URL, just use defaults
    }
  }
  return defaultAllowedTarballHostnames;
}

/**
 * Throws unless the given tarball URL is both on the host allowlist and does not resolve to a
 * loopback address (re-resolving DNS to defend against rebinding). Used to gate the actual download
 * in installPlugin. Call this immediately before each network use and re-check the final response
 * URL so a redirect/rebinding cannot land on an unvalidated host.
 */
export async function assertTarballUrlAllowed(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const allowedTarballHostnames = await getAllowedTarballHostnames();
  if (!allowedTarballHostnames.includes(url.hostname)) {
    throw new Error(`Tarball must come from an allowed host. Got: ${url.hostname}`);
  }
  // Private LAN addresses are intentionally allowed (e.g. internal company registries).
  await assertNotLoopbackUrl(rawUrl);
}

/**
 * Validates that a given string is a well-formed URL.
 */
export function isValidProxyUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
