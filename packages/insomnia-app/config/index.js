/*
 * This file contains a helper to get the configuration for the app
 * NOTE: This is used during build scripts so can't reference any of the app code
 */

const config = require('./config.json');

module.exports.appConfig = function() {
  return config;
};
