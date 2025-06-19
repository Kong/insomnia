import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const bundlePlugins = ['@kenttest/plugin-external-vault'];
const bundlePluginsDir = path.resolve(__dirname, '..', 'plugins');
const yarnPath = path.resolve(__dirname, '..', 'bin', 'yarn-standalone.js');
const execFilePromise = promisify(execFile);

if (require.main === module) {
  process.nextTick(async () => {
    try {
      // remove existing bundle plugins directory
      await rm(bundlePluginsDir, { recursive: true, force: true });
      // Recreate empty
      await mkdir(bundlePluginsDir, { recursive: true });
      for (const bundlePlugin of bundlePlugins) {
        await installPlugin(bundlePlugin);
      }
    } catch (err) {
      console.log('[bundle-plugin] ERROR:', err);
      process.exit(1);
    }
  });
}

export async function runYarnCommand(args: string[], cwd?: string) {
  const { stdout, stderr } = await execFilePromise(process.execPath, ['--no-deprecation', yarnPath, ...args], {
    cwd,
    env: {
      NODE_ENV: 'production',
    },
    timeout: 5 * 60 * 1000, // 5 minutes
    maxBuffer: 1024 * 1024, // 1MB buffer
  });

  if (stderr) {
    throw new Error(`Yarn error: ${stderr}`);
  }

  return stdout.toString();
}

export default async function installPlugin(name: string) {
  const { scope, pkg: pluginName } = parsePackageName(name);
  const pluginDir = path.resolve(bundlePluginsDir, pluginName);
  // Ensure the plugin directory exists
  await mkdir(pluginDir, { recursive: true });
  let tmpDir = '';

  try {
    // Install the plugin into a temporary directory
    tmpDir = await installPluginToTmpDir(name);
    console.log(`[plugins] Moving plugin from temp directory ${tmpDir} to final plugin directory ${pluginDir}`);

    // Handle the plugin's dependencies
    // Create a node_modules directory inside the plugin directory
    const pluginModulesDir = path.resolve(pluginDir, 'node_modules');
    await mkdir(pluginModulesDir, { recursive: true });

    // Read all folders/files in the temp directory
    const tmpFiles = await readdir(tmpDir);
    console.log(`[plugins] Moving plugin from temp directory ${tmpDir} to final plugin directory ${pluginDir}`);

    // Move the main plugin folder into the plugin directory
    await cp(path.resolve(tmpDir, scope || '', pluginName), pluginDir, {
      recursive: true,
      verbatimSymlinks: true,
    });

    // Filter out the main plugin directory and non-directories
    // and copy each directory to the plugin's node_modules directory
    // Use Promise.all to copy all directories in parallel
    const filtered = await Promise.all(
      tmpFiles.map(async filename => {
        const fullPath = path.resolve(tmpDir, filename);
        const fileStat = await stat(fullPath);
        return {
          filename,
          include: filename !== (scope || pluginName) && filename !== 'node_modules' && fileStat.isDirectory(),
        };
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
  } catch (error) {
    console.error(`Failed to install plugin ${pluginName}:`, error);
    throw error;
  } finally {
    // Ensure the temporary directory is cleaned up
    if (tmpDir) {
      try {
        console.log(`[plugins] Cleaning up temporary directory: ${tmpDir}`);
        await rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[plugins] Failed to clean tmp dir ${tmpDir}:`, error);
      }
    }
  }
}

/**
 * Installs a plugin into a temporary directory using Yarn.
 * Creates a minimal package.json and downloads the dependency.
 */
export async function installPluginToTmpDir(name: string) {
  const { scope, pkg: pluginName } = parsePackageName(name);
  try {
    const tmpDir = await mkdtemp(path.resolve(tmpdir(), `${pluginName}-${Date.now()}`));

    await writeFile(
      path.resolve(tmpDir, 'package.json'),
      JSON.stringify({ license: 'ISC', workspaces: [] }, null, 2),
      'utf-8',
    );

    console.log(`[plugins] Installing plugin into temp dir: ${tmpDir}`);

    await runYarnCommand(
      [
        'add',
        name,
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
    const pluginDir = path.resolve(tmpDir, scope || pluginName);
    const pluginExists = await stat(pluginDir)
      .then(() => true)
      .catch(() => false);
    if (!pluginExists) {
      throw new Error(`Plugin "${name}" not found in temporary directory`);
    }

    console.log(`[plugins] Plugin installed successfully in temp dir: ${tmpDir}`);

    // Check if the plugin has a package.json file
    const packageJsonPath = path.resolve(tmpDir, scope || '', pluginName, 'package.json');
    const packageJsonExists = await stat(packageJsonPath)
      .then(() => true)
      .catch(() => false);

    if (!packageJsonExists) {
      throw new Error(`Plugin "${name}" does not have a package.json file`);
    }

    return tmpDir;
  } catch (err) {
    throw new Error(`Failed to install plugin: ${(err as Error).message}`);
  }
}

function parsePackageName(name: string) {
  if (name.startsWith('@')) {
    const [scope, pkg] = name.split('/');
    return { scope, pkg };
  }
  return { scope: null, pkg: name };
}
