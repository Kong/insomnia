// @flow
import type { Database } from '../index';
import type { ApiSpec } from './types';
import { mustFindSingleOrNone } from '../index';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { AutoComplete } from 'enquirer';

export const loadApiSpec = (db: Database, identifier: string): ?ApiSpec =>
  mustFindSingleOrNone(db.ApiSpec, s => matchIdIsh(s, identifier) || s.fileName === identifier);

export const promptApiSpec = async (db: Database, ci: boolean): Promise<?ApiSpec> => {
  if (ci || !db.ApiSpec.length) {
    return null;
  }

  const prompt = new AutoComplete({
    name: 'apiSpec',
    message: 'Select an API Specification',
    choices: db.ApiSpec.map(s => getDbChoice(generateIdIsh(s), s.fileName)),
  });

  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadApiSpec(db, idIsh);
};
