// @flow
import type { BaseModel, Environment } from './types';
import { AutoComplete } from 'enquirer';
import type { Database } from './index';
import { mustFindSingle } from './index';

export const matchIdIsh = ({ _id }: BaseModel, identifier: string) => _id.startsWith(identifier);
export const generateIdIsh = ({ _id }: BaseModel, length: number = 10) => _id.substr(0, length);

function indent(level: number, code: string, tab: string = '  |'): string {
  if (!level || level < 0) {
    return code;
  }

  const prefix = new Array(level + 1).join(tab);
  return `${prefix} ${code}`;
}

export const getDbChoice = (
  idIsh: string,
  message: string,
  config: { indent?: number, hint?: string } = {},
) => ({
  name: idIsh,
  message: indent(config.indent || 0, message),
  value: `${message} - ${idIsh}`,
  hint: config.hint || `${idIsh}`,
});

export function loadEnvironment(
  db: Database,
  workspaceId: string,
  identifier?: string,
): ?Environment {
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
}

export async function promptEnvironment(
  db: Database,
  ci: boolean,
  workspaceId: string,
): Promise<?Environment> {
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
}
