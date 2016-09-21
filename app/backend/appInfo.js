'use strict';

const appJson = require('../package.json');

module.exports.getAppVersion = () => {
  return appJson.version;
};

module.exports.getAppLongName = () => {
  return appJson.longName;
};

module.exports.getAppName = () => {
  return appJson.productName;
};

module.exports.isMac = () => {
  return process.platform === 'darwin';
};

module.exports.isDevelopment = () => {
  return process.env.INSOMNIA_ENV === 'development';
};
