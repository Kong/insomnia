// @flow
import type { Database } from '../index';
import type { Environment } from './types';
import { AutoComplete } from 'enquirer';
import { ensureSingle, generateIdIsh, getDbChoice, matchIdIsh } from './util';
import consola from 'consola';

const loadBaseEnvironmentForWorkspace = (db: Database, workspaceId: string): Environment => {
  consola.trace('Load base environment for the workspace `%s` from data store', workspaceId);
  const items = db.Environment.filter(e => e.parentId === workspaceId);
  consola.trace('Found %d.', items.length);

  return ensureSingle(items, 'base environment');
};

export const loadEnvironment = (
  db: Database,
  workspaceId: string,
  identifier?: string,
): ?Environment => {
  if (!db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = loadBaseEnvironmentForWorkspace(db, workspaceId);
  const subEnvs = db.Environment.filter(e => e.parentId === baseWorkspaceEnv._id);

  // If no identifier, return base environmenmt
  if (!identifier) {
    consola.trace('No sub environments found, using base environment');
    return baseWorkspaceEnv;
  }

  consola.trace('Load sub environment with identifier `%s` from data store', identifier);
  const items = subEnvs.filter(e => matchIdIsh(e, identifier) || e.name === identifier);
  consola.trace('Found %d', items.length);

  return ensureSingle(items, 'sub environment');
};

export const promptEnvironment = async (
  db: Database,
  ci: boolean,
  workspaceId: string,
): Promise<?Environment> => {
  if (ci || !db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = loadBaseEnvironmentForWorkspace(db, workspaceId);
  const subEnvs = db.Environment.filter(e => e.parentId === baseWorkspaceEnv._id);

  if (!subEnvs.length) {
    consola.trace('No sub environments found, using base environment');
    return baseWorkspaceEnv;
  }

  const prompt = new AutoComplete({
    name: 'environment',
    message: `Select an environment`,
    choices: subEnvs.map(e => getDbChoice(generateIdIsh(e, 14), e.name)),
  });

  consola.trace('Prompt for environment');
  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadEnvironment(db, workspaceId, idIsh);
};
