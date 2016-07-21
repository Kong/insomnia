import * as appJson from '../app.json';

export function getAppVersion () {
  return appJson.version;
}

export function getAppLongName () {
  return appJson.longName;
}

export function getAppName () {
  return appJson.productName;
}

export function isMac () {
  return process.platform === 'darwin';
}

export function isDevelopment () {
  return process.env.NODE_ENV === 'development';
}
