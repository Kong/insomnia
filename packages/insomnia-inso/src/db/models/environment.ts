import type { Database } from '../index';
import type { Environment } from './types';
// @ts-expect-error the enquirer types are incomplete https://github.com/enquirer/enquirer/pull/307
import { AutoComplete } from 'enquirer';
import { ensureSingle, generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { logger } from '../../logger';

const loadBaseEnvironmentForWorkspace = (db: Database, workspaceId: string): Environment => {
  logger.trace(
    'Load base environment for the workspace `%s` from data store',
    workspaceId,
  );
  const items = db.Environment.filter(e => e.parentId === workspaceId);
  logger.trace('Found %d.', items.length);
  return ensureSingle(items, 'base environment');
};

export const loadEnvironment = (
  db: Database,
  workspaceId: string,
  identifier?: string,
): Environment | null | undefined => {
  if (!db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = loadBaseEnvironmentForWorkspace(db, workspaceId);
  const subEnvs = db.Environment.filter(
    env => env.parentId === baseWorkspaceEnv._id,
  );

  // If no identifier, return base environmenmt
  if (!identifier) {
    logger.trace('No sub environments found, using base environment');
    return baseWorkspaceEnv;
  }

  logger.trace(
    'Load sub environment with identifier `%s` from data store',
    identifier,
  );
  const items = subEnvs.filter(
    env => matchIdIsh(env, identifier) || env.name === identifier,
  );
  logger.trace('Found %d', items.length);
  return ensureSingle(items, 'sub environment');
};

export const promptEnvironment = async (
  db: Database,
  ci: boolean,
  workspaceId: string,
): Promise<Environment | null | undefined> => {
  if (ci || !db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = loadBaseEnvironmentForWorkspace(db, workspaceId);
  const subEnvs = db.Environment.filter(
    e => e.parentId === baseWorkspaceEnv._id,
  );

  if (!subEnvs.length) {
    logger.trace('No sub environments found, using base environment');
    return baseWorkspaceEnv;
  }

  const prompt = new AutoComplete({
    name: 'environment',
    message: 'Select an environment',
    choices: subEnvs.map(e => getDbChoice(generateIdIsh(e, 14), e.name)),
  });
  logger.trace('Prompt for environment');
  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadEnvironment(db, workspaceId, idIsh);
};
