import * as packageJSON from '../package.json';

export function getAppVersion () {
  return packageJSON.version;
}

export function getAppLongName () {
  return packageJSON.longName;
}

export function getAppName () {
  return packageJSON.productName;
}

export function getAppPlatform () {
  return process.platform;
}

export function getAppEnvironment () {
  return process.env.INSOMNIA_ENV || 'unknown';
}

export function isMac () {
  return getAppPlatform() === 'darwin';
}

export function isDevelopment () {
  return getAppEnvironment() === 'development';
}

export function getClientString () {
  return `${getAppEnvironment()}::${getAppPlatform()}::${getAppVersion()}`
}
