/*
 * This file contains a helper to get the configuration for the current app
 * NOTE: This is used during build scripts so can't reference any of the app code
 */

const coreConfig = require('./config.core.json');
const designerConfig = require('./config.designer.json');
const coreBuildConfig = require('./electronbuilder.core.json');
const designerBuildConfig = require('./electronbuilder.designer.json');

module.exports.APP_ID_INSOMNIA = 'com.insomnia.app';
module.exports.APP_ID_DESIGNER = 'com.insomnia.designer';

module.exports.appConfig = function() {
  switch (process.env.APP_ID) {
    case module.exports.APP_ID_DESIGNER:
      return designerConfig;
    case module.exports.APP_ID_INSOMNIA:
      return coreConfig;
    default:
      throw new Error(`APP_ID invalid value "${process.env.APP_ID}"`);
  }
};

module.exports.electronBuilderConfig = function() {
  switch (process.env.APP_ID) {
    case module.exports.APP_ID_DESIGNER:
      return designerBuildConfig;
    case module.exports.APP_ID_INSOMNIA:
      return coreBuildConfig;
    default:
      throw new Error(`APP_ID invalid value "${process.env.APP_ID}"`);
  }
};
