import * as appJson from '../app.json';

export function getVersion () {
  return appJson.version;
}

export function isMac () {
  return process.platform === 'darwin';
}

export function isDevelopment () {
  return process.env.NODE_ENV === 'development';
}
