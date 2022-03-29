import { writeFileSync } from 'fs';
import path from 'path';

import appConfig from '../config/config.json';

// Start build if ran from CLI
if (require.main === module) {
  process.nextTick(async () => {
    try {
      await module.exports.start();
    } catch (err) {
      console.log('[build] ERROR:', err);
      process.exit(1);
    }
  });
}

export const start = async () => {
  // Used to overwrite the app version entirely for release builds
  let appVersionOverride = process.env.APP_VERSION;
  // Used to append a build ref to the end of an existing app version for non-release builds
  const buildRef = process.env.BUILD_REF;
  if (buildRef) {
    // Ignore any existing semver prerelease/build tags
    const cleanedVersion = appConfig.version.match(/^(\d{4}\.\d+\.\d)/);
    if (!cleanedVersion) {
      console.log('[build] Invalid version found in app config');
      process.exit(1);
    }

    appVersionOverride = `${cleanedVersion[1]}-dev+${buildRef}`;
  }

  if (!appVersionOverride) {
    console.log('[build] Missing app version override, please ensure the environment variables APP_VERSION or BUILD_REF are set correctly.');
    process.exit(1);
  }

  console.log('Overwriting app config version:', appVersionOverride);
  appConfig.version = appVersionOverride;
  writeFileSync(path.resolve(__dirname, '../config/config.json'), JSON.stringify(appConfig, null, 2) + '\n');
};
