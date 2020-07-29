// @flow
import type { Database } from '../index';
import type { Environment } from './types';
import { MultipleFoundError, mustFindSingle, NoneFoundError } from '../index';
import { AutoComplete } from 'enquirer';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';
import consola from 'consola';

const loadBaseEnvironmentForWorksace = (db: Database, workspaceId: string): ?Environment => {
  consola.trace('Trying to load base environment of the workspace %s', workspaceId);
  const [baseWorkspaceEnv, err] = mustFindSingle(db.Environment, e => e.parentId === workspaceId);

  if (err) {
    if (err instanceof NoneFoundError) {
      consola.warn('No base environment found for the workspace; expected one.');
      return null;
    }

    if (err instanceof MultipleFoundError) {
      consola.warn('Multiple base environments found for the workspace; expected one.');
      return null;
    }

    throw err;
  }

  return baseWorkspaceEnv;
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
  const baseWorkspaceEnv = loadBaseEnvironmentForWorksace(db, workspaceId);
  if (!baseWorkspaceEnv) {
    return null;
  }

  const subEnvs = db.Environment.filter(e => e.parentId === baseWorkspaceEnv._id);

  // try to find a sub env, otherwise return the base env
  return identifier && subEnvs.length
    ? subEnvs.find(e => matchIdIsh(e, identifier) || e.name === identifier)
    : baseWorkspaceEnv;
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
  const baseWorkspaceEnv = loadBaseEnvironmentForWorksace(db, workspaceId);
  if (!baseWorkspaceEnv) {
    return null;
  }

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

  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadEnvironment(db, workspaceId, idIsh);
};
