import * as appJson from '../app.json';

export function getVersion () {
  return appJson.version;
}

export function isDevelopment () {
  return process.env.NODE_ENV === 'development';
}
