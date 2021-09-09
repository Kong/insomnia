// TODO(TSCONVERSION) not entirely sure if this can be in TypeScript or not.  If so, need to convert.
const fs = require('fs');
const path = require('path');
const electronNotarize = require('electron-notarize');
const appConfig = require('../config/config.json');

// See: https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db
module.exports = async function(params) {
  // Only notarize the app on Mac OS only.
  if (process.platform !== 'darwin') {
    return;
  }

  // Same appId in electron-builder.
  const { appId } = appConfig;

  const appName = `${params.packager.appInfo.productFilename}.app`;
  const appPath = path.join(params.appOutDir, appName);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appName}`);
  }

  if (!process.env.APPLE_ID) {
    console.log('[aftersign] APPLE_ID env variable not set. Skipping notarization');
    return;
  }

  if (!process.env.APPLE_ID_PASSWORD) {
    console.log('[aftersign] APPLE_ID env variable not set. Skipping notarization');
    return;
  }

  const args = {
    appBundleId: appId,
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  };

  console.log(`[afterSign] Notarizing ${appName} (${appId})`);

  try {
    await electronNotarize.notarize(args);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
