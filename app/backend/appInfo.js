import appJson from '../package.json';

export function getAppVersion () {
  return appJson.version;
}

export function getAppLongName () {
  return appJson.longName;
}

export function getAppName () {
  return appJson.productName;
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
