/*
 * This file contains a helper to get the configuration for the current app
 * NOTE: This is used during build scripts so can't reference any of the app code
 */

const coreConfig = require('./config.core.json');
const coreBuildConfig = require('./electronbuilder.core.json');

module.exports.APP_ID_INSOMNIA = 'com.insomnia.app';

module.exports.appConfig = function() {
  return coreConfig;
};

module.exports.electronBuilderConfig = function() {
  return coreBuildConfig;
};
