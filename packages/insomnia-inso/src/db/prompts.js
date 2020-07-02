// @flow
import type { ApiSpec } from './types';
import { AutoComplete } from 'enquirer';
import type { Database } from './index';

export async function getApiSpecFromIdentifier(
  db: Database,
  identifier?: string,
): Promise<?ApiSpec> {
  if (!db.ApiSpec.length) {
    return null;
  }

  if (identifier) {
    return db.ApiSpec.find(s => s.fileName === identifier || s._id.startsWith(identifier));
  }

  const prompt = new AutoComplete({
    name: 'apiSpec',
    message: 'Select an API Specification',
    choices: db.ApiSpec.map(s => `${s.fileName} - ${s._id.substr(0, 10)}`),
  });

  const [, idIsh] = (await prompt.run()).split(' - ');
  return db.ApiSpec.find(s => s._id.startsWith(idIsh));
}
