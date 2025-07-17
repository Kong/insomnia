// scripts/bundle-plugins.ts
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const appPluginDir = resolve(__dirname, '../../../insomnia/plugins');
const insoPluginDir = resolve(__dirname, '../../plugins');

const insoBundlePlugin = async () => {
  try {
    // remove existing bundle plugins directory
    await rm(insoPluginDir, { recursive: true, force: true });
    // Recreate empty
    await mkdir(insoPluginDir, { recursive: true });
    // Check if app plugin directory exists
    if (!existsSync(appPluginDir)) {
      console.log(`Source plugins directory not found at ${appPluginDir}. Creating and bundle plugins`);

      execSync('npm run bundle-plugins', {
        stdio: 'inherit',
        cwd: resolve(appPluginDir, '../'),
      });
    }
    // Copy plugins from app to inso directory
    console.log(`Copying plugins from ${appPluginDir} to ${insoPluginDir}`);
    await cp(appPluginDir, insoPluginDir, {
      recursive: true,
    });
  } catch (err) {
    console.log('[bundle-plugin] ERROR:', err);
    process.exit(1);
  }
};

insoBundlePlugin();
