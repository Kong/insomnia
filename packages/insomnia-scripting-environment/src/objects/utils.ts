import type { Settings } from 'insomnia/src/models/settings';

/** ignore */
export function checkIfUrlIncludesTag(url: string): boolean {
  return /{%/.test(`${url}`) || /%}/.test(`${url}`) || /{{/.test(`${url}`) || /}}/.test(`${url}`);
}

let globalSettings: undefined | Settings = undefined;
export function getGlobalSettings(): Settings | undefined {
  return globalSettings;
}
export function initGlobalSettings(newSettings: Settings) {
  globalSettings = newSettings;
}
