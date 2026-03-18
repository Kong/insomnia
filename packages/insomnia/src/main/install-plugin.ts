import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { app, net } from 'electron';

import { services } from '~/insomnia-data';
import { SegmentEvent, trackSegmentEvent } from '~/main/analytics';

import { isDevelopment } from '../common/constants';
import { validatePluginName } from '../utils/plugin';

// Promisified version of execFile to use async/await
export const execFilePromise = promisify(execFile);

// Allowed tarball hostnames for security
// This is a security measure to prevent downloading from untrusted sources
// and to ensure that the tarball is from a known source.
// The list can be expanded as needed, but should be kept minimal for security.
// Currently, only npmjs.org and GitHub Packages are allowed.
const allowedTarballHostnames = ['registry.npmjs.org', 'npm.pkg.github.com'];

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
  };
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

    // Step 3: Ensure the plugin tarball can be fetched
    try {
      // After fetching info, check the info.dist.tarball. This prevents downloading from weird hosts.
      const tarballUrl = new URL(info.dist.tarball);
      if (!allowedTarballHostnames.includes(tarballUrl.hostname)) {
        throw new Error(`Tarball must come from an allowed host. Got: ${tarballUrl.hostname}`);
      }

      // Fetch the tarball to ensure it's accessible
      // This is a simple check to ensure the tarball URL is valid and accessible
      const tarballResponse = await net.fetch(info.dist.tarball);

      // Check if the response is OK (status code 200)
      if (!tarballResponse.ok) {
        throw new Error(`Failed to fetch tarball: ${tarballResponse.statusText}`);
      }
    } catch (err: any) {
      throw new Error(`Failed to fetch plugin tarball ${info.dist.tarball}: ${err.message}`);
    }

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

    trackSegmentEvent(SegmentEvent.installPlugin, {
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
export async function getPluginInfo(lookupName: string, allowScopedPackageNames = false) {
  const validationError = validatePluginName(lookupName, allowScopedPackageNames);

  if (validationError) {
    throw new Error(validationError);
  }

  console.log('[plugins] Fetching module info from npm');

  const stdout = await runYarnCommand(['info', lookupName, '--json', '--registry', 'https://registry.npmjs.org/']);

  let yarnOutput;
  try {
    yarnOutput = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Invalid JSON received from yarn: ${(err as Error).message}`);
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
    },
  };
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
        'https://registry.npmjs.org/',
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
