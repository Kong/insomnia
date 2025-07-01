import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const bundlePlugins = ['@kong-insomnia/plugin-poc-external-vault@0.0.1-alpha.1'];
const bundlePluginsDir = path.resolve(__dirname, '..', 'plugins');
const yarnPath = path.resolve(__dirname, '..', 'bin', 'yarn-standalone.js');
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const PLUGIN_NPM_REGISTRY = process.env.PLUGIN_NPM_REGISTRY || NPM_REGISTRY;
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
      console.log('[Bundle Plugin] Failed to bundle plugins:', err);
      if (process.env.GITHUB_ACTIONS === 'true') {
        // execute in Github Actions
        process.exit(1);
      } else {
        process.exit(0);
      }
    }
  });
}

export async function runYarnCommand(args: string[], cwd?: string) {
  const { stdout, stderr } = await execFilePromise(process.execPath, ['--no-deprecation', yarnPath, ...args], {
    cwd,
    env: {
      NODE_ENV: 'production',
      PLUGIN_NPM_REGISTRY: process.env.PLUGIN_NPM_REGISTRY || 'https://registry.npmjs.org/',
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
  const { scope, name: pluginName } = parsePackageName(name);
  const pluginDir = path.resolve(bundlePluginsDir, pluginName);
  // Ensure the plugin directory exists
  await mkdir(pluginDir, { recursive: true });
  let tmpDir = '';

  try {
    // Install the plugin into a temporary directory
    tmpDir = await installPluginToTmpDir(name);
    console.log(`[[Bundle Plugin]] Moving plugin from temp directory ${tmpDir} to final plugin directory ${pluginDir}`);

    // Handle the plugin's dependencies
    // Create a node_modules directory inside the plugin directory
    const pluginModulesDir = path.resolve(pluginDir, 'node_modules');
    await mkdir(pluginModulesDir, { recursive: true });

    // Read all folders/files in the temp directory
    const tmpFiles = await readdir(tmpDir);
    console.log(`[[Bundle Plugin]] Moving plugin from temp directory ${tmpDir} to final plugin directory ${pluginDir}`);

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
    console.error(`[Bundle Plugin] Failed to install plugin ${pluginName}: ${error.toString()}`);
    throw error;
  } finally {
    // Ensure the temporary directory is cleaned up
    if (tmpDir) {
      try {
        console.log(`[[Bundle Plugin]] Cleaning up temporary directory: ${tmpDir}`);
        await rm(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`[[Bundle Plugin]] Failed to clean tmp dir ${tmpDir}: ${error.toString()}`);
      }
    }
  }
}

/**
 * Installs a plugin into a temporary directory using Yarn.
 * Creates a minimal package.json and downloads the dependency.
 */
export async function installPluginToTmpDir(name: string) {
  const { scope, name: pluginName } = parsePackageName(name);
  try {
    const tmpDir = await mkdtemp(path.resolve(tmpdir(), `${pluginName}-${Date.now()}`));
    const yarnrcPath = path.resolve(tmpDir, '.yarnrc');

    await writeFile(
      path.resolve(tmpDir, 'package.json'),
      JSON.stringify({ license: 'ISC', workspaces: [] }, null, 2),
      'utf-8',
    );
    // Generate the yarnrc file in the temporary directory
    await writeFile(
      yarnrcPath,
      `registry "${NPM_REGISTRY}"\n"@kong-insomnia:registry" "${PLUGIN_NPM_REGISTRY}"\n`,
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
        '--use-yarnrc',
        yarnrcPath,
      ],
      tmpDir,
    );

    // Check if the plugin was installed successfully
    const pluginDir = path.resolve(tmpDir, scope || pluginName);
    const pluginExists = await stat(pluginDir)
      .then(() => true)
      .catch(() => false);
    if (!pluginExists) {
      throw new Error(`[Bundle Plugin] "${name}" not found in temporary directory`);
    }

    console.log(`[[Bundle Plugin]] Plugin installed successfully in temp dir: ${tmpDir}`);

    // Check if the plugin has a package.json file
    const packageJsonPath = path.resolve(tmpDir, scope || '', pluginName, 'package.json');
    console.log(packageJsonPath);
    const packageJsonExists = await stat(packageJsonPath)
      .then(() => true)
      .catch(() => false);

    if (!packageJsonExists) {
      throw new Error(`[Bundle Plugin] Plugin "${name}" does not have a package.json file`);
    }

    return tmpDir;
  } catch (err) {
    throw new Error(`[Bundle Plugin] Failed to install plugin: ${(err as Error).message}`);
  }
}

function parsePackageName(name: string) {
  const regex = /^(@[^\/]+\/)?([^@]+)(?:@(.+))?$/;
  const match = name.match(regex);
  if (!match) {
    throw new Error(`[[Bundle Plugin]] Invalid package name: ${name}`);
  }
  return {
    scope: match[1] ? match[1].slice(0, -1) : null, // remove trailing slash
    name: match[2],
    version: match[3] || null,
  };
}
