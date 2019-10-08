const fs = require('fs');
const path = require('path');
const electronNotarize = require('electron-notarize');
const packageJson = require('../package.json');

// See: https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db
module.exports = async function(params) {
  // Only notarize the app on Mac OS only.
  if (process.platform !== 'darwin') {
    return;
  }

  // Same appId in electron-builder.
  const { appId } = packageJson.app;

  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  const args = {
    appBundleId: appId,
    appPath: appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
  };

  console.log(`[afterSign] Notarizing ${appId} found at ${appPath}`);

  try {
    await electronNotarize.notarize(args);
  } catch (err) {
    console.error(err);
  }
};
