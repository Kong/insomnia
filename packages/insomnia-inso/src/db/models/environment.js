// @flow
import type { Database } from '../index';
import type { Environment } from './types';
import { mustFindSingle } from '../index';
import { AutoComplete } from 'enquirer';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';

export const loadEnvironment = (
  db: Database,
  workspaceId: string,
  identifier?: string,
): ?Environment => {
  if (!db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = mustFindSingle(db.Environment, e => e.parentId === workspaceId);
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
  const baseWorkspaceEnv = mustFindSingle(db.Environment, e => e.parentId === workspaceId);
  const subEnvs = db.Environment.filter(e => e.parentId === baseWorkspaceEnv._id);

  if (!subEnvs.length) {
    return baseWorkspaceEnv;
  }

  const prompt = new AutoComplete({
    name: 'environment',
    message: `Select an environment`,
    choices: subEnvs.map(e => getDbChoice(generateIdIsh(e, 14), e.name)),
  });

  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return mustFindSingle(db.Environment, e => matchIdIsh(e, idIsh));
};
