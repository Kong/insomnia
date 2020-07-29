// @flow
import type { Database } from '../index';
import type { ApiSpec } from './types';
import { MultipleFoundError, mustFindSingleOrNone } from '../index';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { AutoComplete } from 'enquirer';
import consola from 'consola';

export const loadApiSpec = (db: Database, identifier: string): ?ApiSpec => {
  consola.trace('Trying to load api specification with identifier %s', identifier);
  const [spec, err] = mustFindSingleOrNone(
    db.ApiSpec,
    s => matchIdIsh(s, identifier) || s.fileName === identifier,
  );

  if (err) {
    if (err instanceof MultipleFoundError) {
      consola.warn('Multiple base environments found for the workspace; expected one.');
      return null;
    }

    throw err;
  }
  return spec;
};

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
