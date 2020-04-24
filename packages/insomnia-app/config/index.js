/*
 * This file contains a helper to get the configuration for the current app
 * NOTE: This is used during build scripts so can't reference any of the app code
 */

const coreConfig = require('./config.core.json');
const designerConfig = require('./config.designer.json');
const coreBuildConfig = require('./electronbuilder.core.json');
const designerBuildConfig = require('./electronbuilder.designer.json');

module.exports.appConfig = function() {
  switch (process.env.APP_ID) {
    case 'com.insomnia.app':
      return coreConfig;
    case 'com.insomnia.designer':
      return designerConfig;
    default:
      throw new Error('APP_ID environment variable not correctly configured');
  }
};

module.exports.electronBuilderConfig = function() {
  switch (process.env.APP_ID) {
    case 'com.insomnia.app':
      return coreBuildConfig;
    case 'com.insomnia.designer':
      return designerBuildConfig;
    default:
      throw new Error('APP_ID environment variable not correctly configured');
  }
};
