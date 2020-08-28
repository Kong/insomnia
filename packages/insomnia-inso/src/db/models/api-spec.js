// @flow
import type { Database } from '../index';
import type { ApiSpec } from './types';
import { ensureSingleOrNone, generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { AutoComplete } from 'enquirer';
import logger from '../../logger';

const entity = 'api specification';

export const loadApiSpec = (db: Database, identifier: string): ?ApiSpec => {
  logger.trace('Load %s with identifier `%s` from data store', entity, identifier);
  const items = db.ApiSpec.filter(s => matchIdIsh(s, identifier) || s.fileName === identifier);
  logger.trace('Found %d.', items.length);

  return ensureSingleOrNone(items, entity);
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

  logger.trace('Prompt for %s', entity);
  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadApiSpec(db, idIsh);
};
