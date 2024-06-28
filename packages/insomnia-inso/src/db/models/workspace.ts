// @ts-expect-error the enquirer types are incomplete https://github.com/enquirer/enquirer/pull/307
import { AutoComplete } from 'enquirer';

import { logger } from '../../cli';
import type { Database } from '../index';
import { Workspace } from './types';
import { ensureSingleOrNone, generateIdIsh, getDbChoice, matchIdIsh } from './util';
const entity = 'workspace';
export const loadWorkspace = (db: Database, identifier: string) => {
  logger.trace(
    'Load workspace with identifier `%s` from data store',
    identifier,
  );
  const items = db.Workspace.filter(workspace => (
    matchIdIsh(workspace, identifier) || workspace.name === identifier
  ));
  logger.trace('Found %d.', items.length);
  return ensureSingleOrNone(items, 'workspace');
};
export const promptWorkspace = async (
  db: Database,
  ci: boolean,
): Promise<Workspace | null | undefined> => {
  if (ci || !db.Workspace.length) {
    return null;
  }

  const prompt = new AutoComplete({
    name: 'workspace',
    message: 'Select a workspace',
    choices: db.Workspace.map(s => getDbChoice(generateIdIsh(s), s.name)),
  });
  logger.trace('Prompt for %s', entity);
  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadWorkspace(db, idIsh);
};
